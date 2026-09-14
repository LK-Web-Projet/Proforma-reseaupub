/**
 * Script de bootstrap à lancer UNE SEULE FOIS, juste après le déploiement de la migration
 * Prisma qui ajoute les tables Role/RolePage/User, et AVANT de mettre
 * ENABLE_PAGE_PERMISSIONS=true dans .env.
 *
 * Il crée un rôle "Admin" (accès à toutes les pages + gestion des comptes) et y rattache
 * TOUS les comptes Clerk existants, pour qu'aucun utilisateur actuel ne se retrouve bloqué
 * au moment où le contrôle d'accès par page est activé (aujourd'hui, tout le monde a accès
 * à tout — ce script préserve ce comportement le temps que l'admin métier crée ensuite des
 * rôles plus restreints via /parametres/roles et réassigne les comptes qui doivent l'être).
 *
 * Usage : npx tsx scripts/seed-admin-users.ts
 */
import { PrismaClient } from "@prisma/client";
import { clerkClient } from "@clerk/nextjs/server";
import { PAGE_KEYS } from "../lib/permissions";
import { syncUserMetadata } from "../lib/authz";

const prisma = new PrismaClient();

async function main() {
  console.log("Bootstrap rôles & utilisateurs — démarrage...");

  const adminRole = await prisma.role.upsert({
    where: { nom: "Admin" },
    update: { canManageUsers: true },
    create: {
      nom: "Admin",
      canManageUsers: true,
      pages: { create: PAGE_KEYS.map((page) => ({ page })) },
    },
  });
  console.log(`Rôle "Admin" prêt (id: ${adminRole.id}).`);

  const client = await clerkClient();

  let offset = 0;
  const limit = 100;
  let totalCreated = 0;
  let totalSkipped = 0;

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
        console.warn(`⚠️  Utilisateur Clerk ${clerkUser.id} sans email, ignoré.`);
        continue;
      }

      const nom = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || email;

      await prisma.user.create({
        data: { id: clerkUser.id, email, nom, roleId: adminRole.id },
      });
      await syncUserMetadata(clerkUser.id);

      console.log(`✔ Compte créé et synchronisé : ${email} (${clerkUser.id})`);
      totalCreated++;
    }

    offset += limit;
  }

  console.log(`Terminé. ${totalCreated} compte(s) créé(s), ${totalSkipped} déjà migré(s) (ignorés).`);
  console.log('Vous pouvez maintenant passer ENABLE_PAGE_PERMISSIONS=true dans .env en toute sécurité,');
  console.log('puis créer des rôles plus restreints depuis /parametres/roles si besoin.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
