-- AlterTable
ALTER TABLE "LotPaiement" ADD COLUMN     "campagneId" TEXT,
ADD COLUMN     "campagneNom" TEXT,
ADD COLUMN     "libelle" TEXT,
ALTER COLUMN "proformaId" DROP NOT NULL,
ALTER COLUMN "comptableEmail" DROP NOT NULL;

