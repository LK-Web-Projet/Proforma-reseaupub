/**
 * Lance manuellement le bootstrap rôles & utilisateurs (voir lib/bootstrapAdminUsers.ts).
 * Utile pour vérifier/forcer la synchronisation en dehors du démarrage automatique du
 * serveur (voir instrumentation.ts, qui appelle la même fonction à chaque démarrage).
 *
 * Usage : npx tsx scripts/seed-admin-users.ts
 */
import prisma from "../lib/prisma";
import { bootstrapAdminUsers } from "../lib/bootstrapAdminUsers";

async function main() {
  console.log("Bootstrap rôles & utilisateurs — démarrage...");
  const { totalCreated, totalSkipped, createdEmails } = await bootstrapAdminUsers();

  createdEmails.forEach((email) => console.log(`✔ Compte créé et synchronisé : ${email}`));

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
