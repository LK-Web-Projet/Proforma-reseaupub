-- CreateEnum
CREATE TYPE "public"."PaiementType" AS ENUM ('PAIEMENT', 'DEPENSE');

-- AlterTable
ALTER TABLE "public"."paiements" ADD COLUMN     "type" "public"."PaiementType" NOT NULL DEFAULT 'PAIEMENT';
