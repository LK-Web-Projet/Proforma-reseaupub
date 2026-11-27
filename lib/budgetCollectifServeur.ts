import { ActionBudget, Prisma, StatutDemandeBudget, StatutLigneBudget, TypeBudget } from "@prisma/client";
import { z } from "zod";
import { logBudget } from "@/lib/budgetSuivi";
import { moisMensuelAccepte, toDateJour, toPeriodeMois } from "@/lib/budgetSchema";
import { erreurDepartementsLignes } from "@/lib/departementsServeur";
import { codeMoyenSchema } from "@/lib/moyensPaiement";
import { erreurMoyensPaiement } from "@/lib/moyensPaiementServeur";
import { journaliserProforma } from "@/lib/proformaHistoriqueServeur";
import { estResponsable, estSaLigne, refusSaisieDepartement, type CompteBudget } from "@/lib/budgetPortee";
import { CategorieDepense } from "@prisma/client";
import prisma from "@/lib/prisma";
import { sendBudgetCollectifRappel } from "@/lib/email/demandeBudget";

/**
 * Budget collectif (2026-11-26) : ouverture, préparation (lignes saisies par les départements,
 * invitations, date limite, responsable), vérification et soumission par le comptable, réouverture.
 * Les routes envoient les notifications à partir de ce que ces fonctions renvoient.
 */

type Db = Prisma.TransactionClient;

