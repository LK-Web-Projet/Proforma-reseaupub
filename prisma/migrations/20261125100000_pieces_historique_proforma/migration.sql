-- Pièces de la proforma : une seule table (DocumentProforma) remplace BonCommande et
-- FactureNormaliser, avec la sorte de chaque pièce, les dates et le délai de relance des factures
-- normalisées. Historique de la proforma (InvoiceHistorique). Délai de relance par défaut (30 j).
-- Ajouts seulement : les deux anciennes tables sont conservées (suppression par une mise à jour
-- suivante, après vérification). Les fichiers ne bougent pas sur le disque.

-- 1. Structure
CREATE TYPE "TypeDocumentProforma" AS ENUM ('BON_COMMANDE', 'FACTURE_NORMALISEE', 'ATTESTATION_BONNE_FIN', 'AUTRE');

ALTER TABLE "EntrepriseConfig" ADD COLUMN     "delaiRelanceFactureClient" INTEGER NOT NULL DEFAULT 30;

CREATE TABLE "DocumentProforma" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "type" "TypeDocumentProforma" NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT,
    "fileType" TEXT,
    "precision" TEXT,
    "numeroFacture" TEXT,
    "montant" DECIMAL(14,2),
    "dateEmission" TIMESTAMP(3),
    "dateEnvoiClient" TIMESTAMP(3),
    "delaiRelanceJours" INTEGER,
    "relanceNotifieeAt" TIMESTAMP(3),
    "ajouteParEmail" TEXT,
    "ajouteParNom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentProforma_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceHistorique" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "donnees" JSONB,
    "auteurEmail" TEXT,
    "auteurNom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceHistorique_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DocumentProforma_invoiceId_type_idx" ON "DocumentProforma"("invoiceId", "type");
CREATE INDEX "InvoiceHistorique_invoiceId_createdAt_idx" ON "InvoiceHistorique"("invoiceId", "createdAt");

ALTER TABLE "DocumentProforma" ADD CONSTRAINT "DocumentProforma_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceHistorique" ADD CONSTRAINT "InvoiceHistorique_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Reprise des pièces existantes. L'ancienne adresse (« /Bon/<numéro>/fichier ») était lue sous
--    /Upload ; la nouvelle est l'adresse publique complète. Factures normalisées : dates d'émission et
--    d'envoi = date d'ajout du fichier (inconnues avant), délai 30 jours, relance marquée « déjà
--    faite » pour qu'aucune notification ne parte en masse (choix 5a) ; l'alerte reste à l'écran.
INSERT INTO "DocumentProforma" ("id", "invoiceId", "type", "url", "fileName", "ajouteParNom", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, b."invoiceId", 'BON_COMMANDE',
       CASE WHEN b."url" LIKE '/Upload/%' THEN b."url" ELSE '/Upload' || b."url" END,
       regexp_replace(b."url", '^.*/', ''), 'Reprise', b."createdAt", CURRENT_TIMESTAMP
FROM "BonCommande" b;

INSERT INTO "DocumentProforma" ("id", "invoiceId", "type", "url", "fileName", "dateEmission", "dateEnvoiClient", "delaiRelanceJours", "relanceNotifieeAt", "ajouteParNom", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, f."invoiceId", 'FACTURE_NORMALISEE',
       CASE WHEN f."url" LIKE '/Upload/%' THEN f."url" ELSE '/Upload' || f."url" END,
       regexp_replace(f."url", '^.*/', ''), f."createdAt", f."createdAt", 30, CURRENT_TIMESTAMP, 'Reprise', f."createdAt", CURRENT_TIMESTAMP
FROM "FactureNormaliser" f;

-- 3. Historique reconstitué pour les proformas existantes (marqué « reprise ») : création,
--    validation, encaissements et dépenses, pièces.
INSERT INTO "InvoiceHistorique" ("id", "invoiceId", "action", "details", "donnees", "auteurEmail", "auteurNom", "createdAt")
SELECT gen_random_uuid()::text, i."id", 'CREATION', 'Proforma créée', '{"reprise": true}'::jsonb, u."email", u."nom", i."dateCreation"
FROM "Invoice" i LEFT JOIN "User" u ON u."id" = i."createdById";

INSERT INTO "InvoiceHistorique" ("id", "invoiceId", "action", "details", "donnees", "createdAt")
SELECT gen_random_uuid()::text, i."id", 'STATUT', 'Proforma validée', '{"reprise": true, "nouveau": "Valider"}'::jsonb, i."dateValidation"
FROM "Invoice" i WHERE i."dateValidation" IS NOT NULL;

INSERT INTO "InvoiceHistorique" ("id", "invoiceId", "action", "details", "donnees", "auteurEmail", "auteurNom", "createdAt")
SELECT gen_random_uuid()::text, p."invoiceId",
       CASE WHEN p."type" = 'PAIEMENT' THEN 'ENCAISSEMENT' WHEN p."montant" < 0 THEN 'DEPENSE_ANNULEE' ELSE 'DEPENSE' END,
       CASE WHEN p."type" = 'PAIEMENT' THEN 'Encaissement de ' WHEN p."montant" < 0 THEN 'Dépense annulée (contre-écriture) de ' ELSE 'Dépense de ' END
         || replace(to_char(abs(p."montant"), 'FM999,999,999,990'), ',', ' ') || ' FCFA'
         || COALESCE(' — ' || NULLIF(p."reference", ''), ''),
       jsonb_build_object('reprise', true, 'montant', p."montant", 'methode', p."methode"),
       u."email", u."nom", p."datePaiement"
FROM "paiements" p LEFT JOIN "User" u ON u."id" = p."createdById";

INSERT INTO "InvoiceHistorique" ("id", "invoiceId", "action", "details", "donnees", "createdAt")
SELECT gen_random_uuid()::text, d."invoiceId", 'PIECE_AJOUTEE',
       CASE d."type" WHEN 'BON_COMMANDE' THEN 'Bon de commande du client ajouté' ELSE 'Facture normalisée ajoutée' END || ' : ' || COALESCE(d."fileName", ''),
       jsonb_build_object('reprise', true, 'type', d."type"::text), d."createdAt"
FROM "DocumentProforma" d;
