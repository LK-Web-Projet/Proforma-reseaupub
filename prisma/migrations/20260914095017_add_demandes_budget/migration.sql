-- CreateEnum
CREATE TYPE "StatutDemandeBudget" AS ENUM ('SOUMISE', 'VALIDEE', 'REJETEE', 'PAYEE');

-- CreateEnum
CREATE TYPE "ModePaiementDemande" AS ENUM ('VIREMENT', 'CHEQUE', 'ESPECES', 'MOBILE_MONEY', 'AUTRE');

-- CreateEnum
CREATE TYPE "TypeAttachmentDemande" AS ENUM ('DOCUMENT_COMMANDE', 'PREUVE_PAIEMENT');

-- CreateTable
CREATE TABLE "DemandeBudget" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "statut" "StatutDemandeBudget" NOT NULL DEFAULT 'SOUMISE',
    "requesterEmail" TEXT NOT NULL,
    "requesterName" TEXT,
    "departement" TEXT,
    "contexteMotivation" TEXT NOT NULL,
    "montantTotal" DECIMAL(12,2) NOT NULL,
    "modePaiement" "ModePaiementDemande" NOT NULL,
    "typeDepense" TEXT NOT NULL,
    "pourLeCompteDe" TEXT,
    "dateLimiteSouhaitee" TIMESTAMP(3),
    "bonCommandeId" TEXT,
    "nomReceveur" TEXT,
    "datePaiement" TIMESTAMP(3),
    "validatedByEmail" TEXT,
    "validatedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemandeBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandeBudgetLigne" (
    "id" TEXT NOT NULL,
    "demandeBudgetId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "montant" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "DemandeBudgetLigne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandeBudgetProforma" (
    "demandeBudgetId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,

    CONSTRAINT "DemandeBudgetProforma_pkey" PRIMARY KEY ("demandeBudgetId","invoiceId")
);

-- CreateTable
CREATE TABLE "DemandeBudgetAttachment" (
    "id" TEXT NOT NULL,
    "demandeBudgetId" TEXT NOT NULL,
    "kind" "TypeAttachmentDemande" NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemandeBudgetAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DemandeBudget_numero_key" ON "DemandeBudget"("numero");

-- AddForeignKey
ALTER TABLE "DemandeBudget" ADD CONSTRAINT "DemandeBudget_bonCommandeId_fkey" FOREIGN KEY ("bonCommandeId") REFERENCES "CommandeFournisseur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeBudgetLigne" ADD CONSTRAINT "DemandeBudgetLigne_demandeBudgetId_fkey" FOREIGN KEY ("demandeBudgetId") REFERENCES "DemandeBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeBudgetProforma" ADD CONSTRAINT "DemandeBudgetProforma_demandeBudgetId_fkey" FOREIGN KEY ("demandeBudgetId") REFERENCES "DemandeBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeBudgetProforma" ADD CONSTRAINT "DemandeBudgetProforma_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeBudgetAttachment" ADD CONSTRAINT "DemandeBudgetAttachment_demandeBudgetId_fkey" FOREIGN KEY ("demandeBudgetId") REFERENCES "DemandeBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