export class BudgetCollectifError extends Error {
  constructor(message: string, public status = 400, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export interface CompteCollectif extends CompteBudget {
  userId: string;
  name: string | null;
  canManageUsers: boolean;
}

const fcfa = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`;
const dateFr = (d: Date | null) => (d ? d.toLocaleDateString("fr-FR", { timeZone: "UTC" }) : "aucune");

/** Plus grand numéro de l'année + 1 (DB-AAAA-NNNN), comme la création d'un budget individuel. */
export async function prochainNumeroBudget(db: Db): Promise<string> {
  const year = new Date().getFullYear();
  const existants = await db.demandeBudget.findMany({ where: { numero: { startsWith: `DB-${year}-` } }, select: { numero: true } });
  const max = existants.reduce((m, d) => Math.max(m, parseInt(d.numero.split("-")[2] ?? "0", 10) || 0), 0);
  return `DB-${year}-${String(max + 1).padStart(4, "0")}`;
}

/** Budget mensuel déjà ouvert (non rejeté) pour ce mois — un seul par mois. */
export async function mensuelDuMois(db: Db, periode: Date) {
  return db.demandeBudget.findFirst({
    where: {
      type: TypeBudget.MENSUEL,
      statut: { not: StatutDemandeBudget.REJETEE },
      periodeMois: { gte: new Date(Date.UTC(periode.getUTCFullYear(), periode.getUTCMonth(), 1)), lt: new Date(Date.UTC(periode.getUTCFullYear(), periode.getUTCMonth() + 1, 1)) },
    },
    select: { id: true, numero: true, statut: true, collectif: true },
  });
}

/** Emails des comptes actifs rattachés à ces départements (sans `exclure`). */
export async function membresDepartements(db: Db, departementIds: string[], exclure: string[] = []): Promise<string[]> {
  if (departementIds.length === 0) return [];
  const liens = await db.utilisateurDepartement.findMany({
    where: { departementId: { in: departementIds }, user: { active: true } },
    select: { user: { select: { email: true } } },
  });
  const sans = new Set(exclure.map((e) => e.toLowerCase()));
  return [...new Set(liens.map((l) => l.user.email.toLowerCase()))].filter((e) => !sans.has(e));
}

/** Emails des comptes actifs dont le rôle a le droit « Préparer et soumettre les budgets collectifs ». */
export async function preparateurs(db: Db): Promise<string[]> {
  const users = await db.user.findMany({
    where: { active: true, role: { permissions: { some: { permission: "budget.preparer" } }, pages: { some: { page: "budget" } } } },
    select: { email: true },
  });
  return users.map((u) => u.email.toLowerCase());
}

async function recalculerMontant(db: Db, demandeBudgetId: string) {
  const lignes = await db.demandeBudgetLigne.findMany({ where: { demandeBudgetId, statutValidation: { not: StatutLigneBudget.RETIREE } }, select: { montant: true } });
  await db.demandeBudget.update({ where: { id: demandeBudgetId }, data: { montantTotal: lignes.reduce((s, l) => s + Number(l.montant), 0) } });
}

// ── Ouverture ─────────────────────────────────────────────────────────────────────────────────

export const ouvertureSchema = z.object({
  type: z.enum(["MENSUEL", "CAMPAGNE"], { error: "Seuls les budgets mensuels et de campagne peuvent être collectifs." }),
  periodeMois: z.string().optional(),
  proformaId: z.string().optional(),
  contexteMotivation: z.string().trim().min(1, "Le contexte et la motivation sont requis."),
  departementIds: z.array(z.string()).optional(),
  dateLimiteSaisie: z.string().nullable().optional(),
});

/**
 * Ouvre un budget collectif EN_PREPARATION, sans ligne : mensuel (droit « Préparer et soumettre », un
 * seul par mois, tous les départements actifs invités par défaut) ou campagne (sa proforma, les
 * départements choisis). Le créateur en est le responsable.
 */
export async function ouvrirBudgetCollectif(db: Db, c: CompteCollectif, brut: unknown) {
  const v = ouvertureSchema.safeParse(brut);
  if (!v.success) throw new BudgetCollectifError(v.error.issues[0]?.message ?? "Données invalides.");
  const d = v.data;
  const dateLimite = d.dateLimiteSaisie ? toDateJour(d.dateLimiteSaisie) : null;
  if (d.dateLimiteSaisie && !dateLimite) throw new BudgetCollectifError("La date limite de saisie n'est pas une date valide.");

  let periodeMois: Date | null = null;
  let departementIds = [...new Set(d.departementIds ?? [])];
  if (d.type === "MENSUEL") {
    if (!c.preparer) throw new BudgetCollectifError("Le budget mensuel est ouvert par le comptable (droit « Préparer et soumettre les budgets collectifs »).", 403);
    periodeMois = toPeriodeMois(d.periodeMois);
    if (!periodeMois) throw new BudgetCollectifError("Le mois du budget mensuel est requis.");
    if (!moisMensuelAccepte(periodeMois)) throw new BudgetCollectifError("Ce mois est terminé : un budget mensuel ne peut viser que le mois en cours ou un mois à venir.");
    const existant = await mensuelDuMois(db, periodeMois);
    if (existant) {
      throw new BudgetCollectifError(`Le budget mensuel de ce mois existe déjà (${existant.numero}) : ajoutez-y vos lignes.`, 409, { existant });
    }
    if (departementIds.length === 0) {
      departementIds = (await db.departement.findMany({ where: { actif: true }, select: { id: true } })).map((x) => x.id);
    }
  } else {
    if (!d.proformaId) throw new BudgetCollectifError("Un budget de campagne doit être associé à sa proforma.");
    const proforma = await db.invoice.findUnique({ where: { id: d.proformaId }, select: { id: true } });
    if (!proforma) throw new BudgetCollectifError("Proforma introuvable.");
    if (departementIds.length === 0) throw new BudgetCollectifError("Choisissez au moins un département invité.");
  }
  const erreurDep = await erreurDepartementsLignes(db, departementIds);
  if (erreurDep) throw new BudgetCollectifError(erreurDep);

  // Moyen « principal » du budget : recalculé à la soumission (celui du plus gros montant).
  const moyen = await db.moyenPaiement.findFirst({ where: { actif: true }, orderBy: { ordre: "asc" }, select: { code: true } });
  if (!moyen) throw new BudgetCollectifError("Aucun moyen de paiement actif : voyez Finance → Moyens de paiement.");

  const demande = await db.demandeBudget.create({
    data: {
      numero: await prochainNumeroBudget(db),
      type: d.type,
      statut: StatutDemandeBudget.EN_PREPARATION,
      collectif: true,
      periodeMois,
      requesterEmail: c.email,
      requesterName: c.name,
      responsableEmail: c.email,
      responsableNom: c.name,
      contexteMotivation: d.contexteMotivation,
      montantTotal: 0,
      modePaiement: moyen.code,
      typeDepense: "",
      dateLimiteSaisie: dateLimite,
      departementsInvites: { create: departementIds.map((departementId) => ({ departementId })) },
      ...(d.type === "CAMPAGNE" ? { proformas: { create: [{ invoiceId: d.proformaId! }] } } : {}),
    },
    include: { lignes: true, departementsInvites: { include: { departement: { select: { nom: true } } } } },
  });
  const noms = demande.departementsInvites.map((x) => x.departement.nom);
  await logBudget(db, {
    demandeBudgetId: demande.id,
    action: ActionBudget.PREPARATION,
    auteurEmail: c.email,
    auteurNom: c.name,
    details: `Budget collectif ouvert en préparation — départements invités : ${noms.join(", ")} — date limite de saisie : ${dateFr(dateLimite)}`,
  });
  if (d.type === "CAMPAGNE") {
    await journaliserProforma(db, d.proformaId!, "BUDGET_LIE", `Budget collectif ${demande.numero} ouvert pour cette proforma (départements : ${noms.join(", ")})`, { email: c.email, nom: c.name }, { demandeBudgetId: demande.id });
  }
  return { demande, departementIds, noms };
}

// ── Actions de préparation ────────────────────────────────────────────────────────────────────

const ligneSchema = z.object({
  designation: z.string().trim().min(1, "La désignation est requise."),
  departementId: z.string().min(1, "Choisissez le département de la ligne."),
  categorie: z.nativeEnum(CategorieDepense, { error: "Choisissez une catégorie." }),
  modePaiement: codeMoyenSchema,
  montant: z.number().positive("Le montant doit être supérieur à 0."),
  detail: z.string().trim().max(2000, "Le détail est limité à 2000 caractères.").optional(),
  dateLimite: z.string().optional().refine((v) => !v || toDateJour(v) !== null, "Le délai n'est pas une date valide."),
});

// Opérations sur les lignes, seules ou regroupées (« Enregistrer » d'un département : tableau modifiable).
const operationLigneSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ajouterLigne"), ligne: ligneSchema }),
  z.object({ action: z.literal("modifierLigne"), ligneId: z.string(), ligne: ligneSchema }),
  z.object({ action: z.literal("supprimerLigne"), ligneId: z.string() }),
]);
type OperationLigne = z.infer<typeof operationLigneSchema>;

export const actionSchema = z.discriminatedUnion("action", [
  ...operationLigneSchema.options,
  z.object({
    action: z.literal("enregistrerLignes"),
    operations: z.array(operationLigneSchema).min(1, "Aucune modification à enregistrer.").max(200, "200 modifications au plus à la fois."),
  }),
  z.object({ action: z.literal("inviter"), departementIds: z.array(z.string()).min(1, "Choisissez au moins un département.") }),
  z.object({ action: z.literal("retirerInvitation"), departementId: z.string() }),
  z.object({ action: z.literal("dateLimite"), dateLimiteSaisie: z.string().nullable() }),
  z.object({ action: z.literal("transferer"), email: z.string().trim().min(3, "Choisissez le nouveau responsable.") }),
  z.object({ action: z.literal("pret") }),
  z.object({ action: z.literal("correction"), ligneId: z.string(), motif: z.string().trim().min(3, "Indiquez ce qu'il faut corriger.") }),
  z.object({ action: z.literal("retirerLigne"), ligneId: z.string(), motif: z.string().trim().min(3, "Indiquez le motif du retrait.") }),
  z.object({ action: z.literal("soumettre") }),
  z.object({ action: z.literal("rouvrir") }),
]);
export type ActionPreparation = z.infer<typeof actionSchema>;

/** Ce que la route doit notifier après la transaction. */
export type SuiteNotification =
  | { type: "invitation"; departementIds: string[]; noms: string[] }
  | { type: "correction"; ligneId: string; retiree: boolean; motif: string }
  | { type: "pret" }
  | { type: "soumise" }
  | null;

const chargerBudget = (db: Db, id: string) =>
  db.demandeBudget.findUnique({ where: { id }, include: { lignes: true, departementsInvites: { include: { departement: { select: { id: true, nom: true } } } } } });

/**
 * Applique une action de préparation (dans une transaction). Droits :
 * - lignes (ajouter / modifier / supprimer) : membres du département invité avant la date limite,
 *   responsable et comptable à tout moment de la préparation ;
 * - invitations, date limite, transfert : responsable ou comptable (transfert : aussi l'administrateur) ;
 * - « prêt à soumettre » : responsable ;
 * - correction, retrait avec motif, soumission, réouverture : comptable (droit « Préparer et soumettre »).
 */
export async function appliquerActionPreparation(db: Db, c: CompteCollectif, id: string, a: ActionPreparation): Promise<{ suite: SuiteNotification; message: string }> {
  await db.$queryRaw`SELECT id FROM "DemandeBudget" WHERE id = ${id} FOR UPDATE`;
  const b = await chargerBudget(db, id);
  if (!b) throw new BudgetCollectifError("Budget introuvable.", 404);
  if (!b.collectif) throw new BudgetCollectifError("Ce budget n'est pas un budget collectif.");
  const responsable = estResponsable(c, b);
  const coordinateur = responsable || c.preparer;
  const enPreparation = b.statut === StatutDemandeBudget.EN_PREPARATION;
  const auteur = { auteurEmail: c.email, auteurNom: c.name };
  const exigerPreparation = () => {
    if (!enPreparation) throw new BudgetCollectifError("Ce budget n'est plus en préparation.");
  };
  const saLigne = (l: { departementId: string | null; ajouteeParEmail: string | null }) => estSaLigne(c, l);
  const ligneDuBudget = (ligneId: string) => {
    const l = b.lignes.find((x) => x.id === ligneId);
    if (!l) throw new BudgetCollectifError("Cette ligne n'appartient pas à ce budget.", 404);
    return l;
  };

  switch (a.action) {
    case "enregistrerLignes": {
      // Tout ou rien : chaque opération passe par les mêmes contrôles qu'une ligne seule, dans la même
      // transaction ; la première refusée annule tout, avec le nom de la ligne dans le message.
      exigerPreparation();
      const nom = (op: OperationLigne) =>
        op.action === "supprimerLigne" ? b.lignes.find((l) => l.id === op.ligneId)?.designation ?? "ligne" : op.ligne.designation || "nouvelle ligne";
      for (const op of a.operations) {
        try {
          await appliquerActionPreparation(db, c, id, op);
        } catch (e) {
          if (e instanceof BudgetCollectifError) throw new BudgetCollectifError(`« ${nom(op)} » : ${e.message}`, e.status);
          throw e;
        }
      }
      const n = a.operations.length;
      return { suite: null, message: n === 1 ? "Modification enregistrée." : `${n} modifications enregistrées.` };
    }

    case "ajouterLigne":
    case "modifierLigne": {
      exigerPreparation();
      // Une ligne renvoyée en correction se corrige même après la date limite (pas un nouvel ajout).
      const enCorrection =
        a.action === "modifierLigne" && b.lignes.some((x) => x.id === a.ligneId && x.statutValidation === StatutLigneBudget.A_CORRIGER);
      const refus = refusSaisieDepartement(c, b, a.ligne.departementId, new Date(), { ignorerDateLimite: enCorrection });
      if (refus) throw new BudgetCollectifError(refus, 403);
      const erreurMoyen = await erreurMoyensPaiement(db, [a.ligne.modePaiement]);
      if (erreurMoyen) throw new BudgetCollectifError(erreurMoyen);
      const donnees = {
        designation: a.ligne.designation,
        departementId: a.ligne.departementId,
        categorie: a.ligne.categorie,
        modePaiement: a.ligne.modePaiement,
        montant: a.ligne.montant,
        detail: a.ligne.detail || null,
        dateLimite: toDateJour(a.ligne.dateLimite),
      };
      if (a.action === "ajouterLigne") {
        await db.demandeBudgetLigne.create({ data: { ...donnees, demandeBudgetId: id, ajouteeParEmail: c.email, ajouteeParNom: c.name } });
        await recalculerMontant(db, id);
        await logBudget(db, { demandeBudgetId: id, action: ActionBudget.LIGNE_AJOUTEE, ...auteur, montant: a.ligne.montant, details: `${b.departementsInvites.find((x) => x.departementId === a.ligne.departementId)?.departement.nom ?? ""} — ${a.ligne.designation}` });
        return { suite: null, message: "Ligne ajoutée." };
      }
      const l = ligneDuBudget(a.ligneId);
      if (l.statutValidation === StatutLigneBudget.RETIREE) throw new BudgetCollectifError("Cette ligne a été retirée : elle ne se modifie plus.");
      const corrigee = l.statutValidation === StatutLigneBudget.A_CORRIGER;
      // Une ligne renvoyée en correction se corrige même après la date limite.
      const refusActuel = l.departementId ? refusSaisieDepartement(c, b, l.departementId, new Date(), { ignorerDateLimite: corrigee }) : "Ligne sans département.";
      if (refusActuel) throw new BudgetCollectifError(refusActuel, 403);
      // Ni le responsable ni le comptable ne modifient la ligne d'un autre département (le comptable
      // demande une correction ou la retire) : seulement ses départements, ou les lignes qu'on a saisies.
      if (!saLigne(l)) throw new BudgetCollectifError("Demandez une correction au département, ou retirez la ligne avec un motif.", 403);
      await db.demandeBudgetLigne.update({
        where: { id: l.id },
        data: { ...donnees, statutValidation: StatutLigneBudget.EN_ATTENTE, montantAccorde: null, ...(corrigee ? { decideParEmail: null, decideAt: null } : {}) },
      });
      await recalculerMontant(db, id);
      await logBudget(db, {
        demandeBudgetId: id,
        action: corrigee ? ActionBudget.LIGNE_CORRIGEE : ActionBudget.LIGNE_MODIFIEE,
        ...auteur,
        montant: a.ligne.montant,
        details: `${l.designation} (${fcfa(Number(l.montant))}) → ${a.ligne.designation} (${fcfa(a.ligne.montant)})`,
      });
      return { suite: null, message: corrigee ? "Ligne corrigée." : "Ligne modifiée." };
    }

    case "supprimerLigne": {
      exigerPreparation();
      const l = ligneDuBudget(a.ligneId);
      const refus = l.departementId ? refusSaisieDepartement(c, b, l.departementId) : "Ligne sans département.";
      if (refus) throw new BudgetCollectifError(refus, 403);
      if (!saLigne(l)) throw new BudgetCollectifError("Retirez la ligne d'un département avec un motif (« Retirer »).", 403);
      // Ses documents justificatifs partent avec elle (ils ne justifient plus rien).
      const docs = await db.demandeBudgetAttachment.findMany({ where: { ligneId: l.id }, select: { fileName: true } });
      await db.demandeBudgetAttachment.deleteMany({ where: { ligneId: l.id } });
      await db.demandeBudgetLigne.delete({ where: { id: l.id } });
      await recalculerMontant(db, id);
      await logBudget(db, {
        demandeBudgetId: id,
        action: ActionBudget.LIGNE_RETIREE,
        ...auteur,
        montant: Number(l.montant),
        details: `${l.designation} — supprimée par son département pendant la préparation${docs.length ? ` (documents retirés : ${docs.map((d) => d.fileName).join(", ")})` : ""}`,
      });
      return { suite: null, message: "Ligne supprimée." };
    }

    case "inviter": {
      exigerPreparation();
      if (!coordinateur) throw new BudgetCollectifError("Seuls le responsable du budget et le comptable invitent des départements.", 403);
      const nouveaux = [...new Set(a.departementIds)].filter((d) => !b.departementsInvites.some((x) => x.departementId === d));
      if (nouveaux.length === 0) throw new BudgetCollectifError("Ces départements sont déjà invités.");
      const erreur = await erreurDepartementsLignes(db, nouveaux);
      if (erreur) throw new BudgetCollectifError(erreur);
      await db.demandeBudgetDepartement.createMany({ data: nouveaux.map((departementId) => ({ demandeBudgetId: id, departementId })) });
      const noms = (await db.departement.findMany({ where: { id: { in: nouveaux } }, select: { nom: true } })).map((x) => x.nom);
      await logBudget(db, { demandeBudgetId: id, action: ActionBudget.PREPARATION, ...auteur, details: `Départements invités : ${noms.join(", ")}` });
      return { suite: { type: "invitation", departementIds: nouveaux, noms }, message: "Départements invités." };
    }

    case "retirerInvitation": {
      exigerPreparation();
      if (!coordinateur) throw new BudgetCollectifError("Seuls le responsable du budget et le comptable retirent un département.", 403);
      const inv = b.departementsInvites.find((x) => x.departementId === a.departementId);
      if (!inv) throw new BudgetCollectifError("Ce département n'est pas invité.");
      if (b.lignes.some((l) => l.departementId === a.departementId && l.statutValidation !== StatutLigneBudget.RETIREE)) {
        throw new BudgetCollectifError(`Le département ${inv.departement.nom} a déjà des lignes : retirez-les d'abord.`);
      }
      await db.demandeBudgetDepartement.delete({ where: { demandeBudgetId_departementId: { demandeBudgetId: id, departementId: a.departementId } } });
      await logBudget(db, { demandeBudgetId: id, action: ActionBudget.PREPARATION, ...auteur, details: `Département retiré des invités : ${inv.departement.nom}` });
      return { suite: null, message: "Département retiré." };
    }

    case "dateLimite": {
      exigerPreparation();
      if (!coordinateur) throw new BudgetCollectifError("Seuls le responsable du budget et le comptable changent la date limite.", 403);
      const date = a.dateLimiteSaisie ? toDateJour(a.dateLimiteSaisie) : null;
      if (a.dateLimiteSaisie && !date) throw new BudgetCollectifError("La date limite n'est pas une date valide.");
      await db.demandeBudget.update({ where: { id }, data: { dateLimiteSaisie: date, rappelSaisieEnvoyeAt: null } });
      await logBudget(db, { demandeBudgetId: id, action: ActionBudget.PREPARATION, ...auteur, details: `Date limite de saisie : ${dateFr(date)}` });
      return { suite: null, message: "Date limite enregistrée." };
    }

    case "transferer": {
      if (!coordinateur && !c.canManageUsers) throw new BudgetCollectifError("Seuls le responsable, le comptable ou l'administrateur transfèrent la responsabilité.", 403);
      const cible = await db.user.findFirst({ where: { email: { equals: a.email, mode: "insensitive" }, active: true }, select: { email: true, nom: true } });
      if (!cible) throw new BudgetCollectifError("Aucun compte actif avec cette adresse.");
      await db.demandeBudget.update({ where: { id }, data: { responsableEmail: cible.email.toLowerCase(), responsableNom: cible.nom } });
      await logBudget(db, { demandeBudgetId: id, action: ActionBudget.PREPARATION, ...auteur, details: `Responsable du budget : ${b.responsableNom ?? b.responsableEmail ?? b.requesterEmail} → ${cible.nom} (${cible.email})` });
      return { suite: null, message: `Responsable : ${cible.nom}.` };
    }

    case "pret": {
      exigerPreparation();
      if (!responsable) throw new BudgetCollectifError("Seul le responsable du budget signale qu'il est prêt.", 403);
      await db.demandeBudget.update({ where: { id }, data: { pretASoumettreAt: new Date() } });
      await logBudget(db, { demandeBudgetId: id, action: ActionBudget.PREPARATION, ...auteur, details: "Signalé prêt à soumettre au comptable" });
      return { suite: { type: "pret" }, message: "Le comptable est prévenu." };
    }

    case "correction":
    case "retirerLigne": {
      exigerPreparation();
      if (!c.preparer) throw new BudgetCollectifError("Réservé au comptable (droit « Préparer et soumettre les budgets collectifs »).", 403);
      const l = ligneDuBudget(a.ligneId);
      if (l.statutValidation === StatutLigneBudget.RETIREE) throw new BudgetCollectifError("Cette ligne est déjà retirée.");
      const retiree = a.action === "retirerLigne";
      await db.demandeBudgetLigne.update({
        where: { id: l.id },
        data: { statutValidation: retiree ? StatutLigneBudget.RETIREE : StatutLigneBudget.A_CORRIGER, motifDecision: a.motif, decideParEmail: c.email, decideAt: new Date(), montantAccorde: null },
      });
      if (retiree) await recalculerMontant(db, id);
      await logBudget(db, {
        demandeBudgetId: id,
        action: retiree ? ActionBudget.LIGNE_RETIREE : ActionBudget.LIGNE_A_CORRIGER,
        ...auteur,
        montant: Number(l.montant),
        details: `${l.designation} — ${retiree ? "retirée" : "à corriger"} pendant la préparation : ${a.motif}`,
      });
      return { suite: { type: "correction", ligneId: l.id, retiree, motif: a.motif }, message: retiree ? "Ligne retirée." : "Correction demandée au département." };
    }

    case "soumettre": {
      exigerPreparation();
      if (!c.preparer) throw new BudgetCollectifError("La soumission à la direction est faite par le comptable (droit « Préparer et soumettre les budgets collectifs »).", 403);
      const actives = b.lignes.filter((l) => l.statutValidation !== StatutLigneBudget.RETIREE);
      if (actives.length === 0) throw new BudgetCollectifError("Aucune ligne à soumettre.");
      const aCorriger = actives.filter((l) => l.statutValidation === StatutLigneBudget.A_CORRIGER);
      if (aCorriger.length > 0) {
        throw new BudgetCollectifError(`${aCorriger.length} ligne(s) attendent encore leur correction : « ${aCorriger.map((l) => l.designation).join(" », « ")} ». Attendez la correction ou retirez-les.`);
      }
      // Moyen principal : celui du plus gros montant (comme le formulaire d'un budget individuel).
      const parMoyen = new Map<string, number>();
      for (const l of actives) if (l.modePaiement) parMoyen.set(l.modePaiement, (parMoyen.get(l.modePaiement) ?? 0) + Number(l.montant));
      const principal = [...parMoyen.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? b.modePaiement;
      const total = actives.reduce((s, l) => s + Number(l.montant), 0);
      await db.demandeBudgetLigne.updateMany({
        where: { demandeBudgetId: id, statutValidation: { not: StatutLigneBudget.RETIREE } },
        data: { statutValidation: StatutLigneBudget.EN_ATTENTE, montantAccorde: null, decideParEmail: null, decideAt: null },
      });
      await db.demandeBudget.update({ where: { id }, data: { statut: StatutDemandeBudget.SOUMISE, soumiseAt: new Date(), montantTotal: total, modePaiement: principal } });
      const nbDep = new Set(actives.map((l) => l.departementId)).size;
      await logBudget(db, { demandeBudgetId: id, action: ActionBudget.SOUMISSION, ...auteur, montant: total, details: `Soumis à la direction : ${actives.length} ligne(s), ${nbDep} département(s)` });
      return { suite: { type: "soumise" }, message: "Budget soumis à la direction." };
    }

    case "rouvrir": {
      if (!c.preparer) throw new BudgetCollectifError("Réservé au comptable (droit « Préparer et soumettre les budgets collectifs »).", 403);
      if (b.statut !== StatutDemandeBudget.SOUMISE) throw new BudgetCollectifError("Seul un budget soumis, pas encore décidé, peut être rouvert.");
      if (b.lignes.some((l) => l.statutValidation !== StatutLigneBudget.EN_ATTENTE && l.statutValidation !== StatutLigneBudget.RETIREE)) {
        throw new BudgetCollectifError("Une ligne a déjà été décidée par la direction : le budget ne se rouvre plus. Faites un budget ponctuel pour le département oublié.");
      }
      await db.demandeBudget.update({ where: { id }, data: { statut: StatutDemandeBudget.EN_PREPARATION, soumiseAt: null, pretASoumettreAt: null } });
      await logBudget(db, { demandeBudgetId: id, action: ActionBudget.PREPARATION_ROUVERTE, ...auteur, details: "Préparation rouverte (aucune ligne encore décidée)" });
      return { suite: null, message: "Préparation rouverte." };
    }
  }
}

