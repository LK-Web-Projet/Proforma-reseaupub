import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding ...');


  // Initialisation de la configuration de l'entreprise
  console.log('Initializing EntrepriseConfig...');
  const { DEFAULT_ENTREPRISE } = await import('../lib/entreprise');
  await prisma.entrepriseConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: DEFAULT_ENTREPRISE,
  });
  console.log('EntrepriseConfig initialized.');

  // Logic to update old invoices' resteAPayer
  // console.log('Updating resteAPayer for old invoices...');
  // const invoicesToUpdate = await prisma.invoice.findMany({
  //   where: {
  //     resteAPayer: 0.00, // Find invoices where resteAPayer is exactly 0.00
  //     totalTTC: {
  //       gt: 0, // And totalTTC is strictly greater than 0
  //     },
  //   },
  // });

  // if (invoicesToUpdate.length === 0) {
  //   console.log('No invoices found matching the criteria (resteAPayer = 0.00 and totalTTC > 0).');
  // } else {
  //   console.log(`Found ${invoicesToUpdate.length} invoices to update. Details:`);
  //   for (const invoice of invoicesToUpdate) {
  //     console.log(`  - Invoice ID: ${invoice.id}, Numero: ${invoice.numero}, Current resteAPayer: ${invoice.resteAPayer}, totalTTC: ${invoice.totalTTC}`);
  //     await prisma.invoice.update({
  //       where: { id: invoice.id },
  //       data: {
  //         resteAPayer: invoice.totalTTC,
  //       },
  //     });
  //     console.log(`Updated invoice ${invoice.numero}: resteAPayer set to ${invoice.totalTTC}`);
  //   }
  // }
  // console.log('Finished updating resteAPayer for old invoices.');

  // console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });