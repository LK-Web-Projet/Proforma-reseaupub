-- Liasse du bon de commande : proforma fournisseur, BAT signé, libellé des documents « Autre ».
-- AlterEnum
ALTER TYPE "TypeDocumentCommande" ADD VALUE 'PROFORMA_FOURNISSEUR';
ALTER TYPE "TypeDocumentCommande" ADD VALUE 'BAT_SIGNE';

-- AlterTable
ALTER TABLE "CommandeFournisseurDocument" ADD COLUMN     "libelle" TEXT;
