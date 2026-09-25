/**
 * Crée le rôle "Admin" (accès à toutes les pages + gestion des comptes) s'il n'existe pas
 * encore, et y rattache tout compte Clerk qui n'a pas encore de `User` local — pour qu'aucun
 * utilisateur ne se retrouve bloqué par le contrôle d'accès par page. Idempotent : un compte
 * déjà migré (User local existant) n'est jamais retouché, donc rappeler cette fonction ne fait
 * rien pour ce qui est déjà en place.
 *
 * Utilisée à la fois par scripts/seed-admin-users.ts (exécution manuelle ponctuelle) et par
 * instrumentation.ts (exécution automatique à chaque démarrage du serveur).
 */
import { clerkClient } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { PAGE_KEYS } from "@/lib/permissions";
import { syncUserMetadata } from "@/lib/authz";

export interface BootstrapAdminUsersResult {
  totalCreated: number;
  totalSkipped: number;
  createdEmails: string[];
}

export async function bootstrapAdminUsers(): Promise<BootstrapAdminUsersResult> {
  const adminRole = await prisma.role.upsert({
    where: { nom: "Admin" },
    update: { canManageUsers: true },
    create: {
      nom: "Admin",
      canManageUsers: true,
      pages: { create: PAGE_KEYS.map((page) => ({ page })) },
    },
  });

  const client = await clerkClient();

  let offset = 0;
  const limit = 100;
  let totalCreated = 0;
  let totalSkipped = 0;
  const createdEmails: string[] = [];

  for (;;) {
    const { data: clerkUsers } = await client.users.getUserList({ limit, offset });
    if (clerkUsers.length === 0) break;

    for (const clerkUser of clerkUsers) {
      const existing = await prisma.user.findUnique({ where: { id: clerkUser.id } });
      if (existing) {
        totalSkipped++;
        continue;
      }

      const email = clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId
      )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

      if (!email) {
        continue;
      }

      const nom = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || email;

      await prisma.user.create({
        data: { id: clerkUser.id, email, nom, roleId: adminRole.id },
      });
      await syncUserMetadata(clerkUser.id);

      createdEmails.push(email);
      totalCreated++;
    }

    offset += limit;
  }

  return { totalCreated, totalSkipped, createdEmails };
}
