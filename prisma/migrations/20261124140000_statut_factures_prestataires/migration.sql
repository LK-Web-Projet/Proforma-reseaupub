-- Factures de prestataires : paiement hors plateforme (moyen, date, preuve) et historique des
-- changements de statut faits à la main ; deux nouveaux droits. Ajouts seulement.

-- 1. Paiement hors plateforme sur la facture
ALTER TABLE "FactureFournisseur" ADD COLUMN     "paiementManuelDate" TIMESTAMP(3),
ADD COLUMN     "paiementManuelMode" TEXT,
ADD COLUMN     "paiementManuelParEmail" TEXT,
ADD COLUMN     "paiementManuelPreuve" TEXT,
ADD COLUMN     "paiementManuelReference" TEXT;

ALTER TABLE "FactureFournisseur" ADD CONSTRAINT "FactureFournisseur_paiementManuelMode_fkey" FOREIGN KEY ("paiementManuelMode") REFERENCES "MoyenPaiement"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Historique des changements de statut faits à la main
CREATE TABLE "FactureFournisseurStatutHistorique" (
    "id" TEXT NOT NULL,
    "factureFournisseurId" TEXT NOT NULL,
    "ancienStatut" "StatutFactureFournisseur" NOT NULL,
    "nouveauStatut" "StatutFactureFournisseur" NOT NULL,
    "modePaiement" TEXT,
    "datePaiement" TIMESTAMP(3),
    "preuve" TEXT,
    "reference" TEXT,
    "motif" TEXT,
    "auteurEmail" TEXT NOT NULL,
    "auteurNom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactureFournisseurStatutHistorique_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FactureFournisseurStatutHistorique_factureFournisseurId_idx" ON "FactureFournisseurStatutHistorique"("factureFournisseurId");

ALTER TABLE "FactureFournisseurStatutHistorique" ADD CONSTRAINT "FactureFournisseurStatutHistorique_modePaiement_fkey" FOREIGN KEY ("modePaiement") REFERENCES "MoyenPaiement"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FactureFournisseurStatutHistorique" ADD CONSTRAINT "FactureFournisseurStatutHistorique_factureFournisseurId_fkey" FOREIGN KEY ("factureFournisseurId") REFERENCES "FactureFournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Droits (la page Prestataires est exigée, règle descendante de la grille) :
--    « Marquer une facture payée sans paiement » → les rôles qui avaient déjà ce pouvoir (case
--    « Valider au niveau direction ») ; « Changer librement le statut » → l'administrateur (rôle
--    qui gère les utilisateurs).
INSERT INTO "RolePermission" ("roleId", "permission")
SELECT r."id", 'fournisseurs.facturePayeeHorsPlateforme'
FROM "Role" r
WHERE r."canValidateBudgetMensuel" = true
  AND EXISTS (SELECT 1 FROM "RolePage" rp WHERE rp."roleId" = r."id" AND rp."page" = 'fournisseurs')
ON CONFLICT DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permission")
SELECT r."id", 'fournisseurs.factureStatutLibre'
FROM "Role" r
WHERE r."canManageUsers" = true
  AND EXISTS (SELECT 1 FROM "RolePage" rp WHERE rp."roleId" = r."id" AND rp."page" = 'fournisseurs')
ON CONFLICT DO NOTHING;
