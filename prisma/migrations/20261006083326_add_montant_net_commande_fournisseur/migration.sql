-- AlterTable
ALTER TABLE "CommandeFournisseur" ADD COLUMN     "montantNet" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- DataMigration: correction du modèle TVA/AIB suite à un exemple réel de bon de commande papier.
-- 1) Le taux d'AIB passe de 5% à 3%.
-- 2) L'AIB ne s'ajoute plus au Total TTC (Total TTC = HT + TVA uniquement) : elle se
--    déduit du TTC pour obtenir le Montant Net réellement versé au fournisseur.
-- On recalcule donc montantAib, totalTTC et montantNet pour les bons de commande déjà
-- créés avec l'ancienne logique (totalTTC = HT + TVA + AIB à 5%).
UPDATE "CommandeFournisseur"
SET "montantAib" = CASE WHEN "appliquerAib" THEN ROUND("totalHT" * 0.03, 2) ELSE 0 END,
    "totalTTC" = "totalHT" + "tva";

UPDATE "CommandeFournisseur"
SET "montantNet" = "totalTTC" - "montantAib";
