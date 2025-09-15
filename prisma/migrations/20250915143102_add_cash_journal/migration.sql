-- CreateEnum
CREATE TYPE "public"."OperationType" AS ENUM ('RECETTE', 'DEPENSE');

-- CreateTable
CREATE TABLE "public"."CashJournal" (
    "id" SERIAL NOT NULL,
    "date_operation" TIMESTAMP(3) NOT NULL,
    "date_enregistrement" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "libelle" TEXT NOT NULL,
    "type" "public"."OperationType" NOT NULL,
    "montant" DOUBLE PRECISION NOT NULL,
    "solde" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "CashJournal_pkey" PRIMARY KEY ("id")
);
