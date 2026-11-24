-- Lignes de budget : détail facultatif (texte libre) et délai propre à chaque ligne.
-- Ajouts seulement : les lignes existantes restent sans détail ni délai.

ALTER TABLE "DemandeBudgetLigne" ADD COLUMN "detail" TEXT;
ALTER TABLE "DemandeBudgetLigne" ADD COLUMN "dateLimite" TIMESTAMP(3);
