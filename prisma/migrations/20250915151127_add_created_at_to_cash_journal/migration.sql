/*
  Warnings:

  - You are about to drop the column `date_enregistrement` on the `CashJournal` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."CashJournal" DROP COLUMN "date_enregistrement",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
