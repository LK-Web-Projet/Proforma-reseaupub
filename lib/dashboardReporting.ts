// Types et helpers partagés par les routes de reporting basées sur le journal de caisse
// (app/api/dashboard/route.ts — vues "Ce mois"/"Général" — et les rapports sous
// app/api/rapports/*), pour éviter de dupliquer la logique entre plusieurs granularités
// temporelles (jour/mois/semaine).

export interface DetailClient { id: string; nom: string }
export interface RecetteDetailLine { id: number; libelle: string; montant: number; caisse: string; client: DetailClient | null; resteAPayer: number }
export interface DepenseDetailLine { id: number; libelle: string; montant: number; caisse: string; client: DetailClient | null }
export interface ProformaValideeDetailLine { id: string; numero: string; totalTTC: number; client: DetailClient | null }

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
