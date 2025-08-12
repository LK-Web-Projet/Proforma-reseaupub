/*
  Warnings:

  - The `statut` column on the `Invoice` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "public"."StatusFacture" AS ENUM ('Brouillon', 'Envoyer', 'Valider', 'Annuler', 'Archiver');

-- AlterTable
ALTER TABLE "public"."Invoice" DROP COLUMN "statut",
ADD COLUMN     "statut" "public"."StatusFacture" NOT NULL DEFAULT 'Brouillon';

-- AlterTable
ALTER TABLE "public"."InvoiceProduit" ADD COLUMN     "includeduree" BOOLEAN NOT NULL DEFAULT false;
