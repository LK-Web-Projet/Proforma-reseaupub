-- AlterTable
ALTER TABLE "EntrepriseConfig" ADD COLUMN     "typesBudgetSigneRequis" "TypeBudget"[] DEFAULT ARRAY['CAMPAGNE', 'MENSUEL']::"TypeBudget"[];

