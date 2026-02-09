//  npx ts-node prisma/scripts/recalculateResteAPayer.ts // Pour exécuter ce script

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log(
    "Starting data migration: Recalculating resteAPayer for all invoices..."
  );

  const allInvoices = await prisma.invoice.findMany({
    include: {
      paiements: {
        select: { montant: true },
      },
    },
  });

  if (allInvoices.length === 0) {
    console.log("No invoices found to process.");
    return;
  }

  let updatedCount = 0;
  for (const invoice of allInvoices) {
    let newResteAPayer = invoice.totalTTC;

    if (invoice.paiements.length > 0) {
      const totalPaid = invoice.paiements.reduce(
        (sum: number, paiement: { montant: { toNumber: () => number; }; }) => sum + paiement.montant.toNumber(),
        0
      );
      newResteAPayer = invoice.totalTTC.minus(totalPaid);
    }

    if (invoice.resteAPayer.toNumber() !== newResteAPayer.toNumber()) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { resteAPayer: newResteAPayer },
      });
      console.log(`Updated invoice ${invoice.numero}: resteAPayer updated.`);
      updatedCount++;
    }
  }

  console.log(`Finished migration. Total invoices updated: ${updatedCount}.`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });

