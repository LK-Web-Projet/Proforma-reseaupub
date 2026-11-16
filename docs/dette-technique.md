# Dette technique et points à corriger

*Liste tenue à jour des fragilités connues de Proforma, à consulter avant chaque nouveau chantier. Établie le 17/11/2026, après la refonte budget, la procédure de paiement et la chaîne de dépense unique (branche `feature/budgets`).*

Pour chaque point : **pourquoi c'est un risque**, **où** il se trouve, et **la correction proposée**. Cochez la case et notez la date dans `HISTORIQUE.md` une fois le point traité.

---

## Ce qui est solide (à préserver)

Toute correction doit respecter ces principes :

- **Une seule fonction écrit toutes les dépenses** : `lib/depenses/enregistrerDepense.ts`. Une nouvelle source de paiement s'y branche, elle ne réécrit pas les règles.
- **Les montants calculés ne sont jamais stockés** : consommé d'une ligne, payé d'un bon de commande et de ses lignes de produit (`ImputationCommande`), reste. Ils sont toujours recalculés.
- **Transactions et verrous `SELECT … FOR UPDATE`** sur la caisse, la ligne de budget, le bon et la facture : aucune écriture sensible n'y échappe.
- **Droits uniquement par les cases cochées sur les rôles** (`lib/budgetAuth.ts`). Le serveur reste juge, l'interface ne fait que masquer.
- **Règles partagées interface / serveur centralisées** : `lib/commandeFournisseurLiasse.ts` (liasse, transitions de statut, prorata), `lib/justificatifs.ts`, `lib/budgetTypes.ts`, `lib/typeFournisseur.ts`.

---

## Priorité haute

### ☐ 1. Aucun test automatisé dans le projet

- **Risque** : les scénarios de test écrits pendant le développement (budget, lot A, lot C, chaîne de dépense, factures prestataires, environ 250 vérifications) étaient des scripts temporaires, hors du dépôt. Sans eux, une nouvelle fonctionnalité peut casser une règle (plafond, séparation des tâches, solde de caisse, statut payé) sans que personne ne le voie.
- **Où** : seuls les tests Playwright existent (`e2e/`, en pause, scénario 4 à corriger).
- **Correction** :
  - créer un dossier `tests/` avec une commande `pnpm test` (Vitest, ou tsx + assertions) ;
  - réécrire les scénarios en base dans une transaction annulée : budget, dépenses, bons de commande, imputations, factures, lots Camptrack, état du soir, verrou du planificateur ;
  - lancer `tsc`, `lint` et `pnpm test` à chaque commit (hook ou intégration continue) ;
  - reprendre Playwright : corriger le sélecteur « Associer des proformas » du scénario 4, puis ajouter un scénario « dépense depuis la proforma avec budget et bon de commande ».

### ☐ 2. Le développement se fait sur la base de production

- **Risque** : tests, migrations et essais touchent les vraies données (Supabase). Les précautions prises (transactions annulées, données « E2E- » nettoyées, `EMAIL_DISABLED`) réduisent le risque sans le supprimer.
- **Où** : `.env` (`DATABASE_URL` / `DIRECT_URL`).
- **Correction** :
  - créer une base de test : projet Supabase séparé, ou branche Supabase ;
  - un `.env.local` de développement pointe dessus ;
  - les migrations sont d'abord appliquées en test, puis en production au déploiement (`migrate deploy` au démarrage du conteneur).

### ☐ 3. Contrôle des droits absent sur une partie des routes

- **Risque** : ces routes vérifient seulement que l'utilisateur est connecté (middleware). N'importe quel employé connecté peut donc modifier une proforma, un client, les paramètres de l'entreprise ou une facture fournisseur. Le module budget est verrouillé, le reste non.
- **Où** (relevé du 17/11/2026, non exhaustif) :
  - `app/api/factures/[id]/route.ts`, `factures/[id]/upload`, `factures/[id]/send-email`, `factures/[id]/pdf`, `factures/[id]/campagnes`, `factures/[id]/paiements/upload-proof` ;
  - `app/api/clients/route.ts`, `clients/[id]` ;
  - `app/api/entreprise/route.ts`, `entreprise/logo` ;
  - `app/api/dashboard/route.ts` ;
  - `app/api/factures-fournisseurs/[id]/route.ts` ;
  - `app/api/fournisseurs/produits/**` ;
  - `app/api/cash-journal/[id]/upload/route.ts`.
