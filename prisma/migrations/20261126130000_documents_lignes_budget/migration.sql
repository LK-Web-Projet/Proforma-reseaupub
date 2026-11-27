-- Budget collectif : un document peut justifier une ligne précise (devis, prix…), joint par son
-- département pendant la préparation ; on garde qui l'a envoyé. Ajout seulement : les documents
-- existants restent rattachés au budget entier (ligneId null).

-- AlterTable
ALTER TABLE "DemandeBudgetAttachment" ADD COLUMN     "ajouteParEmail" TEXT,
ADD COLUMN     "ajouteParNom" TEXT,
ADD COLUMN     "ligneId" TEXT;

-- CreateIndex
CREATE INDEX "DemandeBudgetAttachment_ligneId_idx" ON "DemandeBudgetAttachment"("ligneId");

-- AddForeignKey
ALTER TABLE "DemandeBudgetAttachment" ADD CONSTRAINT "DemandeBudgetAttachment_ligneId_fkey" FOREIGN KEY ("ligneId") REFERENCES "DemandeBudgetLigne"("id") ON DELETE SET NULL ON UPDATE CASCADE;
