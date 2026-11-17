import { clerkSetup } from "@clerk/testing/playwright";
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";
import { writeRunContext, runContextExists, readRunContext } from "./run-context";
import { nettoyer } from "./cleanup";

/**
 * Prépare une exécution :
 * - vérifie les variables (compte admin, clé d'intégration) et que le serveur répond ;
 * - nettoie une éventuelle exécution précédente interrompue ;
 * - crée la proforma de test (client + proforma « E2E-… ») à laquelle le budget de campagne sera lié,
 *   pour ne jamais imputer de dépense de test à une vraie proforma ;
 * - prépare la connexion Clerk automatisée (jeton de test, contourne la protection anti-robot).
 */
export default async function globalSetup() {
  const manquantes = ["E2E_ADMIN_EMAIL", "E2E_ADMIN_PASSWORD", "INTEGRATION_API_KEY", "DATABASE_URL", "CLERK_SECRET_KEY"].filter(
    (v) => !process.env[v]
  );
  if (manquantes.length > 0) {
    throw new Error(`Variables manquantes : ${manquantes.join(", ")} (voir e2e/README.md).`);
  }

  const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
  const ping = await fetch(`${baseURL}/sign-in`).catch(() => null);
  if (!ping || ping.status >= 500) {
    throw new Error(`Le serveur ne répond pas sur ${baseURL}. Lancez-le avec EMAIL_DISABLED=true (voir e2e/README.md).`);
  }

  if (runContextExists()) {
    console.log("Exécution précédente interrompue : nettoyage de ses données…");
    await nettoyer(readRunContext());
  }

  const run = `E2E-${Date.now().toString(36)}`;
  const slug = run.toLowerCase();
  const prisma = new PrismaClient();
  try {
    const config = await prisma.entrepriseConfig.findFirst();
    const client = await prisma.client.create({ data: { nom: `${run} Client test` } });
    const invoice = await prisma.invoice.create({
      data: {
        numero: `${run}-PRO`,
        objet: `${run} campagne de test`,
        clientId: client.id,
        totalHT: 100000,
        tva: 0,
        totalTTC: 100000,
        societeNom: "Test",
        societeIFU: "0",
        statut: "Valider",
        resteAPayer: 100000,
      },
    });

    writeRunContext({
      run,
      // Mot de passe fort aléatoire, propre à cette exécution (comptes supprimés à la fin).
      password: `E2e!${randomBytes(9).toString("base64url")}9a`,
      plafond: Number(config?.plafondValidationDeleguee ?? 500000),
      clientId: client.id,
      invoiceId: invoice.id,
      invoiceNumero: invoice.numero,
      users: {
        demandeur: `${slug}.demandeur@example.com`,
        valideur: `${slug}.valideur@example.com`,
        comptable: `${slug}.comptable@example.com`,
      },
      roles: { demandeur: `${run} Demandeur`, valideur: `${run} Valideur`, comptable: `${run} Comptable` },
      caisseNom: `${run} Caisse`,
    });
  } finally {
    await prisma.$disconnect();
  }

  await clerkSetup({ publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY });
}
