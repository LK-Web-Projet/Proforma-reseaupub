# Tests de bout en bout (Playwright)

Ils pilotent un vrai navigateur sur l'application locale, avec de vrais comptes, pour vérifier la
procédure de paiement de bout en bout et l'absence de régression sur les grandes pages.

## ⚠️ Base de production

La base locale est celle de la production. Chaque exécution :

- marque tout ce qu'elle crée avec un préfixe unique `E2E-xxxx` (rôles, comptes, caisse, client,
  proforma, budgets) et utilise **sa propre caisse de test** — les vraies caisses ne sont jamais débitées ;
- **supprime tout à la fin** (`e2e/global-teardown.ts`), y compris les comptes Clerk et les fichiers
  déposés ; si une exécution est interrompue, le lancement suivant nettoie d'abord ses restes.

Les emails doivent être coupés : lancer le serveur avec `EMAIL_DISABLED=true` (les emails sont
alors seulement écrits dans la console).

## Lancer

1. Serveur, emails coupés (Git Bash) :
   `EMAIL_DISABLED=true pnpm dev`
2. Dans un autre terminal, avec un compte **administrateur** (droit « Peut gérer les comptes ») :
   `E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… E2E_EMAILS_DESACTIVES=true pnpm test:e2e`

Le mot de passe n'est jamais écrit dans un fichier. `E2E_EMAILS_DESACTIVES=true` confirme que le
serveur a les emails coupés (le test de l'état du soir fait alors un vrai envoi… vers la console).

Options : `E2E_BROWSER_CHANNEL=chrome` (utilise le Chrome installé si le navigateur de Playwright
ne peut pas être téléchargé), `E2E_BASE_URL` (défaut `http://localhost:3000`), `E2E_KEEP_DATA=true` pour garder les
données de test et les inspecter (elles seront nettoyées au lancement suivant).

Rapport détaillé (captures, vidéos des échecs) : `npx playwright show-report`.

## Ce qui est testé

- `procedure-paiement.spec.ts` — l'admin crée les rôles Demandeur / Valideur / Comptable et leurs
  comptes ; caisse de test ; refus serveur d'une sortie supérieure au solde ; budget de campagne
  avec un moyen de paiement par ligne et total par moyen ; impression PDF ; validation bloquée sans
  scan signé (écran et serveur) ; scan joint (nom normalisé) ; validation ligne par ligne ; comptable
  sans droit de caisse en consultation seule (écran et 403 serveur) ; dépense refusée faute de
  solde puis acceptée sans justificatif ; passage en rouge après 24 h ouvrées ; état du soir ;
  justificatif ajouté après coup ; fichier protégé sans connexion ; matrice de validation (au-dessus
  du plafond → admin seul) ; séparation des tâches ; rapport par moyen de paiement.
- `non-regression.spec.ts` — chaque grande page s'ouvre pour l'admin sans erreur.
