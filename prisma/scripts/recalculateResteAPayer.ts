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
        select: { montant: true, type: true },
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
      const totalPaid = invoice.paiements
        .filter((p: { type: string }) => p.type === 'PAIEMENT')
        .reduce(
          (sum: number, paiement: { montant: { toNumber: () => number; }; }) => sum + paiement.montant.toNumber(),
          0
        );
      newResteAPayer = invoice.totalTTC.minus(totalPaid);
    }

    const newResteAPayerNum = newResteAPayer.toNumber();
    const totalTTCNum = invoice.totalTTC.toNumber();
    let newStatus = invoice.statut;

    if (newResteAPayerNum <= 0) {
      newStatus = 'Solde';
    } else if (newResteAPayerNum < totalTTCNum) {
      newStatus = 'Payer';
    } else if (newResteAPayerNum === totalTTCNum && (invoice.statut === 'Payer' || invoice.statut === 'Solde')) {
      newStatus = 'Valider';
    }

    if (invoice.resteAPayer.toNumber() !== newResteAPayerNum || newStatus !== invoice.statut) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { 
          resteAPayer: newResteAPayer,
          statut: newStatus
        },
      });
      console.log(`Updated invoice ${invoice.numero}: resteAPayer set to ${newResteAPayerNum}, status set to ${newStatus}`);
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

