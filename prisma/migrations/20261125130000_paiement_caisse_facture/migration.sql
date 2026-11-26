-- Paiement d'une facture de prestataire sans budget (2026-11-25) : « Appliquer le paiement » d'une
-- facture rattachée à aucune ligne de budget (caisse seule, ou campagne sans budget) sort l'argent de la
-- caisse choisie sans dépense de budget. La facture garde l'écriture de caisse qui l'a payée.
-- Ajouts seulement : aucune donnée existante n'est modifiée.

-- AlterTable
ALTER TABLE "FactureFournisseur" ADD COLUMN     "paiementCaisseId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "FactureFournisseur_paiementCaisseId_key" ON "FactureFournisseur"("paiementCaisseId");

-- AddForeignKey
ALTER TABLE "FactureFournisseur" ADD CONSTRAINT "FactureFournisseur_paiementCaisseId_fkey" FOREIGN KEY ("paiementCaisseId") REFERENCES "CashJournal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
