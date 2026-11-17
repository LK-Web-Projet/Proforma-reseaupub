-- CreateEnum
CREATE TYPE "SourceDepense" AS ENUM ('MANUEL', 'PROFORMA', 'CAMPTRACK');

-- AlterEnum
ALTER TYPE "StatutCommandeFournisseur" ADD VALUE 'PAYEE';

-- AlterTable
ALTER TABLE "BudgetDepense" ADD COLUMN     "referenceExterne" TEXT,
ADD COLUMN     "source" "SourceDepense" NOT NULL DEFAULT 'MANUEL';

-- AlterTable
ALTER TABLE "paiements" ADD COLUMN     "aRattacherBudget" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ImputationCommande" (
    "id" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "ligneCommandeId" TEXT NOT NULL,
    "cashJournalEntryId" INTEGER NOT NULL,
    "montant" DECIMAL(12,2) NOT NULL,
    "nature" "NatureDepense" NOT NULL,
    "factureFournisseurId" TEXT,
    "annuleeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImputationCommande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotPaiement" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "referenceOperateur" TEXT,
    "proformaId" TEXT NOT NULL,
    "nbBeneficiaires" INTEGER NOT NULL,
    "montant" DECIMAL(12,2) NOT NULL,
    "modePaiement" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    "comptableEmail" TEXT NOT NULL,
    "cashJournalEntryId" INTEGER NOT NULL,
    "budgetDepenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LotPaiement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImputationCommande_commandeId_idx" ON "ImputationCommande"("commandeId");

-- CreateIndex
CREATE INDEX "ImputationCommande_cashJournalEntryId_idx" ON "ImputationCommande"("cashJournalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "LotPaiement_reference_key" ON "LotPaiement"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "LotPaiement_cashJournalEntryId_key" ON "LotPaiement"("cashJournalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "LotPaiement_budgetDepenseId_key" ON "LotPaiement"("budgetDepenseId");

-- AddForeignKey
ALTER TABLE "ImputationCommande" ADD CONSTRAINT "ImputationCommande_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "CommandeFournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImputationCommande" ADD CONSTRAINT "ImputationCommande_ligneCommandeId_fkey" FOREIGN KEY ("ligneCommandeId") REFERENCES "LigneCommandeFournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImputationCommande" ADD CONSTRAINT "ImputationCommande_cashJournalEntryId_fkey" FOREIGN KEY ("cashJournalEntryId") REFERENCES "CashJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotPaiement" ADD CONSTRAINT "LotPaiement_cashJournalEntryId_fkey" FOREIGN KEY ("cashJournalEntryId") REFERENCES "CashJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotPaiement" ADD CONSTRAINT "LotPaiement_budgetDepenseId_fkey" FOREIGN KEY ("budgetDepenseId") REFERENCES "BudgetDepense"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Reprise : les dépenses de budget déjà liées à un bon de commande (Lot C) sont imputées sur ses
-- lignes de produit, au prorata de leur montant HT.
INSERT INTO "ImputationCommande" ("id", "commandeId", "ligneCommandeId", "cashJournalEntryId", "montant", "nature", "factureFournisseurId", "annuleeAt", "createdAt")
SELECT gen_random_uuid()::text, d."commandeId", l."id", d."cashJournalEntryId",
       ROUND(d."montant" * l."prixTotal" / c."totalHT", 2), d."nature", d."factureFournisseurId", d."annuleeAt", d."createdAt"
FROM "BudgetDepense" d
JOIN "CommandeFournisseur" c ON c."id" = d."commandeId"
JOIN "LigneCommandeFournisseur" l ON l."commandeId" = c."id"
WHERE d."commandeId" IS NOT NULL AND c."totalHT" > 0;
