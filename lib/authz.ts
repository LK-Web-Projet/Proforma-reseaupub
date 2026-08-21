import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { isPageKey, type AppPublicMetadata, type PageKey } from "@/lib/permissions";

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

  const allowed = user.role.pages.some((p) => p.page === pageKey);
  if (!allowed) {
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
