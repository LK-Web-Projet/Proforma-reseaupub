/**
 * Définitions partagées pour le système de rôles/permissions par page.
 * Ce fichier ne doit importer AUCUNE dépendance Node-only (Prisma, Clerk backend) :
 * il est utilisé à la fois par middleware.ts (runtime Edge), les composants client
 * (UI admin) et lib/authz.ts (routes API, runtime Node.js).
 */

/**
 * Clés de page = sections de la sidebar (voir components/app-sidebar.tsx).
 * Une "case cochée" pour un rôle = une entrée RolePage avec l'une de ces valeurs.
 */
export const PAGE_KEYS = [
  "dashboard",
  "proforma",
  "client",
  "fournisseurs",
  "produits",
  "commercial",
  "finance",
  "parametres",
  // Depuis le 2026-11-25 : la section Budget n'est plus ouverte à tous, elle se coche par rôle.
  "budget",
] as const;

export type PageKey = (typeof PAGE_KEYS)[number];

export const PAGE_LABELS: Record<PageKey, string> = {
  dashboard: "Tableau de bord & Rapports",
  proforma: "Proforma (factures, statistiques)",
  client: "Clients",
  fournisseurs: "Prestataires",
  produits: "Produits (catalogue, statistiques)",
  commercial: "Commercial",
  finance: "Finance (journal de caisse)",
  parametres: "Paramètres",
  budget: "Budget (demandes et suivi)",
};

export function isPageKey(value: string): value is PageKey {
  return (PAGE_KEYS as readonly string[]).includes(value);
}

/**
 * Fait correspondre un chemin d'URL à la clé de page dont dépend son accès.
 * Retourne null si le chemin n'est pas concerné par le contrôle d'accès par page
 * (ex: routes /api/*, /sign-in, etc. — gérées séparément).
 */
export function resolvePageKeyFromPathname(pathname: string): PageKey | null {
  const rules: [string, PageKey][] = [
    ["/dashboard", "dashboard"],
    ["/facture", "proforma"],
    ["/statistiques", "proforma"],
    ["/client", "client"],
    ["/fournisseur", "fournisseurs"],
    ["/produits", "produits"],
    ["/gestionnaire", "commercial"],
    ["/journal-caisse", "finance"],
    ["/parametres", "parametres"],
    ["/budget", "budget"],
  ];

  for (const [prefix, key] of rules) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return key;
    }
  }

  return null;
}

/** URL représentative de chaque section, utilisée pour la redirection « intelligente » post-connexion. */
const PAGE_DEFAULT_URLS: Record<PageKey, string> = {
  dashboard: "/dashboard",
  proforma: "/facture",
  client: "/client",
  fournisseurs: "/fournisseur",
  produits: "/produits",
  commercial: "/gestionnaire",
  finance: "/journal-caisse",
  parametres: "/parametres",
  budget: "/budget/demandes",
};

/**
 * Détermine où envoyer un utilisateur après connexion (ou depuis /acces-refuse) : la
 * première section que son rôle autorise réellement, dans l'ordre de PAGE_KEYS — plutôt que
 * de forcer systématiquement `/facture`, qui bloquait immédiatement tout rôle sans la page
 * "proforma" cochée. Aucune section autorisée : la page « Accès refusé » (la section Budget se
 * coche désormais comme les autres et n'est plus un repli sûr).
 */
export function resolveLandingUrl(pages: PageKey[] | undefined | null): string {
  if (pages) {
    for (const key of PAGE_KEYS) {
      if (pages.includes(key)) return PAGE_DEFAULT_URLS[key];
    }
  }
  return "/acces-refuse";
}

/**
 * Forme du `publicMetadata` Clerk synchronisé pour chaque utilisateur.
 * ⚠️ Pour que le middleware puisse la lire sans appel base de données, le token de
 * session Clerk doit être configuré pour inclure ce claim (Dashboard Clerk → Sessions →
 * Customize session token → ajouter `{ "metadata": "{{user.public_metadata}}" }`).
 * Tant que ce n'est pas fait, `sessionClaims.metadata` est `undefined` et le contrôle
 * d'accès par page reste inactif (voir middleware.ts, ENABLE_PAGE_PERMISSIONS).
 */
