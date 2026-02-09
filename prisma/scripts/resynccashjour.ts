//  npx ts-node prisma/scripts/resynccashjour.ts // Pour exécuter ce script

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Correction de la séquence CashJournal
  await prisma.$executeRawUnsafe(`
    SELECT setval(
  pg_get_serial_sequence('"CashJournal"', 'id'),
  COALESCE((SELECT MAX(id) FROM "CashJournal"), 1),
  true
);
  `);

  console.log("✅ Séquence CashJournal resynchronisée avec succès !");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

