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
  PAYEE: [], // posé automatiquement au dernier paiement (jamais à la main)
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

// ── Lignes de produit d'un bon de commande : part, payé, reste ─────────────────────────────────
// La part d'une ligne dans le montant net du bon = montant net × prix total de la ligne / total HT
// (TVA et AIB répartis au même prorata). Le payé vient des imputations non annulées.

export interface LigneCommandePart {
  id: string;
  designation: string;
  part: number;
  paye: number;
  reste: number;
}

const arrondi = (n: number) => Math.round(n * 100) / 100;

export function partsLignesCommande(c: {
  montantNet: number | string | { toString(): string };
  totalHT: number | string | { toString(): string };
  lignes: { id: string; designation: string; prixTotal: number | string | { toString(): string } }[];
  imputations: { ligneCommandeId: string; montant: number | string | { toString(): string }; annuleeAt?: Date | string | null }[];
}): LigneCommandePart[] {
  const net = Number(c.montantNet);
  const ht = Number(c.totalHT);
  let cumul = 0;
  return c.lignes.map((l, i) => {
    const derniere = i === c.lignes.length - 1;
    const part = derniere ? arrondi(net - cumul) : arrondi(ht > 0 ? (net * Number(l.prixTotal)) / ht : net / c.lignes.length);
    cumul += part;
    const paye = c.imputations
      .filter((x) => x.ligneCommandeId === l.id && !x.annuleeAt)
      .reduce((s, x) => s + Number(x.montant), 0);
    return { id: l.id, designation: l.designation, part, paye: arrondi(paye), reste: arrondi(part - paye) };
  });
}

/**
 * Répartit un paiement « tout le bon » sur les lignes de produit, au prorata de leur reste (une
 * ligne déjà soldée ne reçoit rien). La dernière ligne servie absorbe l'arrondi : la somme est exacte.
 */
export function repartirAuProrata(montant: number, parts: LigneCommandePart[]): { ligneCommandeId: string; montant: number }[] {
  const servies = parts.filter((p) => p.reste > 0.004);
  const resteTotal = servies.reduce((s, p) => s + p.reste, 0);
  if (servies.length === 0 || resteTotal <= 0) return [];
  let cumul = 0;
  return servies.map((p, i) => {
    const m = i === servies.length - 1 ? arrondi(montant - cumul) : arrondi((montant * p.reste) / resteTotal);
    cumul += m;
    return { ligneCommandeId: p.id, montant: m };
  });
}
