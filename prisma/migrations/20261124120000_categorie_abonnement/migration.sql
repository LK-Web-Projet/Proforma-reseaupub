-- Catégorie de dépense « Abonnements » (IA, logiciels, outils en ligne, hébergement, licences…).
-- Ajout seulement : aucune ligne existante n'est modifiée.

ALTER TYPE "CategorieDepense" ADD VALUE IF NOT EXISTS 'ABONNEMENT' AFTER 'COMMUNICATION';
