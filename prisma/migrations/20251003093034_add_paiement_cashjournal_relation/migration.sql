/*
  Warnings:

  - A unique constraint covering the columns `[cashJournalEntryId]` on the table `paiements` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."paiements" ADD COLUMN     "cashJournalEntryId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "paiements_cashJournalEntryId_key" ON "public"."paiements"("cashJournalEntryId");

-- AddForeignKey
ALTER TABLE "public"."paiements" ADD CONSTRAINT "paiements_cashJournalEntryId_fkey" FOREIGN KEY ("cashJournalEntryId") REFERENCES "public"."CashJournal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
