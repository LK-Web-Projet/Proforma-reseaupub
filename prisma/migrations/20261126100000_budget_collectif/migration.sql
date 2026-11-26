-- Budget collectif (2026-11-26) : un budget mensuel (toujours) ou de campagne (au choix) est ouvert en
-- préparation ; les départements invités y saisissent leurs lignes ; le comptable (droit « Préparer et
-- soumettre les budgets collectifs ») vérifie puis soumet à la direction. Chacun voit les lignes de ses
-- départements ; le droit « Voir toutes les lignes » voit tout. Ajouts seulement.

-- AlterEnum
ALTER TYPE "StatutDemandeBudget" ADD VALUE 'EN_PREPARATION';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActionBudget" ADD VALUE 'PREPARATION';
ALTER TYPE "ActionBudget" ADD VALUE 'LIGNE_AJOUTEE';
ALTER TYPE "ActionBudget" ADD VALUE 'LIGNE_MODIFIEE';
ALTER TYPE "ActionBudget" ADD VALUE 'SOUMISSION';
ALTER TYPE "ActionBudget" ADD VALUE 'PREPARATION_ROUVERTE';

-- AlterTable
ALTER TABLE "DemandeBudget" ADD COLUMN     "collectif" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dateLimiteSaisie" TIMESTAMP(3),
ADD COLUMN     "pretASoumettreAt" TIMESTAMP(3),
ADD COLUMN     "rappelSaisieEnvoyeAt" TIMESTAMP(3),
ADD COLUMN     "responsableEmail" TEXT,
ADD COLUMN     "responsableNom" TEXT,
ADD COLUMN     "soumiseAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DemandeBudgetLigne" ADD COLUMN     "ajouteeAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "ajouteeParEmail" TEXT,
ADD COLUMN     "ajouteeParNom" TEXT;

-- CreateTable
CREATE TABLE "DemandeBudgetDepartement" (
    "demandeBudgetId" TEXT NOT NULL,
    "departementId" TEXT NOT NULL,
    "inviteAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemandeBudgetDepartement_pkey" PRIMARY KEY ("demandeBudgetId","departementId")
);

-- CreateTable
CREATE TABLE "UtilisateurDepartement" (
    "userId" TEXT NOT NULL,
    "departementId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UtilisateurDepartement_pkey" PRIMARY KEY ("userId","departementId")
);

-- AddForeignKey
ALTER TABLE "DemandeBudgetDepartement" ADD CONSTRAINT "DemandeBudgetDepartement_demandeBudgetId_fkey" FOREIGN KEY ("demandeBudgetId") REFERENCES "DemandeBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeBudgetDepartement" ADD CONSTRAINT "DemandeBudgetDepartement_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES "Departement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilisateurDepartement" ADD CONSTRAINT "UtilisateurDepartement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilisateurDepartement" ADD CONSTRAINT "UtilisateurDepartement_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES "Departement"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ── Reprise ────────────────────────────────────────────────────────────────────────────────────
-- Budgets existants : individuels ; responsable = demandeur ; lignes saisies par le demandeur.
UPDATE "DemandeBudget" SET "responsableEmail" = "requesterEmail", "responsableNom" = "requesterName"
WHERE "responsableEmail" IS NULL;

UPDATE "DemandeBudgetLigne" AS l
SET "ajouteeParEmail" = d."requesterEmail", "ajouteeParNom" = d."requesterName", "ajouteeAt" = d."createdAt"
FROM "DemandeBudget" AS d
WHERE l."demandeBudgetId" = d."id" AND l."ajouteeParEmail" IS NULL;

-- « Voir toutes les lignes » : rôles qui voyaient déjà toutes les demandes (valider, payer, petites dépenses).
INSERT INTO "RolePermission" ("roleId", "permission")
SELECT "id", 'budget.toutesLignes' FROM "Role"
WHERE "canValidateBudget" OR "canValidateBudgetMensuel" OR "canPayBudget" OR "canSaisirPetiteDepense"
ON CONFLICT DO NOTHING;

-- « Préparer et soumettre les budgets collectifs » : comptables (droit « Dépenser / payer »).
INSERT INTO "RolePermission" ("roleId", "permission")
SELECT "id", 'budget.preparer' FROM "Role"
WHERE "canPayBudget"
ON CONFLICT DO NOTHING;
