-- CreateEnum
CREATE TYPE "TypeBudget" AS ENUM ('MENSUEL', 'PONCTUEL', 'CAMPAGNE', 'TIERS');

-- AlterEnum
ALTER TYPE "StatutDemandeBudget" ADD VALUE 'EN_COURS';

-- AlterTable
ALTER TABLE "DemandeBudget" ADD COLUMN     "clotureeAt" TIMESTAMP(3),
ADD COLUMN     "clotureeParEmail" TEXT,
ADD COLUMN     "periodeMois" TIMESTAMP(3),
ADD COLUMN     "type" "TypeBudget" NOT NULL DEFAULT 'PONCTUEL';

-- AlterTable
ALTER TABLE "DemandeBudgetAttachment" ADD COLUMN     "depenseId" TEXT;

-- AlterTable
ALTER TABLE "EntrepriseConfig" ADD COLUMN     "plafondValidationDeleguee" DECIMAL(12,2) NOT NULL DEFAULT 500000;

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "canPayBudget" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canValidateBudget" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canValidateBudgetMensuel" BOOLEAN NOT NULL DEFAULT false;

-- Reprise : les rôles qui gèrent les comptes (administrateurs) reçoivent les deux droits de
-- validation, pour que personne ne se retrouve bloqué au passage des emails .env aux rôles.
-- Le droit "canPayBudget" (comptable) est à cocher dans Paramètres > Rôles.
UPDATE "Role" SET "canValidateBudgetMensuel" = true, "canValidateBudget" = true WHERE "canManageUsers" = true;

-- CreateTable
CREATE TABLE "BudgetDepense" (
    "id" TEXT NOT NULL,
    "demandeBudgetId" TEXT NOT NULL,
    "ligneId" TEXT NOT NULL,
    "montant" DECIMAL(12,2) NOT NULL,
    "dateDepense" TIMESTAMP(3) NOT NULL,
    "nomReceveur" TEXT NOT NULL,
    "modePaiement" "ModePaiementDemande" NOT NULL,
    "notes" TEXT,
    "cashRegisterId" INTEGER NOT NULL,
    "cashJournalEntryId" INTEGER NOT NULL,
    "invoiceId" TEXT,
    "sansJustificatif" BOOLEAN NOT NULL DEFAULT false,
    "motifSansJustificatif" TEXT,
    "createdByEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetDepense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetCommentaire" (
    "id" TEXT NOT NULL,
    "demandeBudgetId" TEXT NOT NULL,
    "ligneId" TEXT NOT NULL,
    "auteurEmail" TEXT NOT NULL,
    "auteurNom" TEXT,
    "contenu" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetCommentaire_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BudgetDepense_cashJournalEntryId_key" ON "BudgetDepense"("cashJournalEntryId");

-- AddForeignKey
ALTER TABLE "BudgetDepense" ADD CONSTRAINT "BudgetDepense_demandeBudgetId_fkey" FOREIGN KEY ("demandeBudgetId") REFERENCES "DemandeBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetDepense" ADD CONSTRAINT "BudgetDepense_ligneId_fkey" FOREIGN KEY ("ligneId") REFERENCES "DemandeBudgetLigne"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetDepense" ADD CONSTRAINT "BudgetDepense_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "CashRegister"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetDepense" ADD CONSTRAINT "BudgetDepense_cashJournalEntryId_fkey" FOREIGN KEY ("cashJournalEntryId") REFERENCES "CashJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetDepense" ADD CONSTRAINT "BudgetDepense_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetCommentaire" ADD CONSTRAINT "BudgetCommentaire_demandeBudgetId_fkey" FOREIGN KEY ("demandeBudgetId") REFERENCES "DemandeBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetCommentaire" ADD CONSTRAINT "BudgetCommentaire_ligneId_fkey" FOREIGN KEY ("ligneId") REFERENCES "DemandeBudgetLigne"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeBudgetAttachment" ADD CONSTRAINT "DemandeBudgetAttachment_depenseId_fkey" FOREIGN KEY ("depenseId") REFERENCES "BudgetDepense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
