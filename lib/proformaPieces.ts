/**
 * Pièces d'une proforma (bon de commande du client, facture normalisée, attestation de bonne fin…)
 * et alertes qui en découlent. Aucun accès à la base ici : utilisable à l'écran et sur le serveur.
 *
 * Alertes (rouge) :
 * - « Facture normalisée manquante » : proforma validée, en cours de paiement ou soldée — ou ayant
 *   reçu une recette — sans aucune facture normalisée ;
 * - « À réclamer » : une facture normalisée envoyée au client a dépassé son échéance (date d'envoi
 *   + délai de relance) et il reste de l'argent à encaisser. Orange 2 jours avant.
 * Dossier complet : facture normalisée + attestation de bonne fin + proforma soldée.
 */

export const TYPES_DOCUMENT_PROFORMA = ["BON_COMMANDE", "FACTURE_NORMALISEE", "ATTESTATION_BONNE_FIN", "AUTRE"] as const;
export type TypeDocumentProformaValue = (typeof TYPES_DOCUMENT_PROFORMA)[number];

export const LIBELLES_DOCUMENT_PROFORMA: Record<TypeDocumentProformaValue, string> = {
  BON_COMMANDE: "Bon de commande du client",
  FACTURE_NORMALISEE: "Facture normalisée",
  ATTESTATION_BONNE_FIN: "Attestation de bonne fin d'exécution",
  AUTRE: "Autre document",
};

/** Dossier de rangement sous public/Upload (inchangé pour les deux sortes d'origine). */
export const DOSSIER_DOCUMENT_PROFORMA: Record<TypeDocumentProformaValue, string> = {
  BON_COMMANDE: "Bon",
  FACTURE_NORMALISEE: "Facture",
  ATTESTATION_BONNE_FIN: "Attestation",
  AUTRE: "Autre",
};

export function isTypeDocumentProforma(value: unknown): value is TypeDocumentProformaValue {
  return typeof value === "string" && (TYPES_DOCUMENT_PROFORMA as readonly string[]).includes(value);
}

export const DELAI_RELANCE_DEFAUT = 30;
/** Nombre de jours avant l'échéance à partir duquel une facture est signalée « bientôt à réclamer ». */
export const SEUIL_RELANCE_PROCHE = 2;

/** Statuts où la facture normalisée est attendue (le dossier est vivant). */
const STATUTS_FACTURE_ATTENDUE = ["Valider", "Payer", "Solde"];
/** Statuts sans aucune alerte (dossier fermé ou abandonné). */
const STATUTS_SANS_ALERTE = ["Annuler", "Archiver", "Brouillon"];

export interface DocumentProformaInfo {
  id: string;
  type: TypeDocumentProformaValue | string;
  numeroFacture?: string | null;
  precision?: string | null;
  dateEnvoiClient?: string | Date | null;
  delaiRelanceJours?: number | null;
}

export interface RelanceFacture {
  documentId: string;
  libelle: string;
  /** Échéance (ISO) = date d'envoi + délai. */
  echeance: string;
  joursRestants: number;
  enRetard: boolean;
  proche: boolean;
}

export interface EtatPiecesProforma {
  factureManquante: boolean;
  /** Factures envoyées au client, avec leur échéance (seulement s'il reste à encaisser). */
  relances: RelanceFacture[];
  aReclamer: boolean;
  relanceProche: boolean;
  /** Facture normalisée ajoutée mais sans date d'envoi au client : pas de relance possible. */
  envoiNonRenseigne: boolean;
  dossierComplet: boolean;
  manquants: string[];
  /** Au moins une alerte rouge. */
  alerteRouge: boolean;
}

const JOUR_MS = 86_400_000;
const jourUTC = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / JOUR_MS;

/** Échéance d'une facture envoyée (date d'envoi + délai), au jour près. */
export function echeanceRelance(dateEnvoi: Date | string, delaiJours: number): Date {
  const d = new Date(dateEnvoi);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + delaiJours, 12));
}

/**
 * Proforma soldée : statut « Soldée », ou plus rien à encaisser après au moins une recette. Une
 * facture normalisée jointe alors n'a pas de relance : seules la date d'émission et ses références
 * comptent (ni date d'envoi au client, ni délai).
 */
export function proformaSoldee(p: { statut: string; resteAPayer: number | string; aRecette: boolean }): boolean {
  return p.statut === "Solde" || (Number(p.resteAPayer) <= 0 && p.aRecette);
}

export function etatPiecesProforma(
  p: { statut: string; resteAPayer: number | string; aRecette: boolean; documents: DocumentProformaInfo[] },
  maintenant: Date = new Date()
): EtatPiecesProforma {
  const sansAlerte = STATUTS_SANS_ALERTE.includes(p.statut) && !(p.statut === "Brouillon" && p.aRecette);
  const factures = p.documents.filter((d) => d.type === "FACTURE_NORMALISEE");
  const attestation = p.documents.some((d) => d.type === "ATTESTATION_BONNE_FIN");
  const reste = Number(p.resteAPayer);
  const solde = proformaSoldee(p);

  const factureManquante =
    !sansAlerte && p.statut !== "Annuler" && factures.length === 0 && (STATUTS_FACTURE_ATTENDUE.includes(p.statut) || p.aRecette);

  const relances: RelanceFacture[] = [];
  if (!sansAlerte && !solde && reste > 0) {
    for (const f of factures) {
      if (!f.dateEnvoiClient) continue;
      const delai = f.delaiRelanceJours ?? DELAI_RELANCE_DEFAUT;
      const echeance = echeanceRelance(f.dateEnvoiClient, delai);
      const joursRestants = Math.round(jourUTC(echeance) - jourUTC(maintenant));
      relances.push({
        documentId: f.id,
        libelle: f.numeroFacture || f.precision || "Facture normalisée",
        echeance: echeance.toISOString(),
        joursRestants,
        enRetard: joursRestants <= 0,
        proche: joursRestants > 0 && joursRestants <= SEUIL_RELANCE_PROCHE,
      });
    }
  }

  const manquants: string[] = [];
  if (factures.length === 0) manquants.push(LIBELLES_DOCUMENT_PROFORMA.FACTURE_NORMALISEE);
  if (!attestation) manquants.push(LIBELLES_DOCUMENT_PROFORMA.ATTESTATION_BONNE_FIN);
  if (!solde) manquants.push("proforma soldée");

  const aReclamer = relances.some((r) => r.enRetard);
  return {
    factureManquante,
    relances,
    aReclamer,
    relanceProche: !aReclamer && relances.some((r) => r.proche),
    envoiNonRenseigne: !sansAlerte && !solde && factures.length > 0 && factures.every((f) => !f.dateEnvoiClient),
    dossierComplet: manquants.length === 0,
    manquants,
    alerteRouge: factureManquante || aReclamer,
  };
}
