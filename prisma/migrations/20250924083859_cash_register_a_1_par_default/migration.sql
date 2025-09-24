-- AlterTable
ALTER TABLE "public"."CashJournal" ALTER COLUMN "cashRegisterId" SET DEFAULT 1,
ALTER COLUMN "isApportDeCaisse" DROP NOT NULL;
