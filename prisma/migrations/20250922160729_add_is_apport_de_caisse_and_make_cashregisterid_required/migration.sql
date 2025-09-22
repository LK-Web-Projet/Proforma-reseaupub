/*
  Warnings:

  - Made the column `cashRegisterId` on table `CashJournal` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."CashJournal" DROP CONSTRAINT "CashJournal_cashRegisterId_fkey";

-- AlterTable
ALTER TABLE "public"."CashJournal" ADD COLUMN     "isApportDeCaisse" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "cashRegisterId" SET NOT NULL,
ALTER COLUMN "cashRegisterId" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "public"."CashJournal" ADD CONSTRAINT "CashJournal_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "public"."CashRegister"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
