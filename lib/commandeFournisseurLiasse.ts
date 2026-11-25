// Liasse d'un bon de commande fournisseur (procédure de paiement, section 4) — calculs purs,
// importables côté navigateur. Pièces de la liasse :
//   1. le bon de commande signé par la DG (requis : aucun paiement sans lui) ;
//   2. la proforma fournisseur (attendue, en rouge si absente, mais ne bloque pas le paiement) :
//      jointe au bon, ou reprise des proformas fournisseur jointes au budget ;
//   3. le BAT signé (facultatif) ;
//   4. le bordereau de livraison signé OU l'attestation de service fait (requis pour le solde) ;
//   5. la facture (facture fournisseur rattachée avec sa pièce, ou document « Facture ») (requise
//      pour le solde) ;
//   + autant de documents « Autre » que nécessaire (libellé précisé). Le rapport n'est plus demandé.
// L'avance est versée sur BC signé ; elle reste « non justifiée » (rouge) tant que les pièces
// requises du solde manquent, et le solde n'est payable qu'avec elles (réglage « liasse exigée »).

/** Types proposés à l'ajout d'une pièce (RAPPORT n'est plus proposé). */
export const TYPES_DOCUMENT_COMMANDE = [
  "BC_SIGNE",
  "PROFORMA_FOURNISSEUR",
  "BAT_SIGNE",
  "BORDEREAU_LIVRAISON",
  "ATTESTATION_SERVICE_FAIT",
  "FACTURE",
  "AUTRE",
] as const;
export type TypeDocumentCommandeValue = (typeof TYPES_DOCUMENT_COMMANDE)[number] | "RAPPORT";

export const TYPE_DOCUMENT_COMMANDE_LABELS: Record<TypeDocumentCommandeValue, string> = {
  BC_SIGNE: "Bon de commande signé (DG)",
  PROFORMA_FOURNISSEUR: "Proforma fournisseur",
  BAT_SIGNE: "BAT signé",
  BORDEREAU_LIVRAISON: "Bordereau de livraison signé",
  ATTESTATION_SERVICE_FAIT: "Attestation de service fait",
  FACTURE: "Facture",
  RAPPORT: "Rapport (ancien)",
  AUTRE: "Autre document",
};

/** Libellé affiché d'une pièce : son type, précisé par le libellé pour « Autre ». */
export function libellePiece(d: { kind: string; libelle?: string | null }): string {
  const type = TYPE_DOCUMENT_COMMANDE_LABELS[d.kind as TypeDocumentCommandeValue] ?? d.kind;
  return d.libelle ? (d.kind === "AUTRE" ? d.libelle : `${type} — ${d.libelle}`) : type;
}

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
  proformaFournisseur: boolean;
  bat: boolean; // facultatif
  livraison: boolean; // bordereau signé OU attestation de service fait
  facture: boolean;
  /** Pièces requises pour le solde présentes : BC signé, livraison, facture. */
  complete: boolean;
  /** Pièces attendues présentes (BC signé, proforma fournisseur, livraison, facture), sur NB_PIECES_ATTENDUES. */
  nbPieces: number;
  /** Pièces requises pour le solde qui manquent (messages de blocage). */
  manquantes: string[];
  /** Toutes les pièces attendues qui manquent (y compris la proforma fournisseur) : rappels en rouge. */
  aJoindre: string[];
}

export const NB_PIECES_ATTENDUES = 4;

export function etatLiasse(
  documents: { kind: string }[],
  factures: { pieceJointe: string | null; status?: string }[] = []
): EtatLiasse {
  const a = (kind: string) => documents.some((d) => d.kind === kind);
  const bcSigne = a("BC_SIGNE");
  const proformaFournisseur = a("PROFORMA_FOURNISSEUR");
  const bat = a("BAT_SIGNE");
  const livraison = a("BORDEREAU_LIVRAISON") || a("ATTESTATION_SERVICE_FAIT");
  const facture = a("FACTURE") || factures.some((f) => !!f.pieceJointe && f.status !== "ANNULEE");
  const manquantes = [
    !bcSigne && "bon de commande signé",
    !livraison && "bordereau de livraison signé ou attestation de service fait",
    !facture && "facture",
  ].filter(Boolean) as string[];
  const aJoindre = [
    !bcSigne && "bon de commande signé",
    !proformaFournisseur && "proforma fournisseur",
    !livraison && "bordereau de livraison signé ou attestation de service fait",
    !facture && "facture",
  ].filter(Boolean) as string[];
  return {
    bcSigne,
    proformaFournisseur,
    bat,
    livraison,
    facture,
    complete: manquantes.length === 0,
    nbPieces: NB_PIECES_ATTENDUES - aJoindre.length,
    manquantes,
    aJoindre,
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
