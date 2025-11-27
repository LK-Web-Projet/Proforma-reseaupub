-- AlterTable
ALTER TABLE "public"."Invoice" ADD COLUMN     "info" TEXT,
ADD COLUMN     "isTaxExempt" BOOLEAN NOT NULL DEFAULT false;
