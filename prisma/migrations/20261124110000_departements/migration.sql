-- Départements : table des départements (noms en majuscules), département de chaque ligne de
-- budget, département et poste des prestataires avec leur historique. Ajouts seulement.

-- AlterTable
ALTER TABLE "Fournisseur" ADD COLUMN     "departementId" TEXT,
ADD COLUMN     "posteDepartement" TEXT;

-- AlterTable
ALTER TABLE "DemandeBudgetLigne" ADD COLUMN     "departementId" TEXT;

-- CreateTable
CREATE TABLE "Departement" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "emailContact" TEXT,
    "telephone" TEXT,
    "codeAnalytique" TEXT,
    "couleur" TEXT,
    "enveloppeMensuelle" DECIMAL(12,2),
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Departement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FournisseurDepartementHistorique" (
    "id" TEXT NOT NULL,
    "fournisseurId" TEXT NOT NULL,
    "ancienDepartementId" TEXT,
    "nouveauDepartementId" TEXT,
    "ancienPoste" TEXT,
    "nouveauPoste" TEXT,
    "dateEffet" TIMESTAMP(3) NOT NULL,
    "motif" TEXT,
    "auteurEmail" TEXT,
    "auteurNom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FournisseurDepartementHistorique_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Departement_nom_key" ON "Departement"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "Departement_code_key" ON "Departement"("code");

-- CreateIndex
CREATE INDEX "FournisseurDepartementHistorique_fournisseurId_dateEffet_idx" ON "FournisseurDepartementHistorique"("fournisseurId", "dateEffet");

-- CreateIndex
CREATE INDEX "Fournisseur_departementId_idx" ON "Fournisseur"("departementId");

-- CreateIndex
CREATE INDEX "DemandeBudgetLigne_departementId_idx" ON "DemandeBudgetLigne"("departementId");

-- AddForeignKey
ALTER TABLE "Fournisseur" ADD CONSTRAINT "Fournisseur_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES "Departement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FournisseurDepartementHistorique" ADD CONSTRAINT "FournisseurDepartementHistorique_fournisseurId_fkey" FOREIGN KEY ("fournisseurId") REFERENCES "Fournisseur"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FournisseurDepartementHistorique" ADD CONSTRAINT "FournisseurDepartementHistorique_ancienDepartementId_fkey" FOREIGN KEY ("ancienDepartementId") REFERENCES "Departement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FournisseurDepartementHistorique" ADD CONSTRAINT "FournisseurDepartementHistorique_nouveauDepartementId_fkey" FOREIGN KEY ("nouveauDepartementId") REFERENCES "Departement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandeBudgetLigne" ADD CONSTRAINT "DemandeBudgetLigne_departementId_fkey" FOREIGN KEY ("departementId") REFERENCES "Departement"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Reprise des données ──────────────────────────────────────────────────────────────────────

-- 1. Les départements de l'ancienne liste du formulaire de budget (« Autre » exclu), en majuscules.
INSERT INTO "Departement" ("id", "nom", "code", "description", "updatedAt") VALUES
  (gen_random_uuid()::text, 'INFORMATIQUE', 'INFO', 'Matériel, logiciels, réseau et support informatique.', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'RH', 'RH', 'Ressources humaines : recrutement, paie, formation et administration du personnel.', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'DIRECTION GÉNÉRALE', 'DG', 'Direction de l''entreprise : orientations, arbitrages et validations.', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'FINANCE', 'FIN', 'Comptabilité, trésorerie, caisse et suivi budgétaire.', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'DÉPLOIEMENT TERRAIN', 'TERRAIN', 'Équipes terrain : pose, installation et suivi des campagnes.', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'RÉGIE PUBLICITAIRE', 'REGIE', 'Commercialisation des espaces et relation avec les annonceurs.', CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'OPÉRATIONNEL LOGISTIQUE', 'LOG', 'Transport, stock, matériel et logistique des opérations.', CURRENT_TIMESTAMP)
ON CONFLICT ("nom") DO NOTHING;

-- 2. Les autres départements saisis à la main dans les budgets existants (« Autre » → texte libre) :
--    créés aussi, pour ne rien perdre. Espaces superflus retirés, majuscules.
INSERT INTO "Departement" ("id", "nom", "description", "updatedAt")
SELECT gen_random_uuid()::text, v.nom, 'Créé automatiquement à partir des anciens budgets : à compléter.', CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT upper(regexp_replace(btrim("departement"), '\s+', ' ', 'g')) AS nom
  FROM "DemandeBudget"
  WHERE "departement" IS NOT NULL AND btrim("departement") <> ''
) v
WHERE v.nom <> 'AUTRE'
ON CONFLICT ("nom") DO NOTHING;

-- 3. Chaque ligne des budgets existants prend le département de son budget.
UPDATE "DemandeBudgetLigne" l
SET "departementId" = dep."id"
FROM "DemandeBudget" d, "Departement" dep
WHERE l."demandeBudgetId" = d."id"
  AND l."departementId" IS NULL
  AND dep."nom" = upper(regexp_replace(btrim(d."departement"), '\s+', ' ', 'g'));

-- 4. Droits : jusqu'ici, voir la page Prestataires donnait toutes ses actions ; les rôles qui ont
--    cette page reçoivent donc les nouvelles actions sur les départements.
INSERT INTO "RolePermission" ("roleId", "permission")
SELECT rp."roleId", k.cle
FROM "RolePage" rp
CROSS JOIN (VALUES
  ('fournisseurs.departementCreer'),
  ('fournisseurs.departementModifier'),
  ('fournisseurs.departementActiver'),
  ('fournisseurs.affecterDepartement')
) AS k(cle)
WHERE rp."page" = 'fournisseurs'
ON CONFLICT DO NOTHING;
