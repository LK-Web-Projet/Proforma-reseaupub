-- CreateEnum
CREATE TYPE "StatutDepassement" AS ENUM ('EN_ATTENTE', 'APPROUVE', 'REJETE');

-- CreateEnum
CREATE TYPE "ActionBudget" AS ENUM ('CREATION', 'RESOUMISSION', 'VALIDATION', 'REJET', 'DEPENSE', 'ANNULATION_DEPENSE', 'JUSTIFICATIF', 'DOCUMENTS', 'DEPASSEMENT_DEMANDE', 'DEPASSEMENT_APPROUVE', 'DEPASSEMENT_REJETE', 'CLOTURE', 'PAIEMENT_ANCIEN_CIRCUIT');

-- AlterTable
ALTER TABLE "BudgetDepense" ADD COLUMN     "annuleeAt" TIMESTAMP(3),
ADD COLUMN     "annuleeParEmail" TEXT,
ADD COLUMN     "contreEcritureId" INTEGER,
ADD COLUMN     "motifAnnulation" TEXT;

-- CreateTable
CREATE TABLE "BudgetDepassement" (
    "id" TEXT NOT NULL,
    "demandeBudgetId" TEXT NOT NULL,
    "ligneId" TEXT NOT NULL,
    "montant" DECIMAL(12,2) NOT NULL,
    "motif" TEXT NOT NULL,
    "statut" "StatutDepassement" NOT NULL DEFAULT 'EN_ATTENTE',
    "demandeParEmail" TEXT NOT NULL,
    "demandeParNom" TEXT,
    "decideParEmail" TEXT,
    "decideAt" TIMESTAMP(3),
    "motifRejet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetDepassement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetHistorique" (
    "id" TEXT NOT NULL,
    "demandeBudgetId" TEXT NOT NULL,
    "action" "ActionBudget" NOT NULL,
    "details" TEXT,
    "montant" DECIMAL(12,2),
    "auteurEmail" TEXT NOT NULL,
    "auteurNom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetHistorique_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BudgetHistorique_demandeBudgetId_createdAt_idx" ON "BudgetHistorique"("demandeBudgetId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetDepense_contreEcritureId_key" ON "BudgetDepense"("contreEcritureId");

-- AddForeignKey
ALTER TABLE "BudgetDepense" ADD CONSTRAINT "BudgetDepense_contreEcritureId_fkey" FOREIGN KEY ("contreEcritureId") REFERENCES "CashJournal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetDepassement" ADD CONSTRAINT "BudgetDepassement_demandeBudgetId_fkey" FOREIGN KEY ("demandeBudgetId") REFERENCES "DemandeBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetDepassement" ADD CONSTRAINT "BudgetDepassement_ligneId_fkey" FOREIGN KEY ("ligneId") REFERENCES "DemandeBudgetLigne"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetHistorique" ADD CONSTRAINT "BudgetHistorique_demandeBudgetId_fkey" FOREIGN KEY ("demandeBudgetId") REFERENCES "DemandeBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------------------
-- Reprise de l'historique des demandes existantes, à partir des champs déjà enregistrés
-- (création, validation / rejet, dépenses du Lot 1, clôture, ancien circuit "payée").
-- ---------------------------------------------------------------------------------------
INSERT INTO "BudgetHistorique" ("id", "demandeBudgetId", "action", "details", "montant", "auteurEmail", "auteurNom", "createdAt")
SELECT gen_random_uuid()::text, "id", 'CREATION'::"ActionBudget", 'Demande soumise (reprise de l''historique)', "montantTotal", "requesterEmail", "requesterName", "createdAt"
FROM "DemandeBudget";

INSERT INTO "BudgetHistorique" ("id", "demandeBudgetId", "action", "details", "montant", "auteurEmail", "auteurNom", "createdAt")
SELECT gen_random_uuid()::text, "id", 'VALIDATION'::"ActionBudget", NULL, NULL, "validatedByEmail", NULL, "validatedAt"
FROM "DemandeBudget"
WHERE "validatedAt" IS NOT NULL AND "validatedByEmail" IS NOT NULL AND "statut" NOT IN ('SOUMISE', 'REJETEE');

INSERT INTO "BudgetHistorique" ("id", "demandeBudgetId", "action", "details", "montant", "auteurEmail", "auteurNom", "createdAt")
SELECT gen_random_uuid()::text, "id", 'REJET'::"ActionBudget", "rejectionReason", NULL, "validatedByEmail", NULL, "validatedAt"
FROM "DemandeBudget"
WHERE "statut" = 'REJETEE' AND "validatedAt" IS NOT NULL AND "validatedByEmail" IS NOT NULL;

INSERT INTO "BudgetHistorique" ("id", "demandeBudgetId", "action", "details", "montant", "auteurEmail", "auteurNom", "createdAt")
SELECT gen_random_uuid()::text, d."demandeBudgetId", 'DEPENSE'::"ActionBudget", l."designation" || ' — ' || d."nomReceveur", d."montant", d."createdByEmail", NULL, d."createdAt"
FROM "BudgetDepense" d
JOIN "DemandeBudgetLigne" l ON l."id" = d."ligneId";

INSERT INTO "BudgetHistorique" ("id", "demandeBudgetId", "action", "details", "montant", "auteurEmail", "auteurNom", "createdAt")
SELECT gen_random_uuid()::text, "id", 'CLOTURE'::"ActionBudget", NULL, NULL, "clotureeParEmail", NULL, "clotureeAt"
FROM "DemandeBudget"
WHERE "clotureeAt" IS NOT NULL AND "clotureeParEmail" IS NOT NULL;

INSERT INTO "BudgetHistorique" ("id", "demandeBudgetId", "action", "details", "montant", "auteurEmail", "auteurNom", "createdAt")
SELECT gen_random_uuid()::text, db."id", 'PAIEMENT_ANCIEN_CIRCUIT'::"ActionBudget", 'Receveur : ' || COALESCE(db."nomReceveur", '-'), db."montantTotal", 'comptable (ancien circuit)', NULL, db."datePaiement"
FROM "DemandeBudget" db
WHERE db."statut" = 'PAYEE' AND db."datePaiement" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "BudgetDepense" bd WHERE bd."demandeBudgetId" = db."id");
