import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding ...');

  const cashRegisters = [
    { name: 'Caisse Comptable', balance: 0 },
  ];

  for (const data of cashRegisters) {
    await prisma.cashRegister.upsert({
      where: { name: data.name },
      update: {},
      create: data,
    });
    console.log(`Upserted cash register: ${data.name}`);
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
