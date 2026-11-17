// Types et helpers partagés par les routes de reporting basées sur le journal de caisse
// (app/api/dashboard/route.ts — vues "Ce mois"/"Général" — et les rapports sous
// app/api/rapports/*), pour éviter de dupliquer la logique entre plusieurs granularités
// temporelles (jour/mois/semaine).

export interface DetailClient { id: string; nom: string }
export interface RecetteDetailLine { id: number; libelle: string; montant: number; caisse: string; client: DetailClient | null; resteAPayer: number }
export interface DepenseDetailLine { id: number; libelle: string; montant: number; caisse: string; client: DetailClient | null }
export interface ProformaValideeDetailLine { id: string; numero: string; totalTTC: number; client: DetailClient | null }

// --- Dépenses de budget annulées ------------------------------------------------------
// Une dépense de budget annulée garde son écriture DEPENSE d'origine et reçoit une
// contre-écriture RECETTE (voir app/api/demandes-budget/[id]/depenses/[depenseId]/annuler).
// Le couple s'annule dans le solde réel, mais ne doit apparaître ni dans les "Dépenses" ni
// dans les "Autres mouvements" des rapports. Sélection Prisma à ajouter aux requêtes :
export const BUDGET_ANNULATION_SELECT = {
  budgetDepense: { select: { annuleeAt: true } },
  budgetDepenseAnnulee: { select: { id: true } },
} as const;

export interface BudgetAnnulationFields {
  budgetDepense?: { annuleeAt: Date | null } | null;
  budgetDepenseAnnulee?: { id: string } | null;
}

/** Vrai pour une dépense de budget annulée ou pour sa contre-écriture : à ignorer dans les rapports. */
export function isEcritureBudgetAnnulee(e: BudgetAnnulationFields): boolean {
  return !!e.budgetDepense?.annuleeAt || !!e.budgetDepenseAnnulee;
}

// --- Détection des transferts internes entre caisses visibles -----------------------
// Reprend exactement la logique de app/(main)/journal-caisse/page.tsx (totalRecettesGlobal/
// totalDepensesGlobal) : un virement entre deux caisses crée deux lignes réelles
// ("Transfert depuis/vers caisse ID X"), à exclure des totaux bruts uniquement si les DEUX
// extrémités sont des caisses visibles (sinon c'est un vrai flux externe).
export function isInternalTransferIn(libelle: string, visibleIds: Set<number>): boolean {
  const m = libelle.match(/Transfert depuis caisse ID (\d+)/i);
  return m ? visibleIds.has(parseInt(m[1], 10)) : false;
}
export function isInternalTransferOut(libelle: string, visibleIds: Set<number>): boolean {
  const m = libelle.match(/Transfert vers caisse ID (\d+)/i);
  return m ? visibleIds.has(parseInt(m[1], 10)) : false;
}
