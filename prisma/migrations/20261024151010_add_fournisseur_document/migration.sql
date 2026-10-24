-- CreateTable
CREATE TABLE "FournisseurDocument" (
    "id" TEXT NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "FournisseurDocument_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FournisseurDocument" ADD CONSTRAINT "FournisseurDocument_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FournisseurDocument" ADD CONSTRAINT "FournisseurDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
