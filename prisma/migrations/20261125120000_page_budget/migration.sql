-- Page « Budget » (2026-11-25) : la section Budget n'est plus ouverte à tout utilisateur connecté,
-- elle se coche par rôle comme les autres pages (Paramètres → Rôles).
-- Reprise : tous les rôles existants reçoivent la page, pour que personne ne perde l'accès au moment
-- de la mise à jour ; l'administrateur la retire ensuite aux rôles qui ne doivent plus la voir.
-- Un rôle créé après cette mise à jour ne l'a pas tant qu'elle n'est pas cochée.
INSERT INTO "RolePage" ("roleId", "page")
SELECT "id", 'budget' FROM "Role"
ON CONFLICT DO NOTHING;
