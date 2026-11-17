-- AlterTable
ALTER TABLE "EntrepriseConfig" ADD COLUMN     "liasseExigeePourSolde" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "plafondPetiteDepense" DECIMAL(12,2) NOT NULL DEFAULT 50000;

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "canSaisirPetiteDepense" BOOLEAN NOT NULL DEFAULT false;

