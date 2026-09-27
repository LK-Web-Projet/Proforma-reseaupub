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
  "commercial",
  "finance",
  "parametres",
] as const;

export type PageKey = (typeof PAGE_KEYS)[number];

export const PAGE_LABELS: Record<PageKey, string> = {
  dashboard: "Tableau de bord",
  proforma: "Proforma (factures, statistiques)",
  client: "Clients",
  fournisseurs: "Fournisseurs",
  commercial: "Commercial",
  finance: "Finance (journal de caisse)",
  parametres: "Paramètres",
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
    ["/gestionnaire", "commercial"],
    ["/journal-caisse", "finance"],
    ["/parametres", "parametres"],
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
  commercial: "/gestionnaire",
  finance: "/journal-caisse",
  parametres: "/parametres",
};

/**
 * Détermine où envoyer un utilisateur après connexion (ou depuis /acces-refuse) : la
 * première section que son rôle autorise réellement, dans l'ordre de PAGE_KEYS — plutôt que
 * de forcer systématiquement `/facture`, qui bloquait immédiatement tout rôle sans la page
 * "proforma" cochée. `/budget/demandes` est toujours accessible (voir middleware.ts), donc
 * sert de repli sûr si aucune section classique n'est autorisée.
 */
export function resolveLandingUrl(pages: PageKey[] | undefined | null): string {
  if (pages) {
    for (const key of PAGE_KEYS) {
      if (pages.includes(key)) return PAGE_DEFAULT_URLS[key];
    }
  }
  return "/budget/demandes";
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
