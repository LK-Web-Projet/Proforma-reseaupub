-- AlterTable
ALTER TABLE "FactureFournisseur" ADD COLUMN     "ligneBudgetId" TEXT;

-- AddForeignKey
ALTER TABLE "FactureFournisseur" ADD CONSTRAINT "FactureFournisseur_ligneBudgetId_fkey" FOREIGN KEY ("ligneBudgetId") REFERENCES "DemandeBudgetLigne"("id") ON DELETE SET NULL ON UPDATE CASCADE;

