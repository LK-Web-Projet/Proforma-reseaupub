import { test, expect } from "@playwright/test";
import { connecter, prisma } from "./helpers";
import { readRunContext } from "./run-context";

/**
 * Non-régression : chaque grande page de l'application s'ouvre pour l'admin, sans erreur serveur,
 * sans écran d'erreur et sans exception JavaScript. Lecture seule : rien n'est créé.
 */
const ADMIN = { email: process.env.E2E_ADMIN_EMAIL!, password: process.env.E2E_ADMIN_PASSWORD! };

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("Pages principales (admin) : aucune erreur", async ({ browser }) => {
  test.setTimeout(900_000);
  const ctx = readRunContext();
  const uneDemande = await prisma.demandeBudget.findFirst({ where: { NOT: { contexteMotivation: { contains: "E2E-" } } }, orderBy: { createdAt: "desc" } });
  const uneFacture = await prisma.invoice.findFirst({ where: { NOT: { numero: { startsWith: "E2E-" } } } });
  const unFournisseur = await prisma.fournisseur.findFirst({ orderBy: { createdAt: "desc" } });
  const uneCommande = await prisma.commandeFournisseur.findFirst({ orderBy: { createdAt: "desc" } });

  const pages = [
    "/dashboard",
    "/dashboard/rapports",
    "/dashboard/rapports/suivi-budgetaire",
    "/dashboard/rapports/tresorerie-hebdomadaire",
    "/facture",
    "/facture/new",
    "/statistiques",
    "/client",
    "/fournisseur",
    "/produits",
    "/gestionnaire",
    "/journal-caisse",
    "/journal-caisse/export",
    "/budget/demandes",
    "/budget/nouvelle-demande",
    "/parametres",
    "/parametres/roles",
    "/parametres/utilisateurs",
    "/parametres/notifications",
    "/notifications",
    "/recherche?q=DB-2026",
    "/aide",
    "/fournisseur/factures",
    "/fournisseur/commandes",
    `/facture/${ctx.invoiceId}`,
    ...(uneFacture ? [`/facture/${uneFacture.id}`] : []),
    ...(uneDemande ? [`/budget/demandes/${uneDemande.id}`] : []),
    ...(unFournisseur ? [`/fournisseur/${unFournisseur.id}`] : []),
    ...(uneCommande ? [`/fournisseur/${uneCommande.fournisseurId}/commandes/${uneCommande.id}`] : []),
  ];

  const { page, erreurs, fermer } = await connecter(browser, ADMIN.email, ADMIN.password);
  const echecs: string[] = [];
  const erreursServeur: string[] = [];
  page.on("response", (r) => {
    if (r.url().includes("/api/") && r.status() >= 500) erreursServeur.push(`${r.status()} ${r.url()}`);
  });

  for (const url of pages) {
    const avant = erreurs.length;
    // Une page lente ou une navigation interrompue est notée en échec, sans arrêter la tournée.
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 }).catch((e: Error) => {
      echecs.push(`${url} → navigation impossible : ${e.message.split("\n")[0]}`);
      return undefined;
    });
    if (res === undefined) continue;
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
    const statut = res?.status() ?? 0;
    const ecranErreur = await page
      .getByText(/Application error|Unhandled Runtime Error|Internal Server Error|This page could not be found/)
      .count();
    const redirigeAccesRefuse = page.url().includes("/acces-refuse") || page.url().includes("/sign-in");
    if (statut >= 400 || ecranErreur > 0 || redirigeAccesRefuse || erreurs.length > avant) {
      echecs.push(`${url} → HTTP ${statut}${ecranErreur ? ", écran d'erreur" : ""}${redirigeAccesRefuse ? `, redirigé vers ${page.url()}` : ""}${erreurs.length > avant ? `, JS : ${erreurs.slice(avant).join(" | ")}` : ""}`);
    }
  }
  await fermer();

  expect(echecs, `Pages en échec :\n${echecs.join("\n")}`).toEqual([]);
  expect(erreursServeur, `API en erreur 500 :\n${erreursServeur.join("\n")}`).toEqual([]);
});
