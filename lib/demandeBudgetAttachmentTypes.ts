// Types de pièces jointes pour une demande de budget. Les 4 premiers sont choisis par
// l'auteur de la demande à la création/re-soumission ; PREUVE_PAIEMENT est ajouté par le
// comptable au moment du paiement (voir app/api/demandes-budget/[id]/payer/route.ts).
export const DOCUMENT_UPLOAD_TYPES = ["DEVIS", "FACTURE", "BON_COMMANDE", "AUTRE"] as const;
export type DocumentUploadType = (typeof DOCUMENT_UPLOAD_TYPES)[number];

export const ATTACHMENT_TYPE_LABELS: Record<string, string> = {
  DEVIS: "Devis",
  FACTURE: "Facture / Preuve de dépense",
  BON_COMMANDE: "Bon de commande",
  PREUVE_PAIEMENT: "Preuve de décaissement",
  AUTRE: "Autre",
};

export const ATTACHMENT_TYPE_COLORS: Record<string, string> = {
  DEVIS: "bg-blue-50 text-blue-700 border-blue-200",
  FACTURE: "bg-purple-50 text-purple-700 border-purple-200",
  BON_COMMANDE: "bg-amber-50 text-amber-700 border-amber-200",
  PREUVE_PAIEMENT: "bg-green-50 text-green-700 border-green-200",
  AUTRE: "bg-gray-50 text-gray-700 border-gray-200",
};
