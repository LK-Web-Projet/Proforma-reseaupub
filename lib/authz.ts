import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  isPageKey,
  aLeDroit,
  libelleDroit,
  pageDeCle,
  PAGE_LABELS as LIBELLES_PAGES,
  permissionsAvantGrille,
  ROLE_FLAGS,
  type AppPublicMetadata,
  type DroitsUtilisateur,
  type PageKey,
  type RoleFlag,
} from "@/lib/permissions";

export { PAGE_KEYS, PAGE_LABELS, resolvePageKeyFromPathname, isPageKey } from "@/lib/permissions";
export type { PageKey, AppPublicMetadata } from "@/lib/permissions";

/**
 * Recalcule et pousse le publicMetadata Clerk d'un utilisateur à partir de son rôle
 * actuel en base (source de vérité). À appeler après : création de compte, changement
 * de rôle d'un utilisateur, ou modification des pages/droits d'un rôle (dans ce dernier
 * cas, appeler pour chaque utilisateur ayant ce rôle — voir syncAllUsersForRole).
 */
export async function syncUserMetadata(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: { include: { pages: true } } },
  });
  if (!user) return;

  const metadata: AppPublicMetadata = {
    roleId: user.role.id,
    roleName: user.role.nom,
    pages: user.role.pages.map((p) => p.page).filter(isPageKey),
    canManageUsers: user.role.canManageUsers,
  };

  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, { publicMetadata: metadata });
}

/** Resynchronise tous les utilisateurs d'un rôle (après modification des pages du rôle). */
export async function syncAllUsersForRole(roleId: string): Promise<void> {
  const users = await prisma.user.findMany({ where: { roleId }, select: { id: true } });
  await Promise.all(users.map((u) => syncUserMetadata(u.id)));
}

/**
 * Vérifie, côté serveur (route API), que l'utilisateur connecté a le droit d'accéder
 * à la section `pageKey`. Relit le rôle en base (source de vérité, pas le metadata Clerk
 * qui peut être en léger différé) — à utiliser en défense en profondeur sur les routes
 * sensibles, en plus du contrôle de navigation fait par le middleware.
 * Retourne une NextResponse d'erreur si l'accès est refusé, ou `null` si autorisé.
 */
export async function requirePage(pageKey: PageKey): Promise<NextResponse | null> {
  return requireAnyPage([pageKey]);
}

/**
 * Sections autorisées de l'utilisateur connecté, relues en base (source de vérité). Retourne
 * une NextResponse d'erreur si non connecté, compte inconnu ou désactivé.
 */
export async function getAllowedPages(): Promise<{ userId: string; pages: Set<PageKey> } | NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: { include: { pages: true } } },
  });

  if (!user || !user.active) {
    return NextResponse.json({ error: "Compte introuvable ou désactivé." }, { status: 403 });
  }

  return { userId, pages: new Set(user.role.pages.map((p) => p.page).filter(isPageKey)) };
}

/**
 * Comme requirePage, mais l'accès est accordé si l'utilisateur a AU MOINS UNE des sections
 * données — pour les routes partagées par plusieurs écrans (ex. la liste des clients sert à la
 * page Clients et au formulaire de proforma). Retourne `null` si autorisé.
 */
export async function requireAnyPage(pageKeys: PageKey[]): Promise<NextResponse | null> {
  const acces = await getAllowedPages();
  if (acces instanceof NextResponse) return acces;
  if (!pageKeys.some((k) => acces.pages.has(k))) {
    return NextResponse.json({ error: "Accès refusé pour cette section." }, { status: 403 });
  }
  return null;
}

/**
 * Retourne `userId` seulement s'il correspond à une ligne `User` existante en base, sinon
 * `null`. Nécessaire tant que tous les comptes Clerk n'ont pas été migrés vers ce système
 * (script de bootstrap) : sans ce garde-fou, affecter `createdById` à un `userId` Clerk qui
 * n'a pas encore de `User` local ferait échouer la création (violation de clé étrangère) —
 * on préfère tracer "auteur inconnu" (null) plutôt que casser l'opération.
 */
export async function safeCreatedById(
  tx: Prisma.TransactionClient,
  userId: string | null | undefined
): Promise<string | null> {
  if (!userId) return null;
  const exists = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
  return exists ? userId : null;
}

/** Vérifie que l'utilisateur connecté a le droit de gérer les comptes/rôles. */
export async function requireCanManageUsers(): Promise<NextResponse | null> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!user || !user.active || !user.role.canManageUsers) {
    return NextResponse.json({ error: "Accès réservé aux administrateurs." }, { status: 403 });
  }

  return null;
}

// ─── Droits par action ──────────────────────────────────────────────────────────────────────

export interface DroitsServeur extends DroitsUtilisateur {
  userId: string;
  email: string;
}

/** Vrai tant que la migration 20261122100000_droits_par_action n'est pas appliquée. */
function tableDroitsAbsente(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2021" || error.code === "P2022");
}

/**
 * Droits de l'utilisateur connecté (pages, clés d'action, cases historiques du rôle), relus en
 * base à chaque appel : une case décochée prend effet immédiatement. Repli tant que la migration
 * n'est pas appliquée : chaque page donne toutes ses actions (comportement d'avant la grille).
 */
export async function getDroits(): Promise<DroitsServeur | NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  let user;
  let permissions: string[];
  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: { include: { pages: true, permissions: true } } },
    });
    permissions = user?.role.permissions.map((p) => p.permission) ?? [];
  } catch (error) {
    if (!tableDroitsAbsente(error)) throw error;
    console.warn("[droits] Table RolePermission absente : lancez `pnpm prisma migrate deploy`. Repli sur les droits par page.");
    user = await prisma.user.findUnique({ where: { id: userId }, include: { role: { include: { pages: true } } } });
    const role = user?.role;
    permissions = role
      ? permissionsAvantGrille(
          role.pages.map((p) => p.page),
          Object.fromEntries(ROLE_FLAGS.map((f) => [f, !!role[f]])) as Record<RoleFlag, boolean>
        )
      : [];
  }

  if (!user || !user.active) {
    return NextResponse.json({ error: "Compte introuvable ou désactivé." }, { status: 403 });
  }

  const flags = Object.fromEntries(ROLE_FLAGS.map((f) => [f, !!user.role[f]])) as Record<RoleFlag, boolean>;
  return {
    userId,
    email: user.email.toLowerCase(),
    pages: user.role.pages.map((p) => p.page).filter(isPageKey),
    permissions,
    flags,
  };
}

/** Vrai si les droits autorisent l'action (page du module + clé, ou case historique). */
export function peut(droits: DroitsUtilisateur, key: string): boolean {
  return aLeDroit(droits, key);
}

/** Message de refus en français pour une action. */
export function refusDroit(key: string): NextResponse {
  const page = pageDeCle(key);
  const detail = page ? ` (page « ${LIBELLES_PAGES[page]} »)` : "";
  return NextResponse.json(
    { error: `Votre rôle n'a pas le droit : « ${libelleDroit(key)} »${detail}. Voyez avec l'administrateur (Paramètres → Rôles).` },
    { status: 403 }
  );
}

/**
 * Garde de route : exige le droit `key` (et la page de son module). Renvoie les droits si
 * autorisé, sinon la réponse d'erreur à renvoyer telle quelle.
 */
export async function requirePermission(key: string): Promise<DroitsServeur | NextResponse> {
  const droits = await getDroits();
  if (droits instanceof NextResponse) return droits;
  if (!peut(droits, key)) return refusDroit(key);
  return droits;
}
