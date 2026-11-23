-- Droits par action (Paramètres → Rôles → grille) : table RolePermission, clés « module.action »
-- du catalogue lib/permissions.ts. Commerciaux désactivables.

CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId", "permission")
);

ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Gestionnaire" ADD COLUMN "actif" BOOLEAN NOT NULL DEFAULT true;

-- Reprise : jusqu'ici, voir une page donnait toutes ses actions. Chaque rôle reçoit donc toutes
-- les actions des pages qu'il a déjà — aucun rôle ne perd ni ne gagne de droit.
INSERT INTO "RolePermission" ("roleId", "permission")
SELECT rp."roleId", m.permission
FROM "RolePage" rp
JOIN (VALUES
  ('dashboard', 'dashboard.exporter'),
  ('proforma', 'proforma.voirTout'),
  ('proforma', 'proforma.creer'),
  ('proforma', 'proforma.modifier'),
  ('proforma', 'proforma.changerStatut'),
  ('proforma', 'proforma.valider'),
  ('proforma', 'proforma.annuler'),
  ('proforma', 'proforma.supprimer'),
  ('proforma', 'proforma.envoyer'),
  ('proforma', 'proforma.pieces'),
  ('proforma', 'proforma.exporter'),
  ('client', 'client.creer'),
  ('client', 'client.modifier'),
  ('client', 'client.supprimer'),
  ('commercial', 'commercial.creer'),
  ('commercial', 'commercial.modifier'),
  ('commercial', 'commercial.desactiver'),
  ('fournisseurs', 'fournisseurs.creer'),
  ('fournisseurs', 'fournisseurs.modifier'),
  ('fournisseurs', 'fournisseurs.activer'),
  ('fournisseurs', 'fournisseurs.documents'),
  ('fournisseurs', 'fournisseurs.produits'),
  ('fournisseurs', 'fournisseurs.factureEnregistrer'),
  ('fournisseurs', 'fournisseurs.factureModifier'),
  ('fournisseurs', 'fournisseurs.factureAnnuler'),
  ('fournisseurs', 'fournisseurs.commandeCreer'),
  ('fournisseurs', 'fournisseurs.commandeModifier'),
  ('fournisseurs', 'fournisseurs.commandeLivrer'),
  ('fournisseurs', 'fournisseurs.commandeAnnuler'),
  ('fournisseurs', 'fournisseurs.commandePieces'),
  ('fournisseurs', 'fournisseurs.commandeExporter'),
  ('produits', 'produits.creer'),
  ('produits', 'produits.modifier'),
  ('produits', 'produits.supprimer'),
  ('finance', 'finance.justificatifs'),
  ('finance', 'finance.exporter'),
  ('parametres', 'parametres.entreprise')
) AS m(page, permission) ON m.page = rp."page"
ON CONFLICT DO NOTHING;

-- Encaisser sur une proforma était ouvert à tout utilisateur ayant la page Proforma.
INSERT INTO "RolePermission" ("roleId", "permission")
SELECT rp."roleId", 'proforma.encaisser'
FROM "RolePage" rp
WHERE rp."page" = 'proforma'
ON CONFLICT DO NOTHING;

-- Délais/plafonds et notifications étaient réservés au droit « Gérer les rôles et utilisateurs ».
INSERT INTO "RolePermission" ("roleId", "permission")
SELECT r."id", p.permission
FROM "Role" r CROSS JOIN (VALUES ('parametres.reglages'), ('parametres.notifications')) AS p(permission)
WHERE r."canManageUsers" = true
ON CONFLICT DO NOTHING;

-- Le PDF d'un budget était téléchargeable par tous.
INSERT INTO "RolePermission" ("roleId", "permission")
SELECT r."id", 'budget.exporter' FROM "Role" r
ON CONFLICT DO NOTHING;

-- Gérer les caisses et recalculer les soldes exigeaient le droit « Saisir au journal de caisse ».
INSERT INTO "RolePermission" ("roleId", "permission")
SELECT rp."roleId", p.permission
FROM "RolePage" rp JOIN "Role" r ON r."id" = rp."roleId"
CROSS JOIN (VALUES ('finance.caisses'), ('finance.recalculer')) AS p(permission)
WHERE rp."page" = 'finance' AND r."canSaisirCaisse" = true
ON CONFLICT DO NOTHING;
