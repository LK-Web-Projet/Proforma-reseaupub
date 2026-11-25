-- Moyens de paiement : la liste figée (type ModePaiementDemande) devient une table gérée depuis
-- Finance → Moyens de paiement, avec les caisses liées à chaque moyen. Aucune donnée n'est perdue :
-- les colonnes gardent leurs valeurs (ESPECES, VIREMENT…), qui deviennent les codes des moyens.

-- 1. Tables
CREATE TABLE "MoyenPaiement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoyenPaiement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MoyenPaiementCaisse" (
    "moyenPaiementId" TEXT NOT NULL,
    "cashRegisterId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoyenPaiementCaisse_pkey" PRIMARY KEY ("moyenPaiementId","cashRegisterId")
);

CREATE UNIQUE INDEX "MoyenPaiement_code_key" ON "MoyenPaiement"("code");
CREATE UNIQUE INDEX "MoyenPaiement_nom_key" ON "MoyenPaiement"("nom");
CREATE INDEX "MoyenPaiementCaisse_cashRegisterId_idx" ON "MoyenPaiementCaisse"("cashRegisterId");

ALTER TABLE "MoyenPaiementCaisse" ADD CONSTRAINT "MoyenPaiementCaisse_moyenPaiementId_fkey" FOREIGN KEY ("moyenPaiementId") REFERENCES "MoyenPaiement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MoyenPaiementCaisse" ADD CONSTRAINT "MoyenPaiementCaisse_cashRegisterId_fkey" FOREIGN KEY ("cashRegisterId") REFERENCES "CashRegister"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Les 6 moyens existants, sans caisse liée (les liens se font ensuite depuis la page).
INSERT INTO "MoyenPaiement" ("id", "code", "nom", "description", "ordre", "updatedAt") VALUES
  (gen_random_uuid()::text, 'ESPECES', 'Espèces', 'Petite caisse, paiements de la main à la main.', 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'MOBILE_MONEY', 'Mobile Money', 'Paiements aux personnes par téléphone.', 2, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CHEQUE', 'Chèque', NULL, 3, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'VIREMENT', 'Virement bancaire', NULL, 4, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'CARTE', 'Carte bancaire', 'Achats en ligne.', 5, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'AUTRE', 'Autre', NULL, 6, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- 3. Les colonnes passent du type figé au texte, valeurs conservées, puis pointent vers la table.
ALTER TABLE "DemandeBudget" ALTER COLUMN "modePaiement" TYPE TEXT USING "modePaiement"::text;
ALTER TABLE "DemandeBudgetLigne" ALTER COLUMN "modePaiement" TYPE TEXT USING "modePaiement"::text;
ALTER TABLE "BudgetDepense" ALTER COLUMN "modePaiement" TYPE TEXT USING "modePaiement"::text;

DROP TYPE "ModePaiementDemande";

ALTER TABLE "DemandeBudget" ADD CONSTRAINT "DemandeBudget_modePaiement_fkey" FOREIGN KEY ("modePaiement") REFERENCES "MoyenPaiement"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DemandeBudgetLigne" ADD CONSTRAINT "DemandeBudgetLigne_modePaiement_fkey" FOREIGN KEY ("modePaiement") REFERENCES "MoyenPaiement"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BudgetDepense" ADD CONSTRAINT "BudgetDepense_modePaiement_fkey" FOREIGN KEY ("modePaiement") REFERENCES "MoyenPaiement"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Opérations des proformas : la méthode était écrite autrement (« Espèces », « MobileMoney »…) ;
--    elle prend le code du moyen. Les autres valeurs (déjà des codes, ou vides) ne changent pas.
UPDATE "paiements" SET "methode" = CASE "methode"
    WHEN 'Espèces' THEN 'ESPECES'
    WHEN 'Virement' THEN 'VIREMENT'
    WHEN 'Chèque' THEN 'CHEQUE'
    WHEN 'MobileMoney' THEN 'MOBILE_MONEY'
    WHEN 'Autre' THEN 'AUTRE'
  END
WHERE "methode" IN ('Espèces', 'Virement', 'Chèque', 'MobileMoney', 'Autre');

-- 5. Droits : jusqu'ici, la page Finance donnait toutes ses actions ; les rôles qui ont cette page
--    reçoivent donc la gestion des moyens de paiement.
INSERT INTO "RolePermission" ("roleId", "permission")
SELECT rp."roleId", k.cle
FROM "RolePage" rp
CROSS JOIN (VALUES
  ('finance.moyenCreer'),
  ('finance.moyenModifier'),
  ('finance.moyenActiver')
) AS k(cle)
WHERE rp."page" = 'finance'
ON CONFLICT DO NOTHING;
