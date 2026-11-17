import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import type { RunContext } from "./run-context";

/**
 * Supprime TOUT ce qu'une exécution a créé, et uniquement cela (repéré par son marqueur `run`,
 * les emails de ses comptes de test, sa caisse et sa proforma de test). Les vraies caisses ne sont
 * jamais touchées : si une écriture de test se trouvait sur une autre caisse, elle est signalée,
 * pas supprimée (son retrait fausserait les soldes suivants).
 */
export async function nettoyer(ctx: RunContext): Promise<void> {
  const prisma = new PrismaClient();
  const bilan: string[] = [];
  try {
    const emails = Object.values(ctx.users);
    const demandes = await prisma.demandeBudget.findMany({
      where: { OR: [{ requesterEmail: { in: emails } }, { contexteMotivation: { contains: ctx.run } }] },
      select: { id: true, numero: true, depenses: { select: { id: true, cashJournalEntryId: true, contreEcritureId: true, cashRegisterId: true } } },
    });
    const caisse = await prisma.cashRegister.findFirst({ where: { name: ctx.caisseNom } });

    const ecrituresHorsCaisseTest = demandes
      .flatMap((d) => d.depenses)
      .filter((d) => !caisse || d.cashRegisterId !== caisse.id);
    if (ecrituresHorsCaisseTest.length > 0) {
      bilan.push(`⚠ ${ecrituresHorsCaisseTest.length} dépense(s) de test sur une autre caisse : écritures conservées, à vérifier.`);
    }

    // Paiements imputés à la proforma de test (dépenses de budget de campagne).
    const paiements = await prisma.paiement.deleteMany({ where: { invoiceId: ctx.invoiceId } });
    bilan.push(`${paiements.count} paiement(s) de la proforma de test`);

    const demandeIds = demandes.map((d) => d.id);
    const depenses = await prisma.budgetDepense.deleteMany({ where: { demandeBudgetId: { in: demandeIds } } });
    const supprimees = await prisma.demandeBudget.deleteMany({ where: { id: { in: demandeIds } } });
    bilan.push(`${supprimees.count} budget(s) (${demandes.map((d) => d.numero).join(", ") || "—"}), ${depenses.count} dépense(s)`);

    if (caisse) {
      const ecritures = await prisma.cashJournal.deleteMany({ where: { cashRegisterId: caisse.id } });
      await prisma.cashRegister.delete({ where: { id: caisse.id } });
      bilan.push(`caisse « ${ctx.caisseNom} » et ses ${ecritures.count} écriture(s)`);
    }

    await prisma.invoice.deleteMany({ where: { id: ctx.invoiceId } });
    await prisma.client.deleteMany({ where: { id: ctx.clientId } });
    bilan.push("proforma et client de test");

    // Comptes : base puis Clerk (même si la ligne en base manque, le compte Clerk peut exister).
    const users = await prisma.user.deleteMany({ where: { email: { in: emails } } });
    const clerk = await supprimerComptesClerk(emails);
    bilan.push(`${users.count} compte(s) en base, ${clerk} compte(s) Clerk`);

    const roles = await prisma.role.deleteMany({ where: { nom: { in: Object.values(ctx.roles) } } });
    bilan.push(`${roles.count} rôle(s)`);

    for (const id of demandeIds) {
      fs.rmSync(path.join(process.cwd(), "public", "Upload", "DemandeBudget", id), { recursive: true, force: true });
    }
    bilan.push("fichiers déposés");
  } finally {
    await prisma.$disconnect();
  }
  console.log(`Nettoyage ${ctx.run} : ${bilan.join(" ; ")}.`);
}

async function supprimerComptesClerk(emails: string[]): Promise<number> {
  const headers = { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` };
  let n = 0;
  for (const email of emails) {
    const res = await fetch(`https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`, { headers });
    if (!res.ok) continue;
    const users = (await res.json()) as { id: string }[];
    for (const u of users) {
      const del = await fetch(`https://api.clerk.com/v1/users/${u.id}`, { method: "DELETE", headers });
      if (del.ok) n++;
    }
  }
  return n;
}
