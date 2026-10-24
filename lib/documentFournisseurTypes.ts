export const DOCUMENT_FOURNISSEUR_PRESETS = [
  "CV",
  "Pièce d'identité",
  "Document administratif",
  "IFU",
  "RCCM",
  "Contrat",
  "Diplôme / Attestation",
] as const;

const DOCUMENT_FOURNISSEUR_TYPE_COLORS: Record<string, string> = {
  CV: "bg-blue-50 text-blue-700 border-blue-200",
  "Pièce d'identité": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Document administratif": "bg-amber-50 text-amber-700 border-amber-200",
  IFU: "bg-emerald-50 text-emerald-700 border-emerald-200",
  RCCM: "bg-teal-50 text-teal-700 border-teal-200",
  Contrat: "bg-purple-50 text-purple-700 border-purple-200",
  "Diplôme / Attestation": "bg-cyan-50 text-cyan-700 border-cyan-200",
};

/** Couleur de badge pour un type de document — avec repli gris pour un texte "Autre" imprévisible. */
export function getDocumentFournisseurTypeColor(type: string): string {
  return DOCUMENT_FOURNISSEUR_TYPE_COLORS[type] ?? "bg-gray-50 text-gray-700 border-gray-200";
}
