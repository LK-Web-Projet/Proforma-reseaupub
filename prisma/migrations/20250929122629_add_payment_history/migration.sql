-- AlterTable
ALTER TABLE "public"."Invoice" ADD COLUMN     "resteAPayer" DECIMAL(65,30) NOT NULL DEFAULT 0.00;

-- CreateTable
CREATE TABLE "public"."paiements" (
    "id" TEXT NOT NULL,
    "montant" DECIMAL(65,30) NOT NULL,
    "datePaiement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "methode" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "invoiceId" TEXT NOT NULL,

    CONSTRAINT "paiements_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."paiements" ADD CONSTRAINT "paiements_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
