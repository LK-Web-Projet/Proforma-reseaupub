import fs from "fs";
import { test, expect, request as playwrightRequest } from "@playwright/test";
import { readRunContext, updateRunContext, type RunContext } from "./run-context";
import { attendreToast, choisir, connecter, interrupteur, ligne, pdfFactice, prisma } from "./helpers";

/**
 * Procédure de paiement (Lot A) de bout en bout, avec de vrais comptes et de vrais rôles :
 *   admin (compte fourni) → crée les rôles et les comptes Demandeur / Valideur / Comptable,
 *   une caisse de test, puis chaque acteur fait sa part du circuit.
 * Les scénarios s'enchaînent (mode serial) : un échec arrête la suite.
 */
test.describe.configure({ mode: "serial" });

const ADMIN = { email: process.env.E2E_ADMIN_EMAIL!, password: process.env.E2E_ADMIN_PASSWORD! };
let ctx: RunContext;
// Montants sous le plafond de validation déléguée (lu en base). Un budget de campagne est validé par
// l'administrateur quel que soit son montant : le rôle « Valider les budgets (hors mensuels et
// campagne) » ne peut pas le valider (vérifié à l'étape 5).
let L1 = 0; // ligne Mobile Money
let L2 = 0; // ligne Chèque
let APPORT = 0; // solde de la caisse de test

