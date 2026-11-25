import { toDateJour } from "@/lib/budgetSchema";
import { LIBELLES_DOCUMENT_PROFORMA, type TypeDocumentProformaValue } from "@/lib/proformaPieces";
import { fcfa } from "@/lib/proformaHistorique";

const UN_JOUR = 24 * 3600 * 1000;

export interface ChampsDocumentBruts {
  precision?: unknown;
  numeroFacture?: unknown;
  montant?: unknown;
  dateEmission?: unknown;
  dateEnvoiClient?: unknown;
  delaiRelanceJours?: unknown;
}

export interface ChampsDocument {
  precision: string | null;
  numeroFacture: string | null;
  montant: number | null;
  dateEmission: Date | null;
  dateEnvoiClient: Date | null;
  delaiRelanceJours: number | null;
}

const texte = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/**
 * Vérifie les informations d'une pièce. Facture normalisée : date d'émission et délai de relance
 * obligatoires, date d'envoi au client facultative (à renseigner dès l'envoi : c'est elle qui fait
 * partir le délai), envoi au plus tôt le jour de l'émission, aucune date dans le futur. Les autres
 * pièces n'ont qu'une précision. Renvoie les valeurs, ou le message d'erreur.
 */
export function validerChampsDocument(
  type: TypeDocumentProformaValue,
  brut: ChampsDocumentBruts,
  delaiDefaut: number
): ChampsDocument | { erreur: string } {
  const precision = texte(brut.precision, 200);
  if (type !== "FACTURE_NORMALISEE") {
    return { precision, numeroFacture: null, montant: null, dateEmission: null, dateEnvoiClient: null, delaiRelanceJours: null };
  }
  const numeroFacture = texte(brut.numeroFacture, 80);
  let montant: number | null = null;
  if (brut.montant !== undefined && brut.montant !== null && brut.montant !== "") {
    montant = Number(brut.montant);
    if (!Number.isFinite(montant) || montant < 0) return { erreur: "Le montant de la facture n'est pas valide." };
  }
  const dateEmission = typeof brut.dateEmission === "string" && brut.dateEmission ? toDateJour(brut.dateEmission) : null;
  if (!dateEmission) return { erreur: "Indiquez la date d'émission de la facture normalisée." };
  const dateEnvoiClient = typeof brut.dateEnvoiClient === "string" && brut.dateEnvoiClient ? toDateJour(brut.dateEnvoiClient) : null;
  if (typeof brut.dateEnvoiClient === "string" && brut.dateEnvoiClient && !dateEnvoiClient) {
    return { erreur: "La date d'envoi au client n'est pas une date valide." };
  }
  const demain = Date.now() + UN_JOUR;
  if (dateEmission.getTime() > demain) return { erreur: "La date d'émission ne peut pas être dans le futur." };
  if (dateEnvoiClient && dateEnvoiClient.getTime() > demain) return { erreur: "La date d'envoi au client ne peut pas être dans le futur." };
  if (dateEnvoiClient && dateEnvoiClient.getTime() < dateEmission.getTime()) {
    return { erreur: "La facture ne peut pas être envoyée au client avant d'être émise." };
  }
  const delai = brut.delaiRelanceJours === undefined || brut.delaiRelanceJours === null || brut.delaiRelanceJours === "" ? delaiDefaut : Number(brut.delaiRelanceJours);
  if (!Number.isInteger(delai) || delai < 1 || delai > 365) return { erreur: "Le délai de relance est un nombre de jours entre 1 et 365." };
  return { precision, numeroFacture, montant, dateEmission, dateEnvoiClient, delaiRelanceJours: delai };
}

const jour = (d: Date | null | undefined) => (d ? d.toLocaleDateString("fr-FR", { timeZone: "UTC" }) : null);

/** Texte de l'historique pour une pièce (ajout, modification, retrait). */
export function descriptionDocument(
  type: TypeDocumentProformaValue | string,
  d: { fileName?: string | null; precision?: string | null; numeroFacture?: string | null; montant?: unknown; dateEmission?: Date | null; dateEnvoiClient?: Date | null; delaiRelanceJours?: number | null }
): string {
  const parts = [`${LIBELLES_DOCUMENT_PROFORMA[type as TypeDocumentProformaValue] ?? type}${d.fileName ? ` : ${d.fileName}` : ""}`];
  if (d.precision) parts.push(d.precision);
  if (d.numeroFacture) parts.push(`n° ${d.numeroFacture}`);
  if (d.montant !== null && d.montant !== undefined) parts.push(fcfa(Number(d.montant)));
  if (d.dateEmission) parts.push(`émise le ${jour(d.dateEmission)}`);
  if (type === "FACTURE_NORMALISEE") parts.push(d.dateEnvoiClient ? `envoyée au client le ${jour(d.dateEnvoiClient)}` : "pas encore envoyée");
  if (d.delaiRelanceJours) parts.push(`relance à ${d.delaiRelanceJours} j`);
  return parts.join(" — ");
}
