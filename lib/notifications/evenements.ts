// Catalogue des événements notifiés (sans dépendance serveur : importable côté navigateur).
// Pour chacun, l'admin choisit le canal dans Paramètres > Notifications : email, application ou
// les deux (table NotificationPreference). Par défaut : les deux — l'email part comme avant et la
// notification apparaît aussi dans la cloche de l'application.

export const CANAUX_NOTIFICATION = ["EMAIL", "APP", "LES_DEUX"] as const;
export type CanalNotificationValue = (typeof CANAUX_NOTIFICATION)[number];

export const CANAL_LABELS: Record<CanalNotificationValue, string> = {
  EMAIL: "Email",
  APP: "Application",
  LES_DEUX: "Les deux",
};

export const CANAL_PAR_DEFAUT: CanalNotificationValue = "LES_DEUX";

interface EvenementMeta {
  groupe: string;
  libelle: string;
  destinataires: string;
}

export const EVENEMENTS_NOTIFICATION = {
  BUDGET_SOUMIS: { groupe: "Budgets", libelle: "Budget soumis à validation", destinataires: "Valideurs compétents (selon le type et le plafond)" },
  BUDGET_SIGNE_A_JOINDRE: { groupe: "Budgets", libelle: "Budget signé à joindre (lignes accordées)", destinataires: "Demandeur" },
  BUDGET_VALIDE: { groupe: "Budgets", libelle: "Budget validé", destinataires: "Comptables" },
  BUDGET_REJETE: { groupe: "Budgets", libelle: "Budget rejeté", destinataires: "Demandeur" },
  LIGNE_A_CORRIGER: { groupe: "Budgets", libelle: "Ligne renvoyée en correction", destinataires: "Demandeur" },
  LIGNE_CORRIGEE: { groupe: "Budgets", libelle: "Ligne corrigée, à revalider", destinataires: "Valideurs compétents" },
  COMMENTAIRE_LIGNE: { groupe: "Budgets", libelle: "Commentaire sur une ligne", destinataires: "Demandeur" },
  DEPASSEMENT_DEMANDE: { groupe: "Budgets", libelle: "Demande de dépassement", destinataires: "Direction (valide les budgets mensuels)" },
  DEPASSEMENT_DECIDE: { groupe: "Budgets", libelle: "Dépassement approuvé ou refusé", destinataires: "Auteur du dépassement et demandeur" },
  ALERTE_CONSOMMATION: { groupe: "Budgets", libelle: "Ligne consommée à 80 % / 100 %", destinataires: "Demandeur et direction" },
  DEPENSE_ANNULEE: { groupe: "Budgets", libelle: "Dépense annulée (contre-écriture)", destinataires: "Demandeur et comptables" },
  ETAT_DU_SOIR: { groupe: "Pilotage", libelle: "État du soir (campagnes, justificatifs, avances)", destinataires: "Direction, comptables en copie" },
  PROFORMA_VALIDEE: { groupe: "Proformas", libelle: "Proforma validée", destinataires: "Liste de diffusion commerciale et finance" },
  PROFORMA_ENCAISSEMENT: { groupe: "Proformas", libelle: "Encaissement sur une proforma", destinataires: "Administrateurs" },
  BC_CREE: { groupe: "Fournisseurs", libelle: "Bon de commande créé (à signer)", destinataires: "Direction (valide les budgets mensuels)" },
  BC_VALIDE: { groupe: "Fournisseurs", libelle: "Bon de commande signé et validé", destinataires: "Comptables" },
} as const satisfies Record<string, EvenementMeta>;

export type EvenementNotification = keyof typeof EVENEMENTS_NOTIFICATION;

export function isEvenementNotification(value: string): value is EvenementNotification {
  return value in EVENEMENTS_NOTIFICATION;
}
