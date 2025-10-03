-- CreateTable
CREATE TABLE "public"."CashJournalAttachment" (
    "id" TEXT NOT NULL,
    "cashJournalId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashJournalAttachment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."CashJournalAttachment" ADD CONSTRAINT "CashJournalAttachment_cashJournalId_fkey" FOREIGN KEY ("cashJournalId") REFERENCES "public"."CashJournal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
