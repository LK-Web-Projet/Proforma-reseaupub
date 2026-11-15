-- CreateEnum
CREATE TYPE "TypeDocumentCommande" AS ENUM ('BC_SIGNE', 'BORDEREAU_LIVRAISON', 'ATTESTATION_SERVICE_FAIT', 'FACTURE', 'RAPPORT', 'AUTRE');

-- CreateEnum
CREATE TYPE "NatureDepense" AS ENUM ('NORMALE', 'AVANCE', 'SOLDE');

-- CreateEnum
CREATE TYPE "CanalNotification" AS ENUM ('EMAIL', 'APP', 'LES_DEUX');

-- AlterTable
ALTER TABLE "BudgetDepense" ADD COLUMN     "commandeId" TEXT,
ADD COLUMN     "factureFournisseurId" TEXT,
ADD COLUMN     "nature" "NatureDepense" NOT NULL DEFAULT 'NORMALE';

-- AlterTable
ALTER TABLE "CommandeFournisseur" ADD COLUMN     "ligneBudgetId" TEXT;

-- AlterTable
ALTER TABLE "FactureFournisseur" ADD COLUMN     "commandeId" TEXT;

-- CreateTable
CREATE TABLE "CommandeFournisseurDocument" (
    "id" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "kind" "TypeDocumentCommande" NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "createdByEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommandeFournisseurDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "destinataireEmail" TEXT NOT NULL,
    "evenement" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "lien" TEXT,
    "luAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "evenement" TEXT NOT NULL,
    "canal" "CanalNotification" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByEmail" TEXT,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("evenement")
);

-- CreateTable
CREATE TABLE "TacheExecution" (
    "cle" TEXT NOT NULL,
    "executeeAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resultat" TEXT,

    CONSTRAINT "TacheExecution_pkey" PRIMARY KEY ("cle")
);

-- CreateIndex
CREATE INDEX "Notification_destinataireEmail_luAt_idx" ON "Notification"("destinataireEmail", "luAt");

-- CreateIndex
CREATE INDEX "Notification_destinataireEmail_createdAt_idx" ON "Notification"("destinataireEmail", "createdAt");

-- AddForeignKey
ALTER TABLE "FactureFournisseur" ADD CONSTRAINT "FactureFournisseur_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "CommandeFournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeFournisseur" ADD CONSTRAINT "CommandeFournisseur_ligneBudgetId_fkey" FOREIGN KEY ("ligneBudgetId") REFERENCES "DemandeBudgetLigne"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeFournisseurDocument" ADD CONSTRAINT "CommandeFournisseurDocument_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "CommandeFournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetDepense" ADD CONSTRAINT "BudgetDepense_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "CommandeFournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetDepense" ADD CONSTRAINT "BudgetDepense_factureFournisseurId_fkey" FOREIGN KEY ("factureFournisseurId") REFERENCES "FactureFournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

