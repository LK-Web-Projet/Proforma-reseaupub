-- Procédure de paiement — Lot A : verrou du journal de caisse, moyen de paiement par ligne,
-- carte bancaire, scan du budget signé.

-- AlterEnum
ALTER TYPE "ModePaiementDemande" ADD VALUE 'CARTE';

-- AlterEnum
ALTER TYPE "TypeAttachmentDemande" ADD VALUE 'BUDGET_SIGNE';

-- AlterTable
ALTER TABLE "DemandeBudgetLigne" ADD COLUMN     "modePaiement" "ModePaiementDemande";

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "canSaisirCaisse" BOOLEAN NOT NULL DEFAULT false;

-- Reprise : les lignes existantes prennent le mode de paiement de leur demande.
UPDATE "DemandeBudgetLigne" l
SET "modePaiement" = d."modePaiement"
FROM "DemandeBudget" d
WHERE l."demandeBudgetId" = d."id" AND l."modePaiement" IS NULL;

-- Reprise : personne ne perd l'accès du jour au lendemain. Le droit de saisie au journal de
-- caisse est coché sur les rôles qui y avaient déjà accès (section Finance), ainsi que sur
-- l'administration et le comptable. L'admin décoche ensuite ce qui ne doit plus l'être.
UPDATE "Role"
SET "canSaisirCaisse" = true
WHERE "canManageUsers" = true
   OR "canPayBudget" = true
   OR "id" IN (SELECT "roleId" FROM "RolePage" WHERE "page" = 'finance');
