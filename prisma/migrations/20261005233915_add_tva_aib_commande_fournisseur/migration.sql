-- AlterTable
ALTER TABLE "CommandeFournisseur" ADD COLUMN     "appliquerAib" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "appliquerTva" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "montantAib" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalTTC" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "tva" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- DataMigration: les bons de commande existants n'ont jamais eu de TVA/AIB appliquée,
-- on initialise donc leur totalTTC à leur totalHT (au lieu de 0) pour rester cohérent.
UPDATE "CommandeFournisseur" SET "totalTTC" = "totalHT";
