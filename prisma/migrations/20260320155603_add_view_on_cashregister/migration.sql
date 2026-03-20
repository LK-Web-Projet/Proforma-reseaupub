-- CreateEnum
CREATE TYPE "public"."TypeUnite" AS ENUM ('METRE_CARRE', 'UNITE', 'ROULEAU', 'METRE_LINEAIRE', 'FORFAIT');

-- CreateEnum
CREATE TYPE "public"."StatutCommandeFournisseur" AS ENUM ('BROUILLON', 'VALIDEE', 'LIVREE', 'ANNULEE');

-- AlterTable
ALTER TABLE "public"."CashRegister" ADD COLUMN     "view" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "public"."EntrepriseConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "nom" TEXT NOT NULL DEFAULT 'Reseaupub',
    "slogan" TEXT,
    "adresse" TEXT NOT NULL DEFAULT 'Etoile Rouge, Cotonou, Bénin',
    "telephone" TEXT NOT NULL DEFAULT '+229 01 69 81 30 30',
    "email" TEXT NOT NULL DEFAULT 'contact@reseaupub.com',
    "emailFinance" TEXT NOT NULL DEFAULT 'finance@reseaupub.com',
    "siteWeb" TEXT,
    "ifu" TEXT NOT NULL DEFAULT '0201710009974',
    "rccm" TEXT,
    "nomDirecteur" TEXT NOT NULL DEFAULT 'Directeur Général',
    "logoPath" TEXT NOT NULL DEFAULT 'rplogo.png',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntrepriseConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProduitFournisseur" (
    "id" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "description" TEXT,
    "prixUnitaire" DECIMAL(10,2) NOT NULL,
    "typeUnite" "public"."TypeUnite" NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProduitFournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CommandeFournisseur" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "dateCommande" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statut" "public"."StatutCommandeFournisseur" NOT NULL DEFAULT 'BROUILLON',
    "fournisseurId" TEXT NOT NULL,
    "totalHT" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommandeFournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LigneCommandeFournisseur" (
    "id" TEXT NOT NULL,
    "commandeId" TEXT NOT NULL,
    "produitFournisseurId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "quantite" INTEGER NOT NULL,
    "largeur" DECIMAL(10,2),
    "hauteur" DECIMAL(10,2),
    "surface" DECIMAL(10,2),
    "prixUnitaire" DECIMAL(10,2) NOT NULL,
    "prixTotal" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "LigneCommandeFournisseur_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommandeFournisseur_numero_key" ON "public"."CommandeFournisseur"("numero");

-- AddForeignKey
ALTER TABLE "public"."ProduitFournisseur" ADD CONSTRAINT "ProduitFournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "public"."Fournisseur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommandeFournisseur" ADD CONSTRAINT "CommandeFournisseur_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "public"."Fournisseur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LigneCommandeFournisseur" ADD CONSTRAINT "LigneCommandeFournisseur_commandeId_fkey" FOREIGN KEY ("commandeId") REFERENCES "public"."CommandeFournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LigneCommandeFournisseur" ADD CONSTRAINT "LigneCommandeFournisseur_produitFournisseurId_fkey" FOREIGN KEY ("produitFournisseurId") REFERENCES "public"."ProduitFournisseur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
