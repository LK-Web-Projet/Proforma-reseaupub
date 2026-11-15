// Liasse d'un bon de commande fournisseur (procédure de paiement, section 4) — calculs purs,
// importables côté navigateur. La liasse est complète avec :
//   1. le bon de commande signé par la DG ;
//   2. le bordereau de livraison OU l'attestation de service fait ;
//   3. la facture (document « Facture », ou facture fournisseur rattachée avec sa pièce) ;
//   4. le rapport.
// L'avance est versée sur BC signé ; elle reste « non justifiée » (rouge) tant que la liasse est
// incomplète, et le solde n'est payable qu'avec la liasse complète.

export const TYPES_DOCUMENT_COMMANDE = [
  "BC_SIGNE",
  "BORDEREAU_LIVRAISON",
  "ATTESTATION_SERVICE_FAIT",
  "FACTURE",
  "RAPPORT",
  "AUTRE",
] as const;
export type TypeDocumentCommandeValue = (typeof TYPES_DOCUMENT_COMMANDE)[number];

export const TYPE_DOCUMENT_COMMANDE_LABELS: Record<TypeDocumentCommandeValue, string> = {
  BC_SIGNE: "Bon de commande signé (DG)",
  BORDEREAU_LIVRAISON: "Bordereau de livraison",
  ATTESTATION_SERVICE_FAIT: "Attestation de service fait",
  FACTURE: "Facture",
  RAPPORT: "Rapport",
  AUTRE: "Autre",
};

/** Statuts suivants autorisés d'un bon de commande (aucun retour en arrière). VALIDEE = signé par la DG. */
export const TRANSITIONS_COMMANDE: Record<string, readonly string[]> = {
  BROUILLON: ["VALIDEE", "ANNULEE"],
  VALIDEE: ["LIVREE", "ANNULEE"],
  LIVREE: [],
  ANNULEE: [],
};

export const NATURE_DEPENSE_LABELS: Record<string, string> = {
  NORMALE: "Dépense",
  AVANCE: "Avance",
  SOLDE: "Solde",
};

export interface EtatLiasse {
  bcSigne: boolean;
  livraison: boolean; // bordereau OU attestation de service fait
  facture: boolean;
  rapport: boolean;
  complete: boolean;
  nbPieces: number; // sur 4
  manquantes: string[];
}

export function etatLiasse(
  documents: { kind: string }[],
  factures: { pieceJointe: string | null; status?: string }[] = []
): EtatLiasse {
  const a = (kind: string) => documents.some((d) => d.kind === kind);
  const bcSigne = a("BC_SIGNE");
  const livraison = a("BORDEREAU_LIVRAISON") || a("ATTESTATION_SERVICE_FAIT");
  const facture = a("FACTURE") || factures.some((f) => !!f.pieceJointe && f.status !== "ANNULEE");
  const rapport = a("RAPPORT");
  const manquantes = [
    !bcSigne && "bon de commande signé",
    !livraison && "bordereau de livraison ou attestation de service fait",
    !facture && "facture",
    !rapport && "rapport",
  ].filter(Boolean) as string[];
  return {
    bcSigne,
    livraison,
    facture,
    rapport,
    complete: manquantes.length === 0,
    nbPieces: 4 - manquantes.length,
    manquantes,
  };
}

/** Somme payée sur un BC (dépenses non annulées). */
export function payeSurCommande(depenses: { montant: number | string | { toString(): string }; annuleeAt?: Date | string | null }[]): number {
  return depenses.filter((d) => !d.annuleeAt).reduce((s, d) => s + Number(d.montant), 0);
}