/**
 * Tâche du matin : rappel aux membres des départements invités, la veille de la date limite de
 * saisie (une seule fois par budget ; remis à zéro si la date change).
 */
export async function notifierRappelsSaisie(maintenant: Date = new Date()): Promise<string> {
  const budgets = await budgetsARappeler(prisma, maintenant);
  for (const b of budgets) {
    const to = await membresDepartements(prisma, b.departementsInvites.map((d) => d.departementId));
    await sendBudgetCollectifRappel(b, { to });
    await prisma.demandeBudget.update({ where: { id: b.id }, data: { rappelSaisieEnvoyeAt: maintenant } });
  }
  return budgets.length === 0 ? "aucune date limite de saisie demain" : `${budgets.length} rappel(s) de saisie envoyé(s)`;
}

/** Budgets en préparation dont la date limite de saisie est demain (rappel pas encore envoyé). */
export async function budgetsARappeler(db: Db, maintenant: Date = new Date()) {
  const demain = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate() + 1));
  const apres = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate() + 2));
  return db.demandeBudget.findMany({
    where: { statut: StatutDemandeBudget.EN_PREPARATION, collectif: true, rappelSaisieEnvoyeAt: null, dateLimiteSaisie: { gte: demain, lt: apres } },
    include: { lignes: true, departementsInvites: { select: { departementId: true } } },
  });
}
