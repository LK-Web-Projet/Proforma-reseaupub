-- Délais de paiement des factures prestataires (paramétrables) et suivi de la notification de retard.
ALTER TABLE "EntrepriseConfig" ADD COLUMN "delaiPaiementFournisseur" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "EntrepriseConfig" ADD COLUMN "delaiPaiementInterne" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "EntrepriseConfig" ADD COLUMN "delaiPaiementExterne" INTEGER NOT NULL DEFAULT 3;

ALTER TABLE "FactureFournisseur" ADD COLUMN "retardNotifieAt" TIMESTAMP(3);
