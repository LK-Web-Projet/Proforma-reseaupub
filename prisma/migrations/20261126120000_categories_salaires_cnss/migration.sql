-- Catégories de dépense « Salaires » et « Cotisations CNSS » (employés déclarés).
-- Ajout seulement : aucune ligne existante n'est modifiée.

ALTER TYPE "CategorieDepense" ADD VALUE IF NOT EXISTS 'SALAIRES' AFTER 'PRESTATION';
ALTER TYPE "CategorieDepense" ADD VALUE IF NOT EXISTS 'COTISATION_CNSS' AFTER 'SALAIRES';