test.beforeAll(() => {
  ctx = readRunContext();
  L1 = Math.floor(ctx.plafond * 0.6);
  L2 = Math.floor(ctx.plafond * 0.2);
  APPORT = Math.floor(L1 / 2);
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

const enLettres = (n: number) => new Intl.NumberFormat("fr-FR").format(n).replace(/\s/g, "\\s");

test("1. Admin : crée les rôles (droits cochés sur la page Rôles)", async ({ browser }) => {
  const { page, fermer } = await connecter(browser, ADMIN.email, ADMIN.password);
  await page.goto("/parametres/roles");
  await expect(page.getByRole("heading", { name: /Rôles/ })).toBeVisible();

  const roles: { nom: string; pages: string[]; droits: string[] }[] = [
    { nom: ctx.roles.demandeur, pages: ["Proforma (factures, statistiques)"], droits: [] },
    { nom: ctx.roles.valideur, pages: ["Proforma (factures, statistiques)"], droits: ["Valider les budgets (hors mensuels et campagne)"] },
    // Comptable SANS « Saisir au journal de caisse » : il paie par le circuit budget, mais ne
    // peut pas sortir d'argent directement du journal.
    { nom: ctx.roles.comptable, pages: ["Finance (journal de caisse)"], droits: ["Enregistrer les dépenses de budget"] },
  ];
  for (const r of roles) {
    await page.getByRole("button", { name: "Nouveau rôle" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#nom").fill(r.nom);
    for (const p of r.pages) await interrupteur(dialog, p).click();
    for (const d of r.droits) await interrupteur(dialog, d).click();
    await dialog.getByRole("button", { name: "Créer le rôle" }).click();
    await attendreToast(page, "Rôle créé !");
    await expect(dialog).toBeHidden();
  }

  // La nouvelle case existe et la reprise l'a cochée sur le rôle Admin.
  await expect(ligne(page, ctx.roles.comptable)).toContainText("Dépenses");
  await expect(ligne(page, ctx.roles.comptable)).not.toContainText("Caisse");
  await page.getByRole("button", { name: "Nouveau rôle" }).click();
  await expect(page.getByRole("dialog").getByText("Saisir au journal de caisse (hors budget)")).toBeVisible();
  await page.keyboard.press("Escape");
  await fermer();
});

test("2. Admin : crée les comptes de test et leur attribue un rôle", async ({ browser }) => {
  const { page, fermer } = await connecter(browser, ADMIN.email, ADMIN.password);
  await page.goto("/parametres/utilisateurs");
  const comptes = [
    { email: ctx.users.demandeur, nom: `${ctx.run} Demandeur`, role: ctx.roles.demandeur },
    { email: ctx.users.valideur, nom: `${ctx.run} Valideur`, role: ctx.roles.valideur },
    { email: ctx.users.comptable, nom: `${ctx.run} Comptable`, role: ctx.roles.comptable },
  ];
  for (const c of comptes) {
    await page.getByRole("button", { name: "Créer un compte" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#nom").fill(c.nom);
    await dialog.locator("#email").fill(c.email);
    await dialog.locator("#password").fill(ctx.password);
    await choisir(page, dialog.getByRole("combobox"), c.role);
    await dialog.getByRole("button", { name: "Créer le compte" }).click();
    await attendreToast(page, "Compte créé !");
    await expect(dialog).toBeHidden();
    await expect(ligne(page, c.email)).toBeVisible();
  }
  await fermer();
});

test("3. Admin : caisse de test, apport, et refus serveur d'une sortie supérieure au solde", async ({ browser }) => {
  const { page, fermer } = await connecter(browser, ADMIN.email, ADMIN.password);
  await page.goto("/journal-caisse");
  await page.getByText("Ajouter une caisse").click();
  await page.locator("#newRegisterName").fill(ctx.caisseNom);
  await page.getByRole("button", { name: "Ajouter la caisse" }).click();
  await attendreToast(page, "Caisse ajoutée avec succès.");
  const caisse = await prisma.cashRegister.findFirstOrThrow({ where: { name: ctx.caisseNom } });
  updateRunContext({ caisseId: caisse.id });

  await page.getByRole("button", { name: "Ajouter une opération" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("#libelle").fill(`${ctx.run} apport`);
  await choisir(page, dialog.getByRole("combobox").first(), ctx.caisseNom);
  await dialog.locator("#montant").fill(String(APPORT));
  await dialog.getByRole("button", { name: "Ajouter", exact: true }).click();
  await attendreToast(page, "Opération ajoutée avec succès.");
  await expect.poll(async () => (await prisma.cashRegister.findUniqueOrThrow({ where: { id: caisse.id } })).balance).toBe(APPORT);

  // Le formulaire bloque déjà côté écran ; on vérifie que le SERVEUR refuse aussi (appel direct).
  const res = await page.request.post("/api/cash-journal", {
    data: { libelle: `${ctx.run} trop`, type: "DEPENSE", montant: APPORT + 1, date_operation: new Date().toISOString(), cashRegisterId: caisse.id },
  });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toMatch(/Solde insuffisant/);
  // Transfert depuis la caisse de test au-delà de son solde : refusé aussi.
  const autre = await prisma.cashRegister.findFirstOrThrow({ where: { id: { not: caisse.id } } });
  const transfert = await page.request.post("/api/cash-journal", {
    data: { libelle: `${ctx.run} transfert`, type: "TRANSFERT", montant: APPORT + 1, date_operation: new Date().toISOString(), cashRegisterId: caisse.id, destinationCashRegisterId: autre.id },
  });
  expect(transfert.status()).toBe(400);
  await fermer();
});

test("4. Demandeur : budget de campagne avec un moyen de paiement par ligne", async ({ browser }) => {
  const { page, fermer } = await connecter(browser, ctx.users.demandeur, ctx.password);
  await page.goto("/budget/nouvelle-demande");
  await page.getByRole("button", { name: /^Campagne/ }).click();
  await page.locator("textarea").first().fill(`${ctx.run} budget de campagne (test automatisé)`);
  await page.getByPlaceholder("Nom du client ou de la campagne").fill(`${ctx.run} Client test`);

  await page.getByRole("button", { name: "Ajouter une ligne" }).click();
  const lignes = page.locator("tbody tr");
  const remplir = async (i: number, designation: string, categorie: string, moyen: string, montant: number) => {
    const row = lignes.nth(i);
    await row.locator("input").first().fill(designation);
    await choisir(page, row.getByRole("combobox").nth(0), categorie);
    await choisir(page, row.getByRole("combobox").nth(1), moyen);
    await row.locator('input[type="number"]').fill(String(montant));
  };
  await remplir(0, `${ctx.run} Hôtesses`, "Prestations / sous-traitance", "Mobile Money", L1);
  await remplir(1, `${ctx.run} Impression`, "Impression & supports", "Chèque", L2);
  // Total par moyen affiché sous le total.
  await expect(page.getByText(/Mobile Money :/)).toBeVisible();
  await expect(page.getByText(/Chèque :/)).toBeVisible();

  // Une seule proforma par budget : sélecteur simple (il se ferme au choix).
  await page.getByRole("combobox", { name: /Choisir la proforma de la campagne/ }).click();
  await page.getByPlaceholder("Rechercher une proforma...").fill(ctx.invoiceNumero);
  await page.getByRole("option", { name: new RegExp(ctx.invoiceNumero) }).click();

  await page.getByRole("button", { name: "Soumettre la demande" }).click();
  await attendreToast(page, "Demande de budget soumise avec succès !");
  const demande = await prisma.demandeBudget.findFirstOrThrow({
    where: { contexteMotivation: { contains: ctx.run }, type: "CAMPAGNE" },
    include: { lignes: true },
  });
  updateRunContext({ budgetCampagneId: demande.id });
  expect(demande.lignes.map((l) => l.modePaiement).sort()).toEqual(["CHEQUE", "MOBILE_MONEY"]);

  // Fiche : moyens par ligne, total par moyen, exigence du budget signé.
  await page.goto(`/budget/demandes/${demande.id}`);
  await expect(page.getByText("Prévu par moyen de paiement")).toBeVisible();
  await expect(ligne(page, `${ctx.run} Hôtesses`)).toContainText("Mobile Money");
  await expect(ligne(page, `${ctx.run} Impression`)).toContainText("Chèque");
  await expect(page.getByText("Budget signé par la DG requis")).toBeVisible();

  // Impression du budget pour signature (PDF).
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Imprimer" }).first().click()]);
  expect(download.suggestedFilename()).toBe(`${demande.numero}.pdf`);
  const chemin = await download.path();
  const pdf = fs.readFileSync(chemin!);
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.length).toBeGreaterThan(1500);
  await fermer();
});

test("5. Budget de campagne : refusé au valideur délégué ; l'admin ne peut rien accorder sans le budget signé", async ({ browser }) => {
  const id = readRunContext().budgetCampagneId!;
  // Rôle délégué : une campagne n'est pas de son niveau, quel que soit le montant (écran et serveur).
  const valideur = await connecter(browser, ctx.users.valideur, ctx.password);
  await valideur.page.goto(`/budget/demandes/${id}`);
  await expect(valideur.page.getByText("Cette demande n'est pas de votre niveau de validation.")).toBeVisible();
  const refus = await valideur.page.request.post(`/api/demandes-budget/${id}/valider`);
  expect(refus.status()).toBe(403);
  expect((await refus.json()).error).toMatch(/campagne/);
  await valideur.fermer();

  const { page, fermer } = await connecter(browser, ADMIN.email, ADMIN.password);
  await page.goto(`/budget/demandes/${id}`);
  await expect(page.getByText("Validation requise")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tout valider" })).toBeDisabled();
  await expect(ligne(page, `${ctx.run} Hôtesses`).getByRole("button", { name: "Accorder" })).toBeDisabled();

  // Même refus côté serveur, en contournant l'écran.
  const valider = await page.request.post(`/api/demandes-budget/${id}/valider`);
  expect(valider.status()).toBe(400);
  expect((await valider.json()).error).toMatch(/signé/);
  const l1 = await prisma.demandeBudgetLigne.findFirstOrThrow({ where: { demandeBudgetId: id, designation: `${ctx.run} Hôtesses` } });
  const decider = await page.request.post(`/api/demandes-budget/${id}/lignes/${l1.id}/decider`, { data: { decision: "ACCORDER" } });
  expect(decider.status()).toBe(400);
  await fermer();
});

test("6. Demandeur : joint le scan du budget signé (nom de fichier normalisé)", async ({ browser }) => {
  const { page, fermer } = await connecter(browser, ctx.users.demandeur, ctx.password);
  const id = readRunContext().budgetCampagneId!;
  await page.goto(`/budget/demandes/${id}`);
  await page.getByRole("button", { name: "Joindre le budget signé" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("combobox").first()).toContainText("Budget signé (DG)");
  await dialog.locator('input[type="file"]').first().setInputFiles({ name: "scan budget signé.pdf", mimeType: "application/pdf", buffer: pdfFactice("Budget signe") });
  await dialog.getByRole("button", { name: "Ajouter", exact: true }).click();
  await attendreToast(page, "Document(s) ajouté(s) avec succès !");
  await expect(page.getByText("Budget signé par la DG requis")).toBeHidden();

  const piece = await prisma.demandeBudgetAttachment.findFirstOrThrow({ where: { demandeBudgetId: id, kind: "BUDGET_SIGNE" } });
  const demande = await prisma.demandeBudget.findUniqueOrThrow({ where: { id } });
  expect(piece.fileName).toMatch(new RegExp(`^\\d{4}-\\d{2}-\\d{2}_.*${demande.numero}_Budget-signe_${L1 + L2}F\\.pdf$`));
  await expect(page.getByText(piece.fileName)).toBeVisible();
  await fermer();
});

test("7. Admin : accorde la ligne 1, ajuste la ligne 2 → budget de campagne validé", async ({ browser }) => {
  const { page, fermer } = await connecter(browser, ADMIN.email, ADMIN.password);
  const id = readRunContext().budgetCampagneId!;
  await page.goto(`/budget/demandes/${id}`);
  await ligne(page, `${ctx.run} Hôtesses`).getByRole("button", { name: "Accorder" }).click();
  await attendreToast(page, "Ligne accordée.");
  await expect(page.getByText("Validation partielle").first()).toBeVisible();

  await ligne(page, `${ctx.run} Impression`).getByRole("button", { name: "Ajuster" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("#montant-accorde").fill(String(L2 - 100));
  await dialog.locator("#motif-decision").fill(`${ctx.run} réduction de test`);
  await dialog.getByRole("button", { name: "Accorder ce montant" }).click();
  await attendreToast(page, "Ligne accordée au montant ajusté.");
  await expect(page.getByText("Validée").first()).toBeVisible();
  await expect.poll(async () => (await prisma.demandeBudget.findUniqueOrThrow({ where: { id } })).statut).toBe("VALIDEE");
  await fermer();
});

test("8. Comptable sans droit de caisse : journal en consultation seule (écran et serveur)", async ({ browser }) => {
  const { page, fermer } = await connecter(browser, ctx.users.comptable, ctx.password);
  await page.goto("/journal-caisse");
  await expect(page.getByText(/Consultation seule/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Ajouter une opération" })).toHaveCount(0);
  await expect(page.getByText("Ajouter une caisse")).toHaveCount(0);

  const caisseId = readRunContext().caisseId!;
  const saisie = await page.request.post("/api/cash-journal", {
    data: { libelle: `${ctx.run} interdit`, type: "RECETTE", montant: 1, date_operation: new Date().toISOString(), cashRegisterId: caisseId },
  });
  expect(saisie.status()).toBe(403);
  expect((await page.request.post("/api/cash-registers", { data: { name: `${ctx.run} interdite` } })).status()).toBe(403);
  expect((await page.request.patch(`/api/cash-registers/${caisseId}`, { data: { view: false } })).status()).toBe(403);
  expect((await page.request.post("/api/cash-journal/recalculate")).status()).toBe(403);
  expect((await prisma.cashJournal.count({ where: { cashRegisterId: caisseId } }))).toBe(1); // seul l'apport
  await fermer();
});

test("9. Comptable : dépense refusée si la caisse ne la couvre pas, puis dépense sans justificatif", async ({ browser }) => {
  const { page, fermer } = await connecter(browser, ctx.users.comptable, ctx.password);
  const id = readRunContext().budgetCampagneId!;
  await page.goto(`/budget/demandes/${id}`);

  const saisir = async (montant: number) => {
    await ligne(page, `${ctx.run} Hôtesses`).getByRole("button", { name: "Dépense" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Enregistrer une dépense" })).toBeVisible();
    await dialog.locator("#dep-montant").fill(String(montant));
    await choisir(page, dialog.getByRole("combobox").nth(0), new RegExp(ctx.caisseNom));
    // Le moyen prévu sur la ligne est pré-sélectionné.
    await expect(dialog.getByRole("combobox").nth(1)).toContainText("Mobile Money");
    await dialog.locator("#dep-receveur").fill(`${ctx.run} Hôtesse A`);
    await dialog.getByRole("switch").click(); // Dépense sans justificatif
    await dialog.getByPlaceholder(/Motif \(ex\. achat sans facture/).fill("reçu à venir (test)");
    await dialog.getByRole("button", { name: "Enregistrer la dépense" }).click();
    return dialog;
  };

  const dialog = await saisir(APPORT + 500); // ≤ reste de la ligne, > solde de la caisse
  await attendreToast(page, /Solde insuffisant/);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(await prisma.budgetDepense.count({ where: { demandeBudgetId: id } })).toBe(0);

  await saisir(1000);
  await attendreToast(page, "Dépense enregistrée et inscrite au journal de caisse.");
  const depenses = page.locator("tr", { hasText: `${ctx.run} Hôtesse A` });
  await expect(depenses.first()).toContainText("Non");
  await expect(depenses.first()).toContainText("Attendu avant le");
  await expect.poll(async () => (await prisma.cashRegister.findUniqueOrThrow({ where: { id: readRunContext().caisseId! } })).balance).toBe(APPORT - 1000);
  await fermer();
});

test("10. Justificatif en retard (plus de 24 h ouvrées) : en rouge, et dans l'état du soir", async ({ browser }) => {
  const id = readRunContext().budgetCampagneId!;
  // On vieillit la dépense de 5 jours plutôt que d'attendre 24 h ouvrées.
  const depense = await prisma.budgetDepense.findFirstOrThrow({ where: { demandeBudgetId: id } });
  await prisma.budgetDepense.update({ where: { id: depense.id }, data: { createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000) } });

  const { page, fermer } = await connecter(browser, ctx.users.comptable, ctx.password);
  await page.goto(`/budget/demandes/${id}`);
  await expect(page.getByText("Non — en retard")).toBeVisible();
  await expect(page.getByText(/dont 1 en retard/)).toBeVisible();
  await page.goto("/budget/demandes");
  await expect(page.getByText(/\(1 en retard\)/).first()).toBeVisible();
  await fermer();

  // État du soir (appel de la tâche planifiée) : à blanc, la dépense y figure en retard.
  const api = await playwrightRequest.newContext({ baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000" });
  const auth = { Authorization: `Bearer ${process.env.INTEGRATION_API_KEY}` };
  expect((await api.post("/api/integration/rapports/justificatifs-manquants?dryRun=1")).status()).toBe(401);
  const res = await api.post("/api/integration/rapports/justificatifs-manquants?dryRun=1", { headers: auth });
  expect(res.status()).toBe(200);
  const corps = await res.json();
  const numero = (await prisma.demandeBudget.findUniqueOrThrow({ where: { id } })).numero;
  const item = corps.items.find((i: { numero: string }) => i.numero === numero);
  expect(item?.enRetard).toBe(true);
  expect(corps.envoye).toBe(false);
  // Envoi réel seulement si le serveur a les emails coupés (EMAIL_DISABLED=true) : rien ne part.
  if (process.env.E2E_EMAILS_DESACTIVES === "true") {
    const envoi = await api.post("/api/integration/rapports/justificatifs-manquants", { headers: auth });
    expect(envoi.status()).toBe(200);
    expect((await envoi.json()).envoye).toBe(true);
  }
  await api.dispose();
});

test("11. Comptable : ajoute le justificatif après coup → « Oui », fichier protégé", async ({ browser }) => {
  const { page, fermer } = await connecter(browser, ctx.users.comptable, ctx.password);
  const id = readRunContext().budgetCampagneId!;
  await page.goto(`/budget/demandes/${id}`);
  await page.getByRole("button", { name: "Ajouter le justificatif" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[type="file"]').setInputFiles({ name: "reçu.pdf", mimeType: "application/pdf", buffer: pdfFactice("Recu") });
  await dialog.getByRole("button", { name: "Ajouter", exact: true }).click();
  await attendreToast(page, /Justificatif ajouté/);
  await expect(page.locator("tr", { hasText: `${ctx.run} Hôtesse A` }).first()).toContainText("Oui");

  const piece = await prisma.demandeBudgetAttachment.findFirstOrThrow({ where: { demandeBudgetId: id, kind: "PREUVE_PAIEMENT" } });
  expect(piece.fileName).toMatch(/_Preuve-paiement_1000F\.pdf$/);

  // Connecté : le fichier s'ouvre. Sans connexion : renvoyé vers la page de connexion.
  expect((await page.request.get(piece.url)).status()).toBe(200);
  const anonyme = await playwrightRequest.newContext({ baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000" });
  const res = await anonyme.get(piece.url, { maxRedirects: 0 });
  expect([302, 307, 401]).toContain(res.status());
  if (res.status() !== 401) expect(res.headers()["location"]).toMatch(/sign-in/);
  await anonyme.dispose();
  await fermer();
});

test("12. Matrice de validation : budget ponctuel au-dessus du plafond → l'admin seul valide (sans scan)", async ({ browser }) => {
  const demandeur = await connecter(browser, ctx.users.demandeur, ctx.password);
  const p = demandeur.page;
  await p.goto("/budget/nouvelle-demande");
  await p.getByRole("button", { name: /^Ponctuel/ }).click();
  await p.locator("textarea").first().fill(`${ctx.run} budget ponctuel au-dessus du plafond`);
  const row = p.locator("tbody tr").first();
  await row.locator("input").first().fill(`${ctx.run} Équipement`);
  await choisir(p, row.getByRole("combobox").nth(0), "Équipement / matériel");
  await choisir(p, row.getByRole("combobox").nth(1), "Carte bancaire");
  await row.locator('input[type="number"]').fill(String(ctx.plafond + 1000));
  await p.getByRole("button", { name: "Soumettre la demande" }).click();
  await attendreToast(p, "Demande de budget soumise avec succès !");
  const demande = await prisma.demandeBudget.findFirstOrThrow({ where: { contexteMotivation: { contains: ctx.run }, type: "PONCTUEL" } });
  updateRunContext({ budgetPonctuelId: demande.id });
  await demandeur.fermer();

  const valideur = await connecter(browser, ctx.users.valideur, ctx.password);
  await valideur.page.goto(`/budget/demandes/${demande.id}`);
  await expect(valideur.page.getByText("Cette demande n'est pas de votre niveau de validation.")).toBeVisible();
  expect((await valideur.page.request.post(`/api/demandes-budget/${demande.id}/valider`)).status()).toBe(403);
  await valideur.fermer();

  const admin = await connecter(browser, ADMIN.email, ADMIN.password);
  await admin.page.goto(`/budget/demandes/${demande.id}`);
  await expect(admin.page.getByText("Budget signé par la DG requis")).toHaveCount(0); // ponctuel : pas de scan
  await admin.page.getByRole("button", { name: "Tout valider" }).click();
  await attendreToast(admin.page, "Toutes les lignes en attente sont accordées.");
  await expect.poll(async () => (await prisma.demandeBudget.findUniqueOrThrow({ where: { id: demande.id } })).statut).toBe("VALIDEE");
  // Séparation des tâches : l'admin a validé, il ne peut pas en enregistrer la dépense.
  await expect(ligne(admin.page, `${ctx.run} Équipement`).getByRole("button", { name: "Dépense" })).toBeDisabled();
  await admin.fermer();
});

test("13. Rapport « Suivi budgétaire » : ventilation par moyen de paiement", async ({ browser }) => {
  const { page, fermer } = await connecter(browser, ADMIN.email, ADMIN.password);
  await page.goto("/dashboard/rapports/suivi-budgetaire");
  await expect(page.getByText("Par moyen de paiement")).toBeVisible();
  await expect(page.getByText("Mobile Money").first()).toBeVisible();
  // Proforma : l'admin (droit de caisse) garde le bouton « Dépense ».
  await page.goto(`/facture/${ctx.invoiceId}`);
  await expect(page.getByRole("button", { name: "Dépense" })).toBeVisible();
  // La dépense de budget de campagne est imputée à la proforma de test.
  await expect(page.getByText(new RegExp(enLettres(1000))).first()).toBeVisible();
  await fermer();
});