export interface AppPublicMetadata {
  roleId: string;
  roleName: string;
  pages: PageKey[];
  canManageUsers: boolean;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// Droits par action (Paramètres → Rôles → grille).
//
// Un rôle = des pages (RolePage, ci-dessus) + des droits d'action. Deux sortes de droits :
//  - les clés « module.action » stockées dans RolePermission (table) ;
//  - les 6 cases historiques de Role (`flag`), source de vérité du circuit budget et de la
//    caisse : la grille les affiche, mais elles restent des colonnes de Role.
// Règle descendante : une clé de table exige la page de son module (`page`). Les cases
// historiques ne sont pas liées à une page (elles servent aussi depuis la proforma, le budget…).
//
// ➜ Toute nouvelle fonctionnalité déclare ici ses actions : elles apparaissent alors dans la
//   grille, et la route les vérifie avec requirePermission("module.action") (lib/authz.ts).
// ─────────────────────────────────────────────────────────────────────────────────────────────

export const ROLE_FLAGS = [
  "canManageUsers",
  "canValidateBudgetMensuel",
  "canValidateBudget",
  "canPayBudget",
  "canSaisirCaisse",
  "canSaisirPetiteDepense",
] as const;
export type RoleFlag = (typeof ROLE_FLAGS)[number];

export interface ActionDroit {
  /** Clé « module.action » (table RolePermission), ou nom de la case historique de Role. */
  key: string;
  label: string;
  description?: string;
  /** Case historique de Role (pas de ligne RolePermission). */
  flag?: RoleFlag;
  /** Sous-titre dans la carte du module (ex. « Bons de commande »). */
  groupe?: string;
}

export interface ModuleDroits {
  id: string;
  label: string;
  /** Page exigée par les actions du module ; null = module sans page (budget, toujours visible). */
  page: PageKey | null;
  /** Remarque affichée sous le titre de la carte. */
  note?: string;
  actions: ActionDroit[];
}

export const MODULES_DROITS: ModuleDroits[] = [
  {
    id: "dashboard",
    label: "Tableau de bord & rapports",
    page: "dashboard",
    actions: [{ key: "dashboard.exporter", label: "Exporter les rapports (Excel)" }],
  },
  {
    id: "proforma",
    label: "Proforma",
    page: "proforma",
    note: "Les statuts « Payée » et « Soldée » restent automatiques : ils suivent les encaissements.",
    actions: [
      {
        key: "proforma.voirTout",
        label: "Voir toutes les proformas",
        description: "Sinon, seulement les siennes : créées par l'utilisateur ou dont il est le commercial (même email).",
      },
      { key: "proforma.creer", label: "Créer une proforma" },
      { key: "proforma.modifier", label: "Modifier le contenu", description: "Client, objet, lignes, remise, commerciaux…" },
      { key: "proforma.changerStatut", label: "Changer le statut", description: "Brouillon, Envoyée, Archivée." },
      { key: "proforma.valider", label: "Valider une proforma", description: "Passage au statut « Validée »." },
      { key: "proforma.annuler", label: "Annuler une proforma", description: "Passage au statut « Annulée » (garde l'historique)." },
      { key: "proforma.supprimer", label: "Supprimer une proforma", description: "Seulement un brouillon sans aucun historique." },
      { key: "proforma.envoyer", label: "Envoyer par e-mail" },
      { key: "proforma.pieces", label: "Joindre ou retirer des pièces", description: "Bon de commande client, facture normalisée…" },
      { key: "proforma.encaisser", label: "Enregistrer un encaissement", description: "Recette du client, preuve de paiement." },
      { key: "proforma.exporter", label: "Exporter", description: "Liste Excel et PDF de la proforma." },
    ],
  },
  {
    id: "client",
    label: "Clients",
    page: "client",
    actions: [
      {
        key: "client.creer",
        label: "Créer un client",
        description: "Depuis le formulaire de proforma, le droit « Créer une proforma » ou « Modifier le contenu » suffit.",
      },
      { key: "client.modifier", label: "Modifier un client" },
      { key: "client.supprimer", label: "Supprimer un client", description: "Seulement s'il n'a aucune proforma." },
    ],
  },
  {
    id: "commercial",
    label: "Commerciaux",
    page: "commercial",
    actions: [
      { key: "commercial.creer", label: "Créer un commercial" },
      { key: "commercial.modifier", label: "Modifier un commercial" },
      { key: "commercial.desactiver", label: "Désactiver / réactiver", description: "Un commercial inactif n'est plus proposé sur les nouvelles proformas." },
    ],
  },
  {
    id: "fournisseurs",
    label: "Prestataires",
    page: "fournisseurs",
    note: "Un prestataire ne se supprime pas : on le désactive. Payer une facture ou verser une avance relève du droit « Dépenser / payer » (Budget) ; valider un bon de commande, du droit « Valider au niveau direction ».",
    actions: [
      { key: "fournisseurs.creer", label: "Créer un prestataire", groupe: "Prestataires" },
      { key: "fournisseurs.modifier", label: "Modifier un prestataire", groupe: "Prestataires" },
      { key: "fournisseurs.activer", label: "Activer / désactiver", groupe: "Prestataires" },
      { key: "fournisseurs.documents", label: "Ajouter ou retirer des documents", description: "Contrat, RIB, pièces…", groupe: "Prestataires" },
      { key: "fournisseurs.produits", label: "Gérer ses produits", description: "Ajouter, modifier, photos.", groupe: "Prestataires" },
      { key: "fournisseurs.affecterDepartement", label: "Rattacher à un département", description: "Changer le département et le poste d'un prestataire (historique conservé).", groupe: "Prestataires" },
      { key: "fournisseurs.departementCreer", label: "Créer un département", groupe: "Départements" },
      { key: "fournisseurs.departementModifier", label: "Modifier un département", groupe: "Départements" },
      { key: "fournisseurs.departementActiver", label: "Activer / désactiver un département", description: "Un département inactif n'est plus proposé sur les nouvelles lignes de budget.", groupe: "Départements" },
      { key: "fournisseurs.factureEnregistrer", label: "Enregistrer une facture", groupe: "Factures prestataires" },
      { key: "fournisseurs.factureModifier", label: "Modifier une facture", groupe: "Factures prestataires" },
      { key: "fournisseurs.factureAnnuler", label: "Annuler une facture", groupe: "Factures prestataires" },
      {
        key: "fournisseurs.facturePayeeHorsPlateforme",
        label: "Marquer une facture payée sans paiement",
        description: "Facture réglée hors plateforme, liée à aucun bon ni ligne de budget : moyen de paiement, date et preuve obligatoires. Aucune sortie de caisse.",
        groupe: "Factures prestataires",
      },
      {
        key: "fournisseurs.factureStatutLibre",
        label: "Changer librement le statut d'une facture",
        description: "Payée, annulée ou en attente dans les deux sens, avec historique. Une facture réglée par une dépense reste protégée : annuler d'abord la dépense.",
        groupe: "Factures prestataires",
      },
      { key: "fournisseurs.commandeCreer", label: "Créer un bon de commande", groupe: "Bons de commande" },
      { key: "fournisseurs.commandeModifier", label: "Modifier un bon (brouillon)", groupe: "Bons de commande" },
      { key: "fournisseurs.commandeLivrer", label: "Marquer livré", groupe: "Bons de commande" },
      { key: "fournisseurs.commandeAnnuler", label: "Annuler un bon", description: "Sans paiement uniquement.", groupe: "Bons de commande" },
      { key: "fournisseurs.commandePieces", label: "Joindre des pièces", description: "BC signé, bordereau, attestation, facture…", groupe: "Bons de commande" },
      { key: "fournisseurs.commandeExporter", label: "Télécharger le PDF du bon", groupe: "Bons de commande" },
    ],
  },
  {
    id: "produits",
    label: "Produits",
    page: "produits",
    actions: [
      { key: "produits.creer", label: "Créer un produit" },
      { key: "produits.modifier", label: "Modifier un produit", description: "Y compris l'activer ou le désactiver." },
      { key: "produits.supprimer", label: "Supprimer un produit", description: "Seulement s'il n'a jamais été utilisé." },
    ],
  },
  {
    id: "finance",
    label: "Finance (journal de caisse)",
    page: "finance",
    actions: [
      {
        key: "canSaisirCaisse",
        flag: "canSaisirCaisse",
        label: "Saisir au journal de caisse",
        description: "Opérations hors budget, transferts, dépenses imputées à une proforma. Sans ce droit, l'argent ne sort que par le budget.",
      },
      { key: "finance.caisses", label: "Gérer les caisses", description: "Créer, modifier, désactiver une caisse." },
      { key: "finance.moyenCreer", label: "Créer un moyen de paiement", groupe: "Moyens de paiement" },
      {
        key: "finance.moyenModifier",
        label: "Modifier un moyen de paiement",
        description: "Nom, description, ordre et caisses liées (seules les caisses liées sont proposées au paiement).",
        groupe: "Moyens de paiement",
      },
      {
        key: "finance.moyenActiver",
        label: "Activer / désactiver un moyen de paiement",
        description: "Un moyen inactif n'est plus proposé, mais reste affiché sur les anciennes opérations.",
        groupe: "Moyens de paiement",
      },
      { key: "finance.recalculer", label: "Recalculer les soldes" },
      { key: "finance.justificatifs", label: "Joindre un justificatif à une écriture" },
      { key: "finance.exporter", label: "Exporter le journal (Excel)" },
    ],
  },
  {
    id: "budget",
    label: "Budget",
    page: "budget",
    note: "La page Budget permet de faire une demande et de voir les siennes. Les cases ci-dessous donnent accès à toutes les demandes ; valider et payer servent aussi depuis la proforma et les prestataires, même sans la page.",
    actions: [
      { key: "canValidateBudget", flag: "canValidateBudget", label: "Valider les budgets", description: "Ponctuels et pour tiers, jusqu'au plafond délégué." },
      {
        key: "canValidateBudgetMensuel",
        flag: "canValidateBudgetMensuel",
        label: "Valider au niveau direction",
        description: "Budgets mensuels, de campagne et au-dessus du plafond ; bons de commande ; annulation de dépenses ; dépassements.",
      },
      {
        key: "canPayBudget",
        flag: "canPayBudget",
        label: "Dépenser / payer",
        description: "Dépenses de budget, paiement des factures prestataires, avances, clôture.",
      },
      {
        key: "canSaisirPetiteDepense",
        flag: "canSaisirPetiteDepense",
        label: "Petites dépenses",
        description: "En espèces, hors bon, jusqu'au plafond des petites dépenses.",
      },
      {
        key: "budget.exporter",
        label: "Télécharger le PDF d'un budget",
        description: "L'impression pour signature, quand le budget signé est exigé, reste toujours possible.",
      },
    ],
  },
  {
    id: "parametres",
    label: "Paramètres",
    page: "parametres",
    actions: [
      { key: "parametres.entreprise", label: "Informations de l'entreprise et logo" },
      { key: "canManageUsers", flag: "canManageUsers", label: "Gérer les rôles et les utilisateurs" },
      { key: "parametres.reglages", label: "Délais et plafonds", description: "Plafonds de validation et des petites dépenses, délais de paiement, budget signé, liasse." },
      { key: "parametres.notifications", label: "Notifications", description: "Qui reçoit quoi, et par quel canal." },
    ],
  },
];

/** Clés stockées dans RolePermission (hors cases historiques de Role). */
export const PERMISSION_KEYS: string[] = MODULES_DROITS.flatMap((m) => m.actions.filter((a) => !a.flag).map((a) => a.key));

const PAGE_DE_CLE = new Map<string, PageKey | null>(
  MODULES_DROITS.flatMap((m) => m.actions.filter((a) => !a.flag).map((a) => [a.key, m.page] as [string, PageKey | null]))
);

export function isPermissionKey(value: string): boolean {
  return PAGE_DE_CLE.has(value);
}

/** Page exigée par une clé (null = aucune). `undefined` si la clé est inconnue. */
export function pageDeCle(key: string): PageKey | null | undefined {
  return PAGE_DE_CLE.get(key);
}

/** Libellé d'une action, pour les messages de refus. */
export function libelleDroit(key: string): string {
  for (const m of MODULES_DROITS) {
    const a = m.actions.find((x) => x.key === key);
    if (a) return a.label;
  }
  return key;
}

/**
 * Garde les seules clés valides et cohérentes avec les pages du rôle (règle descendante) :
 * une page retirée retire les droits de son module.
 */
export function permissionsCoherentes(permissions: string[], pages: PageKey[]): string[] {
  const set = new Set(pages);
  return Array.from(new Set(permissions)).filter((k) => {
    const page = pageDeCle(k);
    return page !== undefined && (page === null || set.has(page));
  });
}

/** Droits de l'utilisateur connecté, tels que renvoyés par GET /api/me/droits. */
export interface DroitsUtilisateur {
  pages: PageKey[];
  permissions: string[];
  flags: Record<RoleFlag, boolean>;
}

/** Vrai si les droits donnés autorisent la clé (page du module + clé, ou case historique). */
export function aLeDroit(d: Pick<DroitsUtilisateur, "pages" | "permissions" | "flags"> | null | undefined, key: string): boolean {
  if (!d) return false;
  if ((ROLE_FLAGS as readonly string[]).includes(key)) return !!d.flags[key as RoleFlag];
  const page = pageDeCle(key);
  if (page === undefined) return false;
  if (page !== null && !d.pages.includes(page)) return false;
  return d.permissions.includes(key);
}

/**
 * Droits d'action qu'avait implicitement un rôle avant la grille (pages + cases historiques).
 * Miroir exact de la reprise SQL de la migration 20261122100000_droits_par_action ; sert de
 * repli tant que cette migration n'est pas appliquée.
 */
export function permissionsAvantGrille(pages: string[], flags: Record<RoleFlag, boolean>): string[] {
  const set = new Set(pages);
  const cles: string[] = [];
  for (const m of MODULES_DROITS) {
    for (const a of m.actions) {
      if (a.flag) continue;
      switch (a.key) {
        case "finance.caisses":
        case "finance.recalculer":
          if (set.has("finance") && flags.canSaisirCaisse) cles.push(a.key);
          break;
        case "parametres.reglages":
        case "parametres.notifications":
          if (flags.canManageUsers) cles.push(a.key);
          break;
        case "budget.exporter":
          cles.push(a.key);
          break;
        // Avant la grille : « payée » à la main = case direction ; statut libre = administrateur.
        case "fournisseurs.facturePayeeHorsPlateforme":
          if (set.has("fournisseurs") && flags.canValidateBudgetMensuel) cles.push(a.key);
          break;
        case "fournisseurs.factureStatutLibre":
          if (set.has("fournisseurs") && flags.canManageUsers) cles.push(a.key);
          break;
        default:
          if (m.page && set.has(m.page)) cles.push(a.key);
      }
    }
  }
  return cles;
}

/**
 * Droit exigé pour faire passer une proforma du statut `actuel` au statut `cible` (null = aucun).
 * Validée → « Valider » ; Annulée, ou sortir d'Annulée → « Annuler » ; autres → « Changer le
 * statut ». Partagé par l'écran (liste des statuts proposés) et la route PUT/PATCH.
 */
export function droitChangementStatutProforma(actuel: string, cible: string): string | null {
  if (cible === actuel) return null;
  if (cible === "Valider") return "proforma.valider";
  if (cible === "Annuler" || actuel === "Annuler") return "proforma.annuler";
  return "proforma.changerStatut";
}
