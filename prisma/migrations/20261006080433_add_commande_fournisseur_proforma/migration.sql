-- CreateTable
CREATE TABLE "CommandeFournisseurProforma" (
    "commandeId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,

    CONSTRAINT "CommandeFournisseurProforma_pkey" PRIMARY KEY ("commandeId","invoiceId")
);

-- AddForeignKey
ALTER TABLE "CommandeFournisseurProforma" ADD CONSTRAINT "CommandeFournisseurProforma_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "CommandeFournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandeFournisseurProforma" ADD CONSTRAINT "CommandeFournisseurProforma_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
