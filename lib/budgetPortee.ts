import type { Prisma } from "@prisma/client";

/**
 * Qui voit quoi dans les budgets, et qui saisit quoi dans un budget collectif (règles du 2026-11-26).
 * Aucun accès à la base ici : partagé par les routes (filtre serveur) et l'écran.
 *
 * - Voit TOUT un budget : le droit « Voir toutes les lignes », le demandeur et le responsable du budget,
 *   et — pour un budget collectif — le comptable qui a le droit « Préparer et soumettre ».
 * - Sinon, dans un budget COLLECTIF : les lignes de ses départements (saisies par soi ou par un collègue
 *   du même département), plus celles qu'on a saisies soi-même ; leur total ; ce qui les concerne.
 * - Un budget individuel d'un autre n'est visible qu'avec le droit « Voir toutes les lignes ».
 */

export interface CompteBudget {
  email: string;
  toutesLignes: boolean;
  preparer: boolean;
  departementIds: string[];
}

export interface BudgetVisible {
  requesterEmail: string;
  responsableEmail?: string | null;
  collectif?: boolean | null;
}

export interface LigneVisible {
  departementId: string | null;
  ajouteeParEmail?: string | null;
}

const meme = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Responsable du budget (à défaut, son demandeur) — transférable : l'ancien responsable ne l'est plus. */
export function estResponsable(c: Pick<CompteBudget, "email">, b: BudgetVisible): boolean {
  return meme(b.responsableEmail ?? b.requesterEmail, c.email);
}

/** Voit toutes les lignes et tous les montants de ce budget (droit, responsable, demandeur, comptable d'un collectif). */
export function voitToutLeBudget(c: CompteBudget, b: BudgetVisible): boolean {
  return c.toutesLignes || estResponsable(c, b) || meme(b.requesterEmail, c.email) || (!!b.collectif && c.preparer);
}

/** Ligne visible : tout le budget, ou une ligne saisie par soi, ou (budget collectif) de ses départements. */
export function ligneVisible(c: CompteBudget, b: BudgetVisible, l: LigneVisible): boolean {
  if (voitToutLeBudget(c, b)) return true;
  if (meme(l.ajouteeParEmail, c.email)) return true;
  return !!b.collectif && !!l.departementId && c.departementIds.includes(l.departementId);
}

/** Accès à la fiche : voit tout, ou budget collectif où l'un de ses départements est invité, ou une ligne visible. */
export function accesAuBudget(
  c: CompteBudget,
  b: BudgetVisible & { departementsInvites?: { departementId: string }[]; lignes?: LigneVisible[] }
): boolean {
  if (voitToutLeBudget(c, b)) return true;
  if (b.collectif && (b.departementsInvites ?? []).some((d) => c.departementIds.includes(d.departementId))) return true;
  return (b.lignes ?? []).some((l) => ligneVisible(c, b, l));
}

/** Filtre de la liste des budgets pour un compte sans le droit « Voir toutes les lignes ». */
export function filtreListeBudgets(c: CompteBudget): Prisma.DemandeBudgetWhereInput | null {
  if (c.toutesLignes) return null;
  const email = { equals: c.email, mode: "insensitive" as const };
  const ou: Prisma.DemandeBudgetWhereInput[] = [
    { requesterEmail: email },
    { responsableEmail: email },
    { lignes: { some: { ajouteeParEmail: email } } },
  ];
  if (c.departementIds.length > 0) {
    ou.push({ collectif: true, departementsInvites: { some: { departementId: { in: c.departementIds } } } });
    ou.push({ collectif: true, lignes: { some: { departementId: { in: c.departementIds } } } });
  }
  if (c.preparer) ou.push({ collectif: true });
  return { OR: ou };
}

/** Fin du jour de la date limite de saisie (la saisie reste ouverte toute la journée). */
export function saisieOuverte(b: { dateLimiteSaisie?: Date | string | null }, maintenant: Date = new Date()): boolean {
  if (!b.dateLimiteSaisie) return true;
  const d = new Date(b.dateLimiteSaisie);
  const fin = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59);
  return maintenant.getTime() <= fin;
}

/**
 * Peut ajouter / modifier / retirer SES lignes pour ce département pendant la préparation : département
 * invité, et soit l'un de ses départements (avant la date limite), soit le responsable ou le comptable
 * (pour un département absent, même après la date limite). Renvoie le motif du refus, ou null.
 */
export function refusSaisieDepartement(
  c: CompteBudget,
  b: BudgetVisible & { statut: string; dateLimiteSaisie?: Date | string | null; departementsInvites: { departementId: string }[] },
  departementId: string,
  maintenant: Date = new Date(),
  opts: { ignorerDateLimite?: boolean } = {}
): string | null {
  if (b.statut !== "EN_PREPARATION") return "Ce budget n'est plus en préparation : ses lignes ne se saisissent plus ici.";
  if (!b.departementsInvites.some((d) => d.departementId === departementId)) return "Ce département n'est pas invité à ce budget.";
  const coordinateur = estResponsable(c, b) || c.preparer;
  if (coordinateur) return null;
  if (!c.departementIds.includes(departementId)) return "Vous ne pouvez saisir que pour vos départements (Paramètres → Utilisateurs).";
  if (!opts.ignorerDateLimite && !saisieOuverte(b, maintenant)) return "La date limite de saisie est passée : voyez le comptable pour la prolonger.";
  return null;
}

/** Ligne « à soi » : de l'un de ses départements, ou saisie par soi (seules celles-là se modifient). */
export function estSaLigne(c: Pick<CompteBudget, "email" | "departementIds">, l: LigneVisible): boolean {
  return (!!l.departementId && c.departementIds.includes(l.departementId)) || meme(l.ajouteeParEmail, c.email);
}

/**
 * Joindre ou retirer un document justificatif d'une ligne (budget collectif, pendant la préparation) :
 * mêmes conditions que modifier la ligne — sa ligne, non retirée, saisie ouverte pour son département
 * (une ligne à corriger reste modifiable après la date limite). Renvoie le motif du refus, ou null.
 */
export function refusDocumentLigne(
  c: CompteBudget,
  b: BudgetVisible & { statut: string; dateLimiteSaisie?: Date | string | null; departementsInvites: { departementId: string }[] },
  l: LigneVisible & { statutValidation: string },
  maintenant: Date = new Date()
): string | null {
  if (!b.collectif) return "Les documents d'une ligne ne concernent que les budgets collectifs.";
  if (l.statutValidation === "RETIREE") return "Cette ligne a été retirée.";
  if (!l.departementId) return "Ligne sans département.";
  if (!estSaLigne(c, l)) return "Seul le département de la ligne joint ou retire ses documents.";
  return refusSaisieDepartement(c, b, l.departementId, maintenant, { ignorerDateLimite: l.statutValidation === "A_CORRIGER" });
}
