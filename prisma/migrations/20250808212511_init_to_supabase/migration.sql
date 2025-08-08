-- CreateEnum
CREATE TYPE "public"."UniteDuree" AS ENUM ('jour', 'heure', 'mois');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Client" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "email" TEXT,
    "telephone" TEXT,
    "adresse" TEXT,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Produit" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prixUnitaire" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "Produit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Invoice" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "objet" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "totalHT" DECIMAL(65,30) NOT NULL,
    "tva" DECIMAL(65,30) NOT NULL,
    "totalTTC" DECIMAL(65,30) NOT NULL,
    "statut" TEXT NOT NULL,
    "pdfUrl" TEXT,
    "historiqueModifications" JSONB,
    "societeNom" TEXT NOT NULL,
    "societeIFU" TEXT NOT NULL,
    "societeAdresse" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InvoiceProduit" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixUnitaire" DECIMAL(65,30) NOT NULL,
    "duree" DECIMAL(65,30) NOT NULL,
    "uniteDuree" "public"."UniteDuree" NOT NULL,
    "montantTotal" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "InvoiceProduit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Gestionnaire" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telephone" TEXT,

    CONSTRAINT "Gestionnaire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."InvoiceGestionnaire" (
    "invoiceId" TEXT NOT NULL,
    "gestionnaireId" TEXT NOT NULL,

    CONSTRAINT "InvoiceGestionnaire_pkey" PRIMARY KEY ("invoiceId","gestionnaireId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Client_nom_key" ON "public"."Client"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "Produit_nom_key" ON "public"."Produit"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_numero_key" ON "public"."Invoice"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "Gestionnaire_email_key" ON "public"."Gestionnaire"("email");

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InvoiceProduit" ADD CONSTRAINT "InvoiceProduit_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InvoiceProduit" ADD CONSTRAINT "InvoiceProduit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Produit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InvoiceGestionnaire" ADD CONSTRAINT "InvoiceGestionnaire_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."InvoiceGestionnaire" ADD CONSTRAINT "InvoiceGestionnaire_gestionnaireId_fkey" FOREIGN KEY ("gestionnaireId") REFERENCES "public"."Gestionnaire"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
