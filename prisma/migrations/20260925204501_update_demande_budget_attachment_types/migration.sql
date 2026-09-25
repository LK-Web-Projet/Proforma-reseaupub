-- AlterEnum
-- Remplace DOCUMENT_COMMANDE par des types plus précis (DEVIS, FACTURE, BON_COMMANDE, AUTRE).
-- Les lignes existantes avec kind = 'DOCUMENT_COMMANDE' sont remappées vers 'AUTRE' via le
-- CASE ci-dessous, pour ne perdre aucune donnée (voir Prisma docs: "Customizing migrations").
BEGIN;
CREATE TYPE "TypeAttachmentDemande_new" AS ENUM ('DEVIS', 'FACTURE', 'BON_COMMANDE', 'PREUVE_PAIEMENT', 'AUTRE');
ALTER TABLE "DemandeBudgetAttachment" ALTER COLUMN "kind" TYPE "TypeAttachmentDemande_new" USING (
  (CASE "kind"::text
    WHEN 'DOCUMENT_COMMANDE' THEN 'AUTRE'
    ELSE "kind"::text
  END)::"TypeAttachmentDemande_new"
);
ALTER TYPE "TypeAttachmentDemande" RENAME TO "TypeAttachmentDemande_old";
ALTER TYPE "TypeAttachmentDemande_new" RENAME TO "TypeAttachmentDemande";
DROP TYPE "TypeAttachmentDemande_old";
COMMIT;
