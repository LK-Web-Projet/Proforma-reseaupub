-- CreateTable
CREATE TABLE "ProduitFournisseurPhoto" (
    "id" TEXT NOT NULL,
    "produitFournisseurId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProduitFournisseurPhoto_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProduitFournisseurPhoto" ADD CONSTRAINT "ProduitFournisseurPhoto_produitFournisseurId_fkey" FOREIGN KEY ("produitFournisseurId") REFERENCES "ProduitFournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