- **Correction** : ajouter `requirePage(...)` (`lib/authz.ts`) selon la section (proforma, client, fournisseurs, parametres, finance). Pour les écritures sensibles, ajouter des droits dédiés sur le rôle, sur le modèle de `canSaisirCaisse`. Refaire le relevé avec la commande ci-dessous :
  ```
  for f in $(find app/api -name route.ts | grep -v integration); do grep -qE "requireBudgetUser|requireCaisseUser|requirePage|requireCanManageUsers|getBudgetCapabilities" "$f" || echo "$f"; done
  ```

### ☐ 4. Fusionner la branche `feature/budgets`

- **Risque** : la branche est très en avance sur `main` (refonte budget, lots A et C, chaîne de dépense, notifications, Playwright). Plus elle attend, plus la fusion est risquée.
- **Correction** : test manuel des parcours principaux, puis fusion dans `main` et déploiement (voir la liste du VPS dans `HISTORIQUE.md` : `SCHEDULER_ENABLED=true`, volume `public/Upload`, suppression de l'éventuelle ligne de crontab `justificatifs-manquants`).

---

## Priorité moyenne

### ☐ 5. Montants de caisse en virgule flottante

- **Risque** : `CashRegister.balance`, `CashJournal.montant` et `CashJournal.solde` sont des `Float`, alors que budgets, dépenses, bons et imputations sont en `Decimal`. Les arrondis sont gérés aujourd'hui, mais des calculs plus complexes peuvent créer des écarts de centimes entre la caisse et les budgets.
- **Où** : `prisma/schema.prisma` (modèles `CashRegister` et `CashJournal`), `lib/cashJournal.ts`, `lib/paiements.ts`, `app/api/cash-journal/**`, les rapports de trésorerie.
- **Correction** : migrer vers `Decimal @db.Decimal(14, 2)` (migration avec conversion), puis adapter les calculs avec `Number()` / `Prisma.Decimal` et vérifier les rapports et exports.

### ☐ 6. Deux gestionnaires de paquets

- **Risque** : on développe avec **pnpm** (`pnpm-lock.yaml`) mais l'image Docker installe avec **npm** (`npm ci` + `package-lock.json`). Un ajout de dépendance fait seulement avec pnpm **casse le build Docker** : c'est arrivé le 16/11 et a été corrigé.
- **Où** : `infra/Dockerfile`, `package-lock.json`, `pnpm-lock.yaml`.
- **Correction** : choisir un seul gestionnaire, de préférence pnpm partout, avec `corepack enable` et `pnpm install --frozen-lockfile` dans le Dockerfile, et supprimer l'autre fichier de verrouillage. **D'ici là**, après chaque `pnpm add`, lancer `npm install --package-lock-only`, puis vérifier qu'aucune version existante n'a changé.

### ☐ 7. Écrans trop volumineux

- **Risque** : chaque ajout devient plus difficile et plus risqué, avec des effets de bord dans ces gros fichiers.
- **Où** : `app/(main)/budget/demandes/[id]/page.tsx` (~1 260 lignes), `app/(main)/facture/[id]/page.tsx` (~1 210 lignes), `app/(main)/fournisseur/[id]/commandes/[commandeId]/page.tsx` (~860 lignes).
- **Correction** : les découper en composants dans `components/budget/`, `components/facture/` et `components/fournisseurs/` (en-tête, tableau des lignes, dépenses, documents, validation…) et sortir le chargement des données dans des hooks (`useDemandeBudget`, `useFacture`).

### ☐ 8. Calculs de suivi dupliqués côté écran

- **Risque** : la fiche budget recalcule elle-même plafond, consommé et reste (`suiviLignes`) avec la même logique que `lib/budgetSuivi.ts`. Si la règle change d'un côté seulement, l'écran affichera autre chose que ce que le serveur applique.
- **Correction** : renvoyer ces chiffres calculés par l'API (`GET /api/demandes-budget/[id]`, à partir de `getLigneDisponible`), ou extraire la règle dans une fonction pure partagée, sur le modèle de `lib/commandeFournisseurLiasse.ts`.

---

## Priorité basse / à surveiller

### ☐ 9. Dépense directe sur une proforma sans budget : pas d'annulation

- **Risque** : une dépense de budget s'annule par contre-écriture (DG). En revanche, une dépense saisie directement sur une proforma **sans budget** (campagne sans budget), ou reçue de Camptrack sans ligne, n'a aucune annulation propre.
- **Correction** : une route d'annulation pour les `Paiement` DEPENSE, qui passe une contre-écriture de caisse et un paiement négatif, annule les imputations du bon de commande (`annulerImputations`) et est réservée à la DG avec motif. Il faudrait la mettre en commun avec l'annulation existante (`app/api/demandes-budget/[id]/depenses/[depenseId]/annuler`).

### ☐ 10. Deux façons de calculer « facture payée »

- **Risque** : une facture liée à un **bon de commande** passe PAYEE par l'imputation du solde (`ImputationCommande.factureFournisseurId`, `libererFactureApresAnnulation`). Une facture de **prestataire interne ou externe** réglée sur une ligne passe PAYEE par la somme des dépenses de budget (`recalculerStatutFacture`). C'est cohérent aujourd'hui, mais c'est à unifier avant toute extension (paiement partiel des factures de bons de commande, factures payées hors budget…).
- **Correction** : une seule table des règlements de facture (ou les imputations étendues), et une seule fonction `recalculerStatutFacture` pour tous les cas.

### ☐ 11. Champs redondants sur `BudgetDepense`

- **Risque** : `BudgetDepense.commandeId`, `nature` et `factureFournisseurId` servent à l'affichage, alors que la source de vérité du payé d'un bon est `ImputationCommande`. Si une future écriture oublie l'un ou l'autre, l'affichage et les calculs divergeront.
- **Correction** : toujours passer par `enregistrerDepense` (c'est le cas aujourd'hui), ou dériver ces informations des imputations à l'affichage.

### ☐ 12. Fichiers déposés sur le disque du serveur

- **Risque** :
  - les fichiers sont dans `public/Upload`. Sans volume Docker persistant, un redéploiement les efface ;
  - il n'y a pas de sauvegarde automatique ;
  - **tout utilisateur connecté** peut ouvrir n'importe quel fichier s'il connaît son adresse, sans contrôle par budget ou par droit.
- **Correction** :
  - vérifier le volume sur le VPS et mettre en place une sauvegarde ;
  - à terme, un stockage objet (Supabase Storage / S3), avec des fichiers servis par une route qui vérifie les droits sur l'objet concerné (budget, bon, proforma).

### ☐ 13. `Paiement.methode` en texte libre

- **Risque** : la fiche proforma enregistre « Virement », « Espèces », « MobileMoney »… tandis que les dépenses de budget utilisent l'enum `ModePaiementDemande` (VIREMENT, ESPECES…). Les rapports par moyen de paiement doivent jongler entre les deux.
- **Correction** : ajouter `Paiement.modePaiement ModePaiementDemande?` (reprise depuis `methode`), puis l'utiliser partout.

### ☐ 14. Quelques routes anciennes créent leur propre client Prisma

- **Risque** : `new PrismaClient()` dans une route ouvre des connexions supplémentaires (limite Supabase). Il en reste **une** hors `lib/prisma`.
- **Correction** : la trouver avec `grep -rln "new PrismaClient()" app lib`, puis utiliser `import prisma from "@/lib/prisma"`.

### ☐ 15. Envois d'email hors du système de notifications

- **Risque** : l'envoi de la proforma au client (`app/api/factures/[id]/send-email`) crée son propre transporteur nodemailer. Il échappe donc à `EMAIL_DISABLED` et à la configuration centrale.
- **Correction** : passer par `sendEmail` (`lib/email/sendEmail.ts`). Ce n'est pas une notification : il n'est pas à mettre dans `notifier`.

---

## Rappels pour toute nouvelle fonctionnalité

1. **Une sortie d'argent** passe par `enregistrerDepense`, jamais par une écriture directe dans `CashJournal`.
2. **Une nouvelle notification** passe par `notifier(evenement, …)` et s'ajoute au catalogue `lib/notifications/evenements.ts`.
3. **Un nouveau droit** est une case sur `Role`, lue par `getBudgetCapabilities` ou `requirePage`. Aucun nom de rôle ni aucun email n'est codé en dur.
4. **Une dépendance ajoutée** se fait avec pnpm, **et** `package-lock.json` est mis à jour (point 6).
5. **Une migration** se génère avec `prisma migrate diff`, puis on vérifie un écart nul après `migrate deploy`.
6. Après chaque changement : `tsc`, `lint`, les tests, puis une entrée dans **`HISTORIQUE.md`**.
