-- AlterEnum
ALTER TYPE "public"."StatusFacture" ADD VALUE 'Activer';

-- CreateTable
CREATE TABLE "public"."BonCommande" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BonCommande_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FactureNormaliser" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactureNormaliser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BonCommande_invoiceId_key" ON "public"."BonCommande"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "FactureNormaliser_invoiceId_key" ON "public"."FactureNormaliser"("invoiceId");

-- AddForeignKey
ALTER TABLE "public"."BonCommande" ADD CONSTRAINT "BonCommande_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FactureNormaliser" ADD CONSTRAINT "FactureNormaliser_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
