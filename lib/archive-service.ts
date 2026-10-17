import { prisma } from './prisma';

/**
 * Script d'archivage automatique des factures.
 * À exécuter via cron job ou au démarrage de l'application.
 */
export async function archiveOldInvoices() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  try {
    const result = await prisma.invoice.updateMany({
      where: {
        dateCreation: {
          lte: thirtyDaysAgo,
        },
        statut: 'Brouillon',
      },
      data: {
        statut: 'Archiver',
      },
    });

    if (result.count > 0) {
      console.log(`[Archivage Auto] ${result.count} facture(s) de plus de 30 jours ont été archivées.`);
    }
    return result.count;
  } catch (error) {
    console.error('[Archivage Auto] Erreur :', error);
    throw error;
  }
}

// Permet l'exécution directe via `ts-node` ou `tsx`
if (require.main === module) {
  archiveOldInvoices()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
