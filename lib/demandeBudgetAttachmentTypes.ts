// Types de pièces jointes pour une demande de budget. Ceux de DOCUMENT_UPLOAD_TYPES sont choisis
// par l'auteur de la demande (création, re-soumission, ajout de documents) ; PREUVE_PAIEMENT est
// ajouté par le comptable sur chaque dépense (voir app/api/demandes-budget/[id]/depenses/route.ts).
// BUDGET_SIGNE : scan du budget imprimé et signé par la DG, exigé avant de valider un budget de
// campagne (procédure de paiement, section 4).
export const DOCUMENT_UPLOAD_TYPES = ["DEVIS", "FACTURE", "BON_COMMANDE", "BUDGET_SIGNE", "AUTRE"] as const;
export type DocumentUploadType = (typeof DOCUMENT_UPLOAD_TYPES)[number];

// Documents qui justifient une ligne d'un budget collectif (prix, devis), joints par son département.
export const DOCUMENTS_LIGNE_TYPES = ["DEVIS", "FACTURE", "AUTRE"] as const;
export type DocumentLigneType = (typeof DOCUMENTS_LIGNE_TYPES)[number];

// DEVIS = proforma fournisseur (devis du fournisseur, obtenu avant le budget) : son fournisseur est
// demandé à l'upload et inscrit dans le nom du fichier, pour la reprendre dans la liasse d'un bon.
export const ATTACHMENT_TYPE_LABELS: Record<string, string> = {
  DEVIS: "Proforma fournisseur (devis)",
  FACTURE: "Facture / Preuve de dépense",
  BON_COMMANDE: "Bon de commande",
  PREUVE_PAIEMENT: "Preuve de décaissement",
  BUDGET_SIGNE: "Budget signé (DG)",
  AUTRE: "Autre",
};

export const ATTACHMENT_TYPE_COLORS: Record<string, string> = {
  DEVIS: "bg-blue-50 text-blue-700 border-blue-200",
  FACTURE: "bg-purple-50 text-purple-700 border-purple-200",
  BON_COMMANDE: "bg-amber-50 text-amber-700 border-amber-200",
  PREUVE_PAIEMENT: "bg-green-50 text-green-700 border-green-200",
  BUDGET_SIGNE: "bg-indigo-50 text-indigo-700 border-indigo-200",
  AUTRE: "bg-gray-50 text-gray-700 border-gray-200",
};
