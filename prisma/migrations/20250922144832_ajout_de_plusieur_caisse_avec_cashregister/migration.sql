-- AlterEnum
ALTER TYPE "public"."OperationType" ADD VALUE 'TRANSFERT';

-- AlterTable
ALTER TABLE "public"."CashJournal" ADD COLUMN     "cashRegisterId" INTEGER;

-- CreateTable
CREATE TABLE "public"."CashRegister" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashRegister_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CashRegister_name_key" ON "public"."CashRegister"("name");

-- AddForeignKey
ALTER TABLE "public"."CashJournal" ADD CONSTRAINT "CashJournal_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "public"."CashRegister"("id") ON DELETE SET NULL ON UPDATE CASCADE;
