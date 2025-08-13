/*
  Warnings:

  - The values [Activer] on the enum `StatusFacture` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."StatusFacture_new" AS ENUM ('Brouillon', 'Envoyer', 'Valider', 'Annuler', 'Archiver', 'Payer');
ALTER TABLE "public"."Invoice" ALTER COLUMN "statut" DROP DEFAULT;
ALTER TABLE "public"."Invoice" ALTER COLUMN "statut" TYPE "public"."StatusFacture_new" USING ("statut"::text::"public"."StatusFacture_new");
ALTER TYPE "public"."StatusFacture" RENAME TO "StatusFacture_old";
ALTER TYPE "public"."StatusFacture_new" RENAME TO "StatusFacture";
DROP TYPE "public"."StatusFacture_old";
ALTER TABLE "public"."Invoice" ALTER COLUMN "statut" SET DEFAULT 'Brouillon';
COMMIT;
