-- CreateEnum
CREATE TYPE "StatutLigneBudget" AS ENUM ('EN_ATTENTE', 'ACCORDEE', 'A_CORRIGER', 'RETIREE');

-- AlterEnum
ALTER TYPE "StatutDemandeBudget" ADD VALUE 'VALIDATION_PARTIELLE';

-- AlterEnum
ALTER TYPE "ActionBudget" ADD VALUE 'LIGNE_ACCORDEE';
ALTER TYPE "ActionBudget" ADD VALUE 'LIGNE_A_CORRIGER';
ALTER TYPE "ActionBudget" ADD VALUE 'LIGNE_CORRIGEE';
ALTER TYPE "ActionBudget" ADD VALUE 'LIGNE_RETIREE';

-- AlterTable
ALTER TABLE "DemandeBudgetLigne" ADD COLUMN     "decideAt" TIMESTAMP(3),
ADD COLUMN     "decideParEmail" TEXT,
ADD COLUMN     "montantAccorde" DECIMAL(12,2),
ADD COLUMN     "motifDecision" TEXT,
ADD COLUMN     "statutValidation" "StatutLigneBudget" NOT NULL DEFAULT 'EN_ATTENTE';

-- Reprise : les lignes des budgets déjà validés sont considérées comme accordées au montant demandé
-- (aucun changement de comportement pour l'existant). Les autres restent EN_ATTENTE.
UPDATE "DemandeBudgetLigne" SET "statutValidation" = 'ACCORDEE', "decideParEmail" = d."validatedByEmail", "decideAt" = d."validatedAt"
FROM "DemandeBudget" d
WHERE d."id" = "DemandeBudgetLigne"."demandeBudgetId" AND d."statut" IN ('VALIDEE', 'EN_COURS', 'PAYEE');
