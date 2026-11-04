-- Aligne la colonne "quantite" (LigneCommandeFournisseur) sur le type Decimal(10,2)
-- du schéma Prisma, pour autoriser des quantités décimales (ex: 2.5), comme largeur/hauteur.
ALTER TABLE "LigneCommandeFournisseur" ALTER COLUMN "quantite" TYPE DECIMAL(10,2);
