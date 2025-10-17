-- CreateEnum
CREATE TYPE "public"."StatutFactureFournisseur" AS ENUM ('EN_ATTENTE', 'PAYEE', 'ANNULEE');

-- CreateTable
CREATE TABLE "public"."Fournisseur" (
    "id" TEXT NOT NULL,
    "nom" TEXT,
    "prenom" TEXT,
    "entreprise" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "domaineActivite" TEXT NOT NULL,
    "adresse" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FactureFournisseur" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "montant" DECIMAL(10,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "pieceJointe" TEXT,
    "status" "public"."StatutFactureFournisseur" NOT NULL DEFAULT 'EN_ATTENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fournisseurId" TEXT NOT NULL,

    CONSTRAINT "FactureFournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Fournisseur_entreprise_key" ON "public"."Fournisseur"("entreprise");

-- CreateIndex
CREATE UNIQUE INDEX "Fournisseur_email_key" ON "public"."Fournisseur"("email");

-- CreateIndex
CREATE UNIQUE INDEX "FactureFournisseur_reference_key" ON "public"."FactureFournisseur"("reference");

-- AddForeignKey
ALTER TABLE "public"."FactureFournisseur" ADD CONSTRAINT "FactureFournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "public"."Fournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
