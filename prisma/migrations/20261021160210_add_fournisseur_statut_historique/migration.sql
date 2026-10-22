-- AlterTable
ALTER TABLE "Fournisseur" ADD COLUMN     "actif" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "dateDebutContrat" TIMESTAMP(3),
ADD COLUMN     "dateFinContrat" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "FournisseurStatutHistorique" (
    "id" TEXT NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL,
    "motif" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "FournisseurStatutHistorique_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FournisseurStatutHistorique" ADD CONSTRAINT "FournisseurStatutHistorique_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FournisseurStatutHistorique" ADD CONSTRAINT "FournisseurStatutHistorique_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
