# Historique du Projet — Proforma Reseaupub

Ce fichier consigne, en français, l'historique de toutes les interventions faites sur le projet : nouvelles fonctionnalités, corrections, erreurs rencontrées et solutions trouvées. Il sert de journal de référence et de guide pour la suite du développement.

Chaque intervention doit ajouter une nouvelle entrée en haut de la section « Journal », avec le format suivant :

```
## AAAA-MM-JJ — Titre court de l'intervention

**Demande / Contexte**
Ce qui a été demandé et pourquoi.

**Modifications apportées**
- Fichier(s) modifié(s)/créé(s) et ce qui a changé.

**Erreurs rencontrées & solutions**
- Problème rencontré → comment il a été résolu. (Ou « Aucune » si tout s'est bien passé.)

**À tester / points d'attention**
- Ce qui reste à vérifier manuellement (ex: nécessite des identifiants réels, à tester en conditions réelles, etc.)
```

---

## 2026-09-27 — Redirection post-connexion « intelligente » (bug bloquant les rôles sans accès Proforma)

**Demande / Contexte**
En production, un utilisateur avec un rôle dont la case « Proforma » n'est pas cochée atterrissait directement sur `/acces-refuse` juste après s'être connecté — alors que la page « Accès refusé » elle-même fonctionnait correctement. Diagnostic : après connexion, l'app forçait systématiquement la redirection vers `/facture` (section Proforma), peu importe les pages réellement autorisées par le rôle — n'importe quel compte sans accès à Proforma se retrouvait donc bloqué dès la première page, même s'il avait accès à d'autres sections.

**Modifications apportées**
- [lib/permissions.ts](lib/permissions.ts) : nouvelle fonction `resolveLandingUrl(pages)` — renvoie l'URL de la première section autorisée par le rôle (dans l'ordre de `PAGE_KEYS`, donc Dashboard en priorité si présent), ou `/budget/demandes` en repli si aucune section classique n'est autorisée (cette section reste accessible à tout utilisateur authentifié, voir entrée du 25/09).
- [app/page.tsx](app/page.tsx) : la racine `/` calcule désormais la destination réelle via `resolveLandingUrl` (à partir de `publicMetadata.pages`) au lieu de forcer `/facture`. Comportement inchangé si `ENABLE_PAGE_PERMISSIONS` n'est pas activé.
- [app/sign-in/[[...sign-in]]/page.tsx](app/sign-in/[[...sign-in]]/page.tsx) : suppression de `forceRedirectUrl="/facture"` (qui écrasait tout) ; `fallbackRedirectUrl` pointe maintenant vers `/`, qui fait le calcul intelligent.
- `.env` : `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` passé de `/facture` à `/` — **à reporter manuellement sur le `.env` du VPS**, ce fichier n'étant pas versionné.
- [app/acces-refuse/page.tsx](app/acces-refuse/page.tsx) : ajout d'un bouton « Retour à l'accueil » (vers `/`) à côté de « Se déconnecter », pour qu'un utilisateur qui atterrit ici par erreur (lien direct, ancien favori...) puisse revenir vers une section qu'il a réellement le droit de voir.

**Erreurs rencontrées & solutions**
Voir diagnostic ci-dessus — bug réel, pas un problème de configuration de rôle. Vérifié avec un test direct de `resolveLandingUrl` : un rôle limité à "fournisseurs" → `/fournisseur`, à "commercial"+"finance" → `/gestionnaire` (premier de la liste), rôle complet (Admin) → `/dashboard`, rôle sans aucune page → `/budget/demandes`.

**À tester / points d'attention**
- Mettre à jour `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/` dans le `.env` du VPS avant/au prochain déploiement.
- Demander à l'utilisateur concerné de se reconnecter une fois déployé, pour confirmer qu'il atterrit désormais sur une section accessible au lieu de `/acces-refuse`.

---

## 2026-09-25 (suite) — Version 1.1.0 → 1.2.0

**Demande / Contexte**
Depuis le dernier bump (1.1.0, création de la feature Demandes de Budget), plusieurs améliorations substantielles ont été apportées à cette même feature : documents typés en cartes, cycle complet rejet → correction → resoumission, ajout de documents après validation, sélection contextuelle « Pour le compte de » (Campagne/Client vs RESEAUPUB), liste de départements. Conformément à la règle de versioning établie (patch = correctif, minor = nouvelle fonctionnalité/amélioration notable, major = refonte), ces changements justifient un bump **minor**.

**Modifications apportées**
- `package.json` / `package-lock.json` : version `1.1.0` → `1.2.0` via `npm version minor --no-git-tag-version`.

**Erreurs rencontrées & solutions**
Aucune.

**À tester / points d'attention**
Aucun — changement purement déclaratif (numéro de version affiché dans le pied de la sidebar via `lib/version.ts`).

---

## 2026-09-25 (suite) — Département : liste de sélection au lieu de texte libre

**Demande / Contexte**
Le champ « Département » était un texte libre. Demande d'une liste fixe (Informatique, RH, Direction Générale, Finance, Déploiement Terrain, Régie Publicitaire, Opérationnel Logistique) plus une option « Autre » avec un champ pour saisir un département non listé.

**Modifications apportées**
- [components/DemandeBudgetForm.tsx](components/DemandeBudgetForm.tsx) : remplace l'`Input` par un `Select` (mêmes 7 départements + « Autre »), avec un champ texte révélé uniquement si « Autre » est choisi — exactement le même schéma déjà utilisé pour « Type de dépense ». En mode édition, si le département déjà enregistré ne correspond à aucune option de la liste, le formulaire bascule automatiquement sur « Autre » avec la valeur existante pré-remplie dans le champ texte.

**Erreurs rencontrées & solutions**
Aucune.

**À tester / points d'attention**
- Tester dans le navigateur : créer une demande avec chacun des départements listés, et avec « Autre » + un nom personnalisé ; rouvrir une demande existante (créée avant ce changement, département en texte libre) en édition pour confirmer qu'elle retombe bien sur « Autre » avec la valeur d'origine visible.

---

## 2026-09-25 (suite) — « Pour le compte de » : sélection contextuelle au lieu de texte libre

**Demande / Contexte**
Le champ « Pour le compte de » était un simple texte libre. Demande de le transformer en sélection : soit « Campagne/Client », soit « RESEAUPUB ». Pour RESEAUPUB, choisir le receveur (« Moi » par défaut, ou « Autre » avec le nom saisi). La valeur finale combine les deux infos : `RESEAUPUB (NOM RECEVEUR)` ou `CAMPAGNE/CLIENT (nom du client - numéro de proforma si associée)`. Le sélecteur de proforma(s) associée(s) ne doit s'afficher que pour Campagne/Client, masqué par défaut pour RESEAUPUB.

**Modifications apportées**
- [components/DemandeBudgetForm.tsx](components/DemandeBudgetForm.tsx) : le champ texte est remplacé par un `Select` (Campagne/Client vs RESEAUPUB). Pour RESEAUPUB, un second `Select` (Moi via `useUser()` de Clerk / Autre + champ nom). Pour Campagne/Client, un champ texte « Nom du client ou de la campagne » et le sélecteur de proforma(s) (désormais masqué en mode RESEAUPUB, et les proformas sélectionnées sont réinitialisées si on bascule vers RESEAUPUB). La chaîne finale `pourLeCompteDe` est calculée côté client à la soumission — aucun changement de schéma ni de route API nécessaire, le champ reste un simple texte en base. En mode édition, la chaîne existante est reparsée pour reconstituer la sélection (best-effort : un ancien texte libre non conforme au format retombe en mode Campagne/Client avec le texte tel quel).

**Erreurs rencontrées & solutions**
Aucune.

**À tester / points d'attention**
- Tester dans le navigateur : créer une demande RESEAUPUB (Moi, puis Autre), une demande Campagne/Client avec et sans proforma associée, et rouvrir une demande rejetée existante en édition pour confirmer que la sélection se reconstitue correctement à partir du texte déjà enregistré.

---

## 2026-09-25 (suite) — Ajout de documents possible après validation

**Demande / Contexte**
Des documents complémentaires peuvent être nécessaires après qu'une demande a été validée (mais avant paiement) — demande d'autoriser l'ajout de documents dans ce cas, pour l'auteur de la demande, l'admin et le comptable (contrairement à la correction complète, réservée aux demandes rejetées).

**Modifications apportées**
- [components/DemandeBudgetAddDocumentsDialog.tsx](components/DemandeBudgetAddDocumentsDialog.tsx) (nouveau) : dialogue léger (type + fichier, lignes dynamiques) réutilisant les types de documents existants, sans toucher aux autres champs de la demande.
- Nouvelle route [app/api/demandes-budget/[id]/documents/route.ts](app/api/demandes-budget/[id]/documents/route.ts) (POST) : accepte l'ajout uniquement si la demande est `VALIDEE`, et uniquement pour l'auteur de la demande, l'admin ou le comptable (403 sinon) — n'affecte que les pièces jointes, aucun autre champ ni le statut.
- [app/(main)/budget/demandes/[id]/page.tsx](app/(main)/budget/demandes/[id]/page.tsx) : bouton « Ajouter des documents » dans l'en-tête de la carte Documents, visible uniquement quand `statut === 'VALIDEE'` et que la personne connectée est autorisée.

**Erreurs rencontrées & solutions**
Aucune.

**À tester / points d'attention**
- Tester dans le navigateur : valider une demande, ajouter un document en tant qu'auteur puis en tant qu'admin/comptable, vérifier qu'il apparaît dans la liste des documents sans changer le statut. Vérifier aussi qu'un utilisateur non impliqué et non auteur ne voit pas le bouton / se voit refuser l'appel API.

---

## 2026-09-25 (suite) — Régression : `serverExternalPackages` cassait toute l'app en dev

**Demande / Contexte**
En testant `pnpm dev` en local, l'app entière plantait (`GET / 500`) avec `Cannot find module '.../@clerk/nextjs/dist/esm/client-boundary/controlComponents'`. Une réinstallation complète de `node_modules` n'a rien changé (fichiers vérifiés présents et non corrompus sur le disque) — la cause était en fait un changement de configuration fait plus tôt dans la même journée.

**Cause identifiée**
`next.config.ts` avait `serverExternalPackages: ["@clerk/nextjs", "@clerk/backend"]`, ajouté pour corriger le tracing de `instrumentation.ts` en build standalone (voir entrée précédente). Cette option force Next.js à charger ces packages via un vrai `import()` Node natif (mode ESM strict) au lieu de les bundler. Or `@clerk/nextjs@6.39.5` a des imports internes sans extension de fichier (`from "./client-boundary/controlComponents"` au lieu de `"./client-boundary/controlComponents.js"`) — invalide en ESM Node strict, mais toléré par un bundler classique. Résultat : toute l'app (middleware, layout, sidebar, routes API — partout où `@clerk/nextjs` est utilisé) plantait, pas seulement `instrumentation.ts`.

**Modifications apportées**
- [next.config.ts](next.config.ts) : `serverExternalPackages` retiré. Commentaire ajouté expliquant pourquoi ne pas le remettre. Conséquence acceptée : le bootstrap RBAC automatique au démarrage (`instrumentation.ts`) continue d'échouer silencieusement en build standalone (déjà catché par le `try/catch`, ne bloque rien) — la méthode fiable pour synchroniser les rôles reste le script CLI manuel (`scripts/seed-admin-users.ts`) lancé via un conteneur temporaire sur le réseau du VPS (déjà utilisé avec succès).
- Ce changement n'avait jamais été commité ni déployé — aucun impact sur la production.

**Erreurs rencontrées & solutions**
Voir ci-dessus. Piste à explorer plus tard si on veut vraiment un bootstrap 100% automatique : `outputFileTracingIncludes` ciblé (force la copie des fichiers dans le build standalone sans changer le mode de chargement du module) — non tenté ici par prudence, pas de moyen fiable de le tester en conditions de build standalone réelles depuis ce poste.

**À tester / points d'attention**
- Relancer `pnpm dev` pour confirmer que l'app démarre normalement (déjà vérifié : `tsc --noEmit` propre, fichiers `@clerk/nextjs` intacts sur disque, cache `.next` vidé).

---

## 2026-09-25 (suite) — Documents typés en cartes + cycle rejet/correction/resoumission

**Demande / Contexte**
Trois demandes liées aux Demandes de Budget : (1) remplacer l'upload générique de « documents liés à la commande » par un formulaire où chaque document a un type (Devis, Facture/Preuve de dépense, Bon de commande, Autre — en plus de la Preuve de décaissement déjà ajoutée par le comptable), affichés en cartes avec le type visible ; (2) confirmer que l'auteur d'une demande reçoit bien un email quand elle est rejetée ; (3) permettre à l'auteur ou au comptable de corriger une demande rejetée (montants, produits, documents...) et de la resoumettre, ce qui la fait revenir en attente de validation. Une section « Notifications » in-app plus large est notée comme travail futur (« on créera ensuite »), non traitée ici.

**Modifications apportées**
- [prisma/schema.prisma](prisma/schema.prisma) : `TypeAttachmentDemande` passe de `{DOCUMENT_COMMANDE, PREUVE_PAIEMENT}` à `{DEVIS, FACTURE, BON_COMMANDE, PREUVE_PAIEMENT, AUTRE}`. Migration écrite à la main (`prisma migrate dev` refusait de tourner en environnement non-interactif à cause de l'avertissement de perte de données) avec un remapping `DOCUMENT_COMMANDE → AUTRE` intégré dans le `USING` du `ALTER COLUMN`, appliquée via `prisma migrate deploy` — vérifié après coup : la ligne existante a bien été remappée vers `AUTRE`, aucune perte de données.
- [lib/demandeBudgetAttachmentTypes.ts](lib/demandeBudgetAttachmentTypes.ts) (nouveau) : labels et couleurs partagés par type, réutilisés dans le formulaire et l'affichage.
- [lib/uploadDemandeBudget.ts](lib/uploadDemandeBudget.ts) : nouvelle fonction `saveTypedDemandeBudgetAttachments()` — lit les champs `documents_DEVIS`, `documents_FACTURE`, etc. d'un FormData et prépare les lignes prêtes pour `createMany`.
- [components/DemandeBudgetForm.tsx](components/DemandeBudgetForm.tsx) : la zone d'upload devient une liste dynamique (type + fichier) au lieu d'un simple champ multi-fichiers ; ajout du mode édition (`mode="edit"`, `initialData`, `demandeId`) qui préremplit tous les champs (y compris détection du « Autre » personnalisé pour le type de dépense) et affiche les documents déjà fournis en lecture seule.
- Nouvelle route [app/api/demandes-budget/[id]/resoumettre/route.ts](app/api/demandes-budget/[id]/resoumettre/route.ts) : réservée à l'auteur de la demande ou au comptable, uniquement si `statut === REJETEE` ; remplace lignes/proformas, met à jour tous les champs, ajoute les nouveaux documents (les anciens restent), repasse le statut à `SOUMISE` (motif de rejet et validation réinitialisés) et renvoie la notification de soumission à l'admin.
- [app/api/demandes-budget/route.ts](app/api/demandes-budget/route.ts) (POST création) : utilise désormais `saveTypedDemandeBudgetAttachments` au lieu du champ unique `documentsCommande`.
- [app/api/demandes-budget/me-role/route.ts](app/api/demandes-budget/me-role/route.ts) : renvoie désormais aussi `email`, nécessaire pour que le front compare « suis-je l'auteur de cette demande ? ».
- [app/(main)/budget/demandes/[id]/page.tsx](app/(main)/budget/demandes/[id]/page.tsx) : section « Documents » entièrement en cartes (icône, badge de type coloré, nom de fichier, aperçu) ; nouveau bloc « Demande rejetée — corriger et resoumettre » (visible pour l'auteur ou le comptable) menant à la nouvelle page de modification.
- Nouvelle page [app/(main)/budget/demandes/[id]/modifier/page.tsx](app/(main)/budget/demandes/[id]/modifier/page.tsx) : réutilise `DemandeBudgetForm` en mode édition, préremplie avec les données existantes.
- Vérifié (aucun changement de code nécessaire) : [lib/email/demandeBudget.ts](lib/email/demandeBudget.ts)'s `sendDemandeRejeteeNotification` envoie déjà à `demande.requesterEmail`, capturé automatiquement à la création via Clerk — déjà correctement branché depuis `app/api/demandes-budget/[id]/rejeter/route.ts`.

**Erreurs rencontrées & solutions**
- `prisma migrate dev --create-only` échouait avec « non-interactive environment is not supported » à cause de l'avertissement de perte de données sur l'enum → migration écrite à la main puis appliquée via `prisma migrate deploy` (non-interactif par nature, n'applique que les migrations en attente sans recalcul de diff).
- Erreur de typage `kind: string` non assignable à l'enum Prisma dans les deux routes POST → corrigé en typant `saveTypedDemandeBudgetAttachments` avec `DocumentUploadType` (sous-ensemble litéral compatible) au lieu de `string`.

**À tester / points d'attention**
- Tester dans le navigateur : créer une demande avec plusieurs documents de types différents, vérifier l'affichage en cartes ; faire rejeter une demande par l'admin, vérifier la réception de l'email par le demandeur, puis la corriger et la resoumettre en tant qu'auteur ET en tant que comptable pour confirmer que les deux peuvent le faire.
- Section « Notifications » in-app : à construire dans une prochaine intervention, non commencée ici.

---

## 2026-09-25 (suite) — Section « Budget » à part + visibilité limitée aux propres demandes

**Demande / Contexte**
La section Demandes de Budget vivait sous « Finance » dans la navbar. Demande de la sortir en section « Budget » à part entière, avec deux entrées (« Faire une demande », « Voir les demandes »), et de restreindre la visibilité des données : un employé qui n'est ni admin ni comptable du processus budget ne doit voir QUE les demandes qu'il a lui-même soumises (avec un message dédié si aucune), alors que l'admin et le comptable (emails dans `BUDGET_ADMIN_EMAILS`/`BUDGET_COMPTABLE_EMAILS`) continuent de voir toutes les demandes avec les filtres existants.

**Modifications apportées**
- [components/DemandeBudgetForm.tsx](components/DemandeBudgetForm.tsx) (nouveau) : formulaire de demande extrait de l'ancien `DemandeBudgetModal.tsx` (supprimé), réutilisable en page pleine plutôt qu'en dialogue.
- [app/(main)/budget/nouvelle-demande/page.tsx](app/(main)/budget/nouvelle-demande/page.tsx) (nouveau) : page dédiée « Faire une demande », remplace l'ancien dialogue.
- [app/(main)/budget/demandes/page.tsx](app/(main)/budget/demandes/page.tsx) et [.../[id]/page.tsx](app/(main)/budget/demandes/[id]/page.tsx) : déplacés depuis `app/(main)/finance/demandes-budget/` (dossier supprimé). La liste appelle désormais `/api/demandes-budget/me-role` pour adapter le titre et afficher un message + bouton « Faire une demande » quand un utilisateur non impliqué dans le processus n'a encore aucune demande, au lieu du message générique.
- [app/api/demandes-budget/route.ts](app/api/demandes-budget/route.ts) (GET) : filtre désormais forcé côté serveur — un utilisateur qui n'est ni admin ni comptable budget ne reçoit que les demandes où `requesterEmail` correspond à son propre email (impossible à contourner via un paramètre client).
- [app/api/demandes-budget/[id]/route.ts](app/api/demandes-budget/[id]/route.ts) (GET) : même principe pour le détail — un utilisateur non impliqué qui devinerait l'URL d'une demande d'un collègue reçoit désormais un 403 (« Accès refusé à cette demande. »), sauf si c'est bien sa propre demande.
- [components/app-sidebar.tsx](components/app-sidebar.tsx) : nouvelle section « Budget » (icône `PiggyBank`) avec « Faire une demande » et « Voir les demandes », retirée de la section Finance. Volontairement **non** soumise aux cases à cocher par page (`canSeePage`) — accessible à tout utilisateur authentifié, car n'importe quel employé doit pouvoir soumettre une demande ; la restriction se fait sur les données (qui voit quoi), pas sur l'accès à la section.
- [lib/email/demandeBudget.ts](lib/email/demandeBudget.ts) : lien dans les emails de notification mis à jour vers `/budget/demandes/{id}`.

**Erreurs rencontrées & solutions**
- Après suppression de l'ancien dossier `app/(main)/finance/demandes-budget/`, `tsc` signalait des erreurs sur des fichiers `.next/types/.../finance/demandes-budget/...` — résidus de types auto-générés par un précédent build référençant les anciennes routes. Résolu en vidant `.next/` (pas une vraie erreur de code).

**À tester / points d'attention**
- Se connecter avec un compte qui n'est ni dans `BUDGET_ADMIN_EMAILS` ni `BUDGET_COMPTABLE_EMAILS`, confirmer qu'il ne voit que ses propres demandes dans `/budget/demandes`, et qu'accéder directement à l'URL d'une demande d'un collègue renvoie bien un refus.
- Confirmer que l'admin/comptable voient toujours toutes les demandes avec les filtres (statut, département) inchangés.

---

## 2026-09-25 (suite) — Bootstrap RBAC automatique au démarrage + correctif création de compte

**Demande / Contexte**
Suite à la découverte que `scripts/seed-admin-users.ts` ne peut pas tourner dans le conteneur de prod (voir entrée précédente), l'utilisateur a demandé d'automatiser ce bootstrap directement dans le code applicatif (exécuté une fois au démarrage, sans rien faire si déjà synchronisé) plutôt que de dépendre d'une commande manuelle à chaque fois. Par ailleurs, la création d'un compte utilisateur échouait avec `["username"] data doesn't match user requirements set for this instance`.

**Modifications apportées**
- [lib/bootstrapAdminUsers.ts](lib/bootstrapAdminUsers.ts) (nouveau) : logique extraite de `scripts/seed-admin-users.ts` en une fonction réutilisable `bootstrapAdminUsers()` (idempotente — ne retouche jamais un compte déjà migré).
- [scripts/seed-admin-users.ts](scripts/seed-admin-users.ts) : simplifié pour appeler `bootstrapAdminUsers()` (reste utilisable manuellement en CLI pour diagnostic).
- [instrumentation.ts](instrumentation.ts) (nouveau) : hook standard Next.js exécuté une fois à chaque démarrage du serveur (runtime Node uniquement, jamais Edge) — appelle `bootstrapAdminUsers()` en tâche de fond, erreurs journalisées sans jamais bloquer le démarrage.
- [next.config.ts](next.config.ts) : ajout de `serverExternalPackages: ["@clerk/nextjs", "@clerk/backend"]` — nécessaire car le tracing du build `standalone` ne détectait pas correctement `@clerk/nextjs/server` derrière l'import dynamique de `instrumentation.ts` (vérifié via `.next/server/instrumentation.js.nft.json` : 0 fichier `@clerk` tracé avant ce correctif, contre 9 fichiers Prisma) — sans ce correctif, l'erreur "Cannot find module '@clerk/nextjs/server'" se serait reproduite au démarrage du serveur en prod, cette fois de façon bien plus grave qu'un script CLI isolé.
- [app/api/users/route.ts](app/api/users/route.ts) : ajout de `generateUsername(email, nom)` — dérive un username valide (alphanumérique + suffixe aléatoire) à partir de l'email, passé à `clerkClient().users.createUser()`. L'app n'utilise de username nulle part dans son flux, mais l'instance Clerk l'exige au format valide à la création.

**Erreurs rencontrées & solutions**
- `Cannot find module '@clerk/nextjs/server'` en tentant d'exécuter le script dans le conteneur de prod (`docker exec`) : l'image `standalone` ne contient qu'un node_modules tracé pour le bundle Next.js, pas pour un script arbitraire → résolu en exécutant le script depuis un conteneur `node:20-alpine` temporaire sur le réseau Docker du VPS avec `npm ci` complet (voir entrée précédente).
- Tracing incomplet de `@clerk/nextjs/server` pour `instrumentation.ts` → résolu via `serverExternalPackages` (voir ci-dessus), vérifié directement dans le `.nft.json` généré par le build.
- `node_modules` corrompu de façon inattendue pendant les tests (`Cannot find module 'next/dist/.../global-not-found'`, puis `typescript/lib/typescript.js` manquant) → résolu par une réinstallation complète (`rm -rf node_modules && pnpm install` + `npx prisma generate`), sans lien avec les changements de code.
- `["username"] data doesn't match user requirements set for this instance` → username généré côté code (voir ci-dessus).

**À tester / points d'attention**
- Confirmer en prod, après déploiement, que les logs du conteneur affichent bien `[bootstrap] Rôles & utilisateurs synchronisés : ...` au démarrage.
- Créer un nouveau compte utilisateur depuis `/parametres/utilisateurs` pour confirmer que l'erreur de username a bien disparu.

---

## 2026-09-16 — Demandes de Budget : boutons d'action remontés dans la fiche détail

**Demande / Contexte**
L'utilisateur a signalé ne pas trouver de moyen de changer le statut d'une demande de budget (Valider/Rejeter pour l'admin, Marquer comme payée pour le comptable). Après vérification du code (logique correcte, question de configuration `.env`/compte de test écartée par l'utilisateur), le vrai souci était l'emplacement : ces actions étaient tout en bas de la fiche détail, après les infos, les lignes de dépense et les pièces jointes — pas assez visibles/accessibles.

**Modifications apportées**
- [app/(main)/finance/demandes-budget/[id]/page.tsx](app/(main)/finance/demandes-budget/[id]/page.tsx) : les cartes « Validation requise » (admin) et « Marquer comme payée » (comptable) sont déplacées juste après l'en-tête de la fiche, avant les détails/lignes/pièces jointes — visibles sans avoir à scroller. Ajout d'une bordure colorée en haut (vert pour validation, indigo pour paiement) pour les rendre plus repérables, sur le même modèle que les cartes de synthèse déjà utilisées ailleurs dans l'app.

**Erreurs rencontrées & solutions**
Aucune (pas de bug de code — uniquement un ajustement de position/visibilité dans l'UI).

**À tester / points d'attention**
- Confirmer visuellement que les boutons Valider/Rejeter et le formulaire de paiement apparaissent bien juste sous l'en-tête pour les comptes admin/comptable.

---

## 2026-08-20 — Réinitialisation du mot de passe utilisateur (UI admin)

**Demande / Contexte**
Après la mise en production du système de rôles (entrée précédente), l'utilisateur a remarqué qu'il n'existait aucun moyen de gérer le mot de passe d'un compte après sa création : le mot de passe n'est saisi qu'une fois, dans le dialogue "Créer un compte" — impossible ensuite de le changer si l'utilisateur l'oublie ou en cas de doute sur la sécurité du compte.

**Modifications apportées**
- [app/api/users/[id]/route.ts](app/api/users/[id]/route.ts) : `updateUserSchema` accepte désormais un champ `password` optionnel (min. 8 caractères). Le handler `PATCH` appelle `clerkClient().users.updateUser(id, { password, signOutOfOtherSessions: true })` quand un mot de passe est fourni, avec remontée du message d'erreur Clerk (ex. mot de passe trop faible) en 400. `clerkClient()` est maintenant résolu une seule fois et réutilisé pour ce bloc et pour le ban/unban existant.
- [app/(main)/parametres/utilisateurs/page.tsx](app/(main)/parametres/utilisateurs/page.tsx) : ajout d'une colonne "Mot de passe" dans le tableau des utilisateurs avec un bouton (icône clé) ouvrant un dialogue "Réinitialiser le mot de passe" (nouveau mot de passe, min. 8 caractères) qui appelle `PATCH /api/users/[id]` avec `{ password }`.

**Erreurs rencontrées & solutions**
Aucune.

**À tester / points d'attention**
- Test manuel à faire par l'utilisateur : réinitialiser le mot de passe d'un compte de test depuis `/parametres/utilisateurs`, vérifier que la connexion avec l'ancien mot de passe échoue et qu'elle réussit avec le nouveau (l'utilisateur est aussi déconnecté de ses sessions actives par sécurité, `signOutOfOtherSessions: true`).

---

## 2026-08-20 — Mise en production du système de rôles/permissions (suite et activation)

**Demande / Contexte**
Suite de l'entrée précédente : connexion base de données rétablie, configuration Clerk (custom session claim) faite côté Dashboard par l'utilisateur. Exécution de la checklist de mise en production jusqu'au point 7.

**Incident détecté et corrigé en cours de route**
`prisma/schema.prisma` avait été ramené à son état d'avant les modifications (probablement une annulation accidentelle sur ce fichier précisément — les 20 autres fichiers créés/modifiés dans l'entrée précédente étaient intacts). Un premier `prisma migrate dev` avait alors renvoyé « Already in sync » de façon trompeuse : il comparait un schéma déjà vidé de `Role`/`User` à une base qui ne les avait pas non plus. L'utilisateur a eu le bon réflexe de faire revérifier. Diagnostic confirmé par une requête directe (`prisma.role.count()` → « table does not exist »). Le schéma a été reconstruit à l'identique (mêmes modèles, mêmes relations) et revalidé (`prisma validate`) avant de relancer la migration.

**Étapes exécutées**
1. `DIRECT_URL` corrigée par l'utilisateur (port 5432, connexion directe, au lieu de 6543/pooler utilisé par erreur) — a débloqué la connexion.
2. `npx prisma migrate dev --name add_users_roles_permissions_and_audit_trail` : migration réellement générée et appliquée cette fois (vérifié par requête directe : tables `Role`/`RolePage`/`User` et colonne `Invoice.createdById` bien présentes en base).
3. Dashboard Clerk → Sessions → Customize session token → `{ "metadata": "{{user.public_metadata}}" }` : fait par l'utilisateur.
4. `pnpm run bootstrap:admin-users` : rôle "Admin" créé (accès à toutes les pages + `canManageUsers`), 5 comptes Clerk existants migrés et synchronisés (`info@`, `ibrahime.manane@`, `finance@`, `karamatouabgetou@`, `informatique@reseaupub.com`) — 0 échec.
5. Vérifié en base que les 5 comptes ont bien le rôle Admin, actifs — correspond à ce que `/parametres/utilisateurs` doit afficher.
6. `ENABLE_PAGE_PERMISSIONS=true` activé dans `.env`.
7. Logique de routage `resolvePageKeyFromPathname` vérifiée par un script de test couvrant les 17 pages + cas hors périmètre (`/sign-in`, `/api/*`) — tous les cas passent.

**Erreurs rencontrées & solutions**
Voir "Incident détecté et corrigé en cours de route" ci-dessus — leçon retenue : toujours vérifier l'état réel de la base (requête directe) plutôt que de se fier seul au message `migrate dev`/`migrate status`, qui peut être trompeur si le fichier schema.prisma a changé entre-temps sans qu'on s'en aperçoive.

**À tester / points d'attention**
- **Test de bout en bout non encore fait par manque d'accès navigateur côté assistant** : créer un rôle restreint depuis `/parametres/roles` (ex. seulement "Proforma" coché), créer un compte de test depuis `/parametres/utilisateurs`, se connecter avec dans une fenêtre privée, et vérifier que la navigation vers une section non cochée redirige bien vers `/acces-refuse`. C'est le test qui valide l'ensemble de la chaîne (UI admin → sync Clerk → middleware).
- Vérifier que les 5 admins existants peuvent toujours accéder à tout normalement après l'activation (conséquence attendue du rôle Admin complet).
- Phase 2 (toujours non commencée) : traçabilité sur Client/Fournisseur/Gestionnaire/Produits, affichage "Créé par {nom}" dans les UI.

---

## 2026-08-20 — Gestion des utilisateurs, rôles & permissions par page + traçabilité "qui a fait quoi" (Phase 1)

**Demande / Contexte**
Demande de gérer soi-même les comptes utilisateurs et leurs droits : l'admin crée des comptes, leur attribue un rôle, et coche les pages de l'app que ce rôle peut consulter. Objectif secondaire : associer chaque enregistrement créé (facture, paiement, entrée de caisse, facture fournisseur) à l'utilisateur qui l'a fait, pour savoir "qui a fait quoi". Contrainte forte : app en production, il fallait aller vite sans casser l'authentification existante (Clerk) ni risquer de bloquer les utilisateurs actuels.

**État constaté avant modification** (exploration complète faite avant de coder) : Clerk ne faisait que de l'authentification (`middleware.ts` → `auth.protect()` = "connecté ou pas", rien de plus) ; le seul contrôle de rôle existant (`role === "org:admin"` dans `components/app-sidebar.tsx`) était purement cosmétique côté client, sans aucune vérification serveur ; aucune table `User`/`Role` en base ; aucune route API ne capturait l'identité de l'utilisateur agissant.

**Décisions d'architecture validées avec l'utilisateur**
- Garder Clerk pour l'authentification (mot de passe, sessions, sécurité) — construire les rôles/permissions par-dessus, pas à la place.
- Granularité des permissions : par section de sidebar (7 clés : dashboard, proforma, client, fournisseurs, commercial, finance, parametres), pas par page individuelle.
- Le middleware ne fait pas d'appel base de données à chaque navigation : les permissions (calculées depuis nos tables Prisma, source de vérité) sont poussées dans le `publicMetadata` Clerk de chaque utilisateur, et le middleware lit ce metadata directement depuis la session.
- Traçabilité priorisée sur l'argent d'abord : `Invoice`, `Paiement`, `CashJournal`, `FactureFournisseur` (Phase 1) ; les autres tables (Client, Fournisseur, Gestionnaire...) seront traitées dans une phase 2 séparée.
- Création de compte : l'admin définit le mot de passe directement (pas d'email d'invitation Clerk).

**Modifications apportées**
- `prisma/schema.prisma` : nouveaux modèles `Role` (nom, `canManageUsers`, pages), `RolePage` (une ligne par page cochée pour un rôle) et `User` (id = Clerk userId, email, nom, rôle, actif). Ajout de `createdById` (nullable) sur `Invoice`, `Paiement`, `CashJournal`, `FactureFournisseur`.
- `lib/permissions.ts` (nouveau) : définitions pures partagées (`PAGE_KEYS`, `PAGE_LABELS`, `resolvePageKeyFromPathname`, type `AppPublicMetadata`) — **sans aucune dépendance Node-only**, pour rester utilisable à la fois par le middleware (runtime Edge), les composants client (UI admin) et les routes API. Erreur évitée en amont : importer Prisma/Clerk-backend directement dans un fichier utilisé par `middleware.ts` aurait cassé le build Edge.
- `lib/authz.ts` : `syncUserMetadata`/`syncAllUsersForRole` (poussent les permissions vers Clerk), `requirePage`/`requireCanManageUsers` (garde-fous pour routes API sensibles), et `safeCreatedById` — vérifie qu'un `userId` Clerk correspond bien à un `User` local existant avant de l'utiliser comme `createdById`, sinon renvoie `null`. **Bug évité avant qu'il n'arrive en prod** : sans ce garde-fou, toute création de facture/paiement/entrée de caisse aurait échoué avec une violation de contrainte de clé étrangère tant que le script de bootstrap n'a pas tourné (aucun `User` local n'existe encore aujourd'hui).
- `middleware.ts` : après la vérification d'authentification existante, lit `sessionClaims.metadata.pages` et redirige vers `/acces-refuse` si la section demandée n'est pas autorisée — **derrière une bascule `ENABLE_PAGE_PERMISSIONS`** (variable d'environnement, absente/false par défaut) pour ne rien activer tant que la configuration Clerk et le script de bootstrap n'ont pas été faits (voir "À tester" ci-dessous).
- `app/acces-refuse/page.tsx` (nouveau) : page affichée quand un compte connecté n'a pas accès à la section demandée.
- `app/api/roles/route.ts` + `app/api/roles/[id]/route.ts` (nouveaux) : CRUD des rôles, protégés par `requireCanManageUsers`. La modification des pages d'un rôle resynchronise automatiquement le metadata Clerk de tous les utilisateurs de ce rôle.
- `app/api/users/route.ts` + `app/api/users/[id]/route.ts` (nouveaux) : création de compte (appelle `clerkClient().users.createUser` avec mot de passe fourni par l'admin, puis crée le `User` local), changement de rôle, activation/désactivation (répercutée sur Clerk via `banUser`/`unbanUser` pour empêcher réellement la connexion).
- `app/(main)/parametres/utilisateurs/page.tsx` et `app/(main)/parametres/roles/page.tsx` (nouveaux) : UI admin (liste + dialogues de création/édition, cases à cocher par page pour les rôles). Liens ajoutés sur `app/(main)/parametres/page.tsx`, visibles uniquement si `canManageUsers` (lu depuis le `publicMetadata` Clerk côté client).
- `components/app-sidebar.tsx` : les sections de la sidebar utilisent maintenant `publicMetadata.pages` quand disponible ; **repli automatique sur l'ancien comportement** (`org:admin` Clerk) tant qu'un compte n'a pas encore été synchronisé, pour ne rien casser visuellement pendant la transition.
- `lib/cashJournal.ts` (`recordCashMovement`) et `lib/paiements.ts` (`recordDepensePaiement`) : acceptent et enregistrent désormais `createdById` (via `safeCreatedById`).
- `app/api/factures/route.ts`, `app/api/factures/[id]/paiements/route.ts`, `app/api/cash-journal/route.ts`, `app/api/factures-fournisseurs/route.ts` : capturent `const { userId } = await auth();` et renseignent `createdById` sur les enregistrements créés (facture, paiement PAIEMENT et DEPENSE, entrée de caisse RECETTE/DEPENSE/TRANSFERT, facture fournisseur).
- `scripts/seed-admin-users.ts` (nouveau, `npm run bootstrap:admin-users`) : crée le rôle "Admin" (toutes les pages + `canManageUsers`) et y rattache tous les comptes Clerk existants qui n'ont pas encore de `User` local, avec synchronisation immédiate du metadata — **à lancer une seule fois**, avant d'activer `ENABLE_PAGE_PERMISSIONS`.
- `.env` : section documentée pour `ENABLE_PAGE_PERMISSIONS` (commentée, avec la procédure d'activation en 2 étapes).

**Erreurs rencontrées & solutions**
- Connexion à la base Supabase indisponible pendant toute la session (`P1001`, puis auparavant un hang indéfini sur `db pull`/`migrate dev`) — `npx prisma migrate dev` n'a pas pu être exécuté. Contournement : tout le code a été écrit et vérifié via `npx prisma generate` (qui ne nécessite que le fichier `schema.prisma`, pas de connexion) + `tsc --noEmit`. **La migration Prisma correspondant à ce nouveau schéma n'a pas encore été créée ni appliquée** — à faire dès que la connexion est rétablie (voir "À tester").
- Risque de violation de clé étrangère sur `createdById` identifié et corrigé avant tout déploiement (voir `safeCreatedById` ci-dessus).
- Risque d'importer Prisma/Clerk-backend dans le bundle Edge du middleware identifié et corrigé en séparant `lib/permissions.ts` (pur) de `lib/authz.ts` (Node-only) avant que ça ne casse le build.
- `tsc --noEmit` et `next lint` passent sans erreur sur tous les fichiers créés/modifiés (deux erreurs préexistantes et non liées subsistent dans `scripts/backup.ts`/`scripts/test-direct.ts` : dépendance `dotenv` manquante, non installée avant cette session).

**À tester / points d'attention — checklist de mise en production, dans l'ordre**
1. Rétablir la connexion à la base (en cours — voir échanges précédents ; `DATABASE_URL`/`DIRECT_URL` déjà mis à jour avec de nouveaux identifiants, mais le serveur reste injoignable à ce stade).
2. Une fois la connexion rétablie : `npx prisma migrate dev` (génère et applique la migration pour `Role`/`RolePage`/`User` + les champs `createdById`).
3. Dans le Dashboard Clerk : **Sessions → Customize session token**, ajouter `{ "metadata": "{{user.public_metadata}}" }` — sans cette étape, `sessionClaims.metadata` reste `undefined` et le contrôle d'accès ne peut pas fonctionner même une fois activé.
4. Lancer `npm run bootstrap:admin-users` (une seule fois) — migre tous les comptes Clerk existants vers un rôle Admin complet.
5. Vérifier dans `/parametres/utilisateurs` que tous les comptes attendus apparaissent bien, avec le rôle Admin.
6. Mettre `ENABLE_PAGE_PERMISSIONS=true` dans `.env` et redéployer.
7. Tester : créer un rôle restreint (ex. seulement "Proforma" coché), créer un compte de test avec ce rôle, se connecter avec, vérifier que `/fournisseur` ou `/journal-caisse` redirige vers `/acces-refuse` alors que `/facture` reste accessible.
8. Créer une proforma, un paiement, une entrée de caisse et une facture fournisseur, puis vérifier en base que `createdById` correspond bien à l'utilisateur connecté.
- Phase 2 (non commencée) : traçabilité sur Client/Fournisseur/Gestionnaire/Produits, affichage "Créé par {nom}" dans les UI, et éventuellement `updatedById`.

---

## 2026-09-14 — Demandes de Budget (remplace le suivi Google Sheet) — v1.1.0

**Demande / Contexte**
Les demandes de budget/décaissement étaient suivies manuellement dans un Google Sheet. Objectif : les gérer directement dans l'app avec un vrai circuit (soumission → validation par un admin → traitement/paiement par le comptable) et des notifications email à chaque étape. Pas de formulaire public pour l'instant — seul un utilisateur authentifié (Clerk) peut soumettre une demande.

**Incident détecté et corrigé en cours de route (dérive de schéma)**
Avant de migrer, `prisma migrate dev` a détecté que la base de données réelle (partagée entre branches) contenait déjà les tables `Role`/`RolePage`/`User` et les colonnes `createdById` sur `Invoice`/`Paiement`/`CashJournal`/`FactureFournisseur` — appliquées précédemment depuis la branche `feature/usersgestion` (non fusionnée sur `review_code`/`main`), qui n'apparaissaient donc ni dans `prisma/schema.prisma` ni dans `prisma/migrations/` de cette branche. Prisma proposait `migrate reset` (suppression et recréation complète du schéma — aurait détruit les 355+ factures et toutes les autres données). **Aucune commande destructive n'a été exécutée.** Après confirmation de l'utilisateur, la migration manquante (`20260820122101_add_users_roles_permissions_and_audit_trail`) a été copiée depuis `feature/usersgestion`, et les modèles `Role`/`RolePage`/`User` + champs `createdById` correspondants ont été ajoutés au `schema.prisma` de cette branche pour refléter l'état réel de la base — opération purement additive, aucune donnée touchée (vérifié après coup : 355 factures, 5 users, 2 rôles toujours intacts). La migration `20260914095017_add_demandes_budget` a ensuite été créée et appliquée normalement par-dessus.

**Modifications apportées**
- [prisma/schema.prisma](prisma/schema.prisma) : nouveaux modèles `DemandeBudget`, `DemandeBudgetLigne`, `DemandeBudgetProforma` (lien plusieurs-à-plusieurs vers `Invoice`), `DemandeBudgetAttachment` (deux types via l'enum `TypeAttachmentDemande` : `DOCUMENT_COMMANDE` à la création, `PREUVE_PAIEMENT` au paiement) ; enums `StatutDemandeBudget` (SOUMISE/VALIDEE/REJETEE/PAYEE) et `ModePaiementDemande`. Lien optionnel vers `CommandeFournisseur`. Pas de champ `Client` direct : le(s) client(s) s'affichent via les proformas liées.
- [lib/budgetAuth.ts](lib/budgetAuth.ts) (nouveau) : identifie l'admin/comptable via des listes d'emails en `.env` (`BUDGET_ADMIN_EMAILS`, `BUDGET_COMPTABLE_EMAILS`) comparées à l'email Clerk de la personne connectée — pas de système de rôles en base sur cette branche, donc même logique que la liste `NOTIFICATION_RECIPIENTS` déjà utilisée pour les emails de proforma.
- [lib/email/sendEmail.ts](lib/email/sendEmail.ts) (nouveau) : petit helper mutualisé pour l'envoi d'emails (nodemailer), extrait de la config déjà dupliquée dans `lib/email/proformaValidation.ts` et `app/api/factures/[id]/send-email/route.ts` — ces deux call sites existants n'ont pas été touchés (déjà en prod). [lib/email/demandeBudget.ts](lib/email/demandeBudget.ts) (nouveau) : 3 notifications (demande soumise → admin, demande validée → comptable, demande rejetée → demandeur).
- [lib/uploadDemandeBudget.ts](lib/uploadDemandeBudget.ts) (nouveau) : upload multi-fichiers sous `public/Upload/DemandeBudget/{id}/`, même pattern que `CashJournalAttachment`.
- Nouvelles routes API : `app/api/demandes-budget/route.ts` (GET liste filtrable, POST création multipart), `[id]/route.ts` (GET détail), `[id]/valider`, `[id]/rejeter`, `[id]/payer` (actions protégées par `requireBudgetAdmin`/`requireBudgetComptable`), `me-role` (indique au frontend si l'utilisateur connecté peut valider/traiter, sans exposer les listes d'emails).
- Nouveaux composants : [components/DemandeBudgetStatusBadge.tsx](components/DemandeBudgetStatusBadge.tsx) (pattern `_META` repris de `FactureStatusBadge`), [components/InvoiceMultiCombobox.tsx](components/InvoiceMultiCombobox.tsx) (sélection multiple de proformas, sur le modèle de `FournisseurCombobox`), [components/DemandeBudgetModal.tsx](components/DemandeBudgetModal.tsx) (dialogue de création : lignes de dépense dynamiques, mode de paiement, type de dépense, bon de commande et proformas associés, documents).
- Nouvelles pages : [app/(main)/finance/demandes-budget/page.tsx](app/(main)/finance/demandes-budget/page.tsx) (liste, cartes de synthèse, filtres) et [app/(main)/finance/demandes-budget/[id]/page.tsx](app/(main)/finance/demandes-budget/[id]/page.tsx) (détail complet + actions Valider/Rejeter pour l'admin, formulaire « Marquer comme payée » pour le comptable).
- [components/app-sidebar.tsx](components/app-sidebar.tsx) : lien « Demandes de Budget » ajouté dans la section Finance.
- `.env` : ajout de `BUDGET_ADMIN_EMAILS`, `BUDGET_COMPTABLE_EMAILS` (valeurs de départ à ajuster avec les vraies adresses) et `NEXT_PUBLIC_APP_URL` (liens cliquables dans les emails).
- **Nouvelle règle de versioning appliquée à partir de maintenant** : bump semver (`npm version patch|minor|major --no-git-tag-version`) à chaque modification livrée, en plus de l'entrée `HISTORIQUE.md` — patch pour un correctif, minor pour une nouvelle fonctionnalité, major réservé à une refonte. `package.json` passé de `1.0.0` à `1.1.0` pour cette feature.

**Erreurs rencontrées & solutions**
Voir l'incident de dérive de schéma ci-dessus.

**À tester / points d'attention**
- Vérifier/ajuster les vraies adresses dans `BUDGET_ADMIN_EMAILS`/`BUDGET_COMPTABLE_EMAILS` avant usage réel.
- Test manuel à faire par l'utilisateur (pas d'accès navigateur côté assistant) : soumettre une demande avec 2 lignes + une proforma associée → vérifier l'email reçu par les adresses admin → valider → vérifier l'email reçu par le comptable → marquer comme payée avec une preuve → vérifier l'affichage complet sur la page de détail.
- Le merge de la branche `feature/usersgestion` (système de rôles complet) dans cette branche est envisagé comme prochaine étape séparée, à la demande de l'utilisateur — non fait dans cette intervention pour ne pas mélanger avec le travail en cours.

---

## 2026-09-13 — Page dédiée « Bons de Commande Fournisseurs »

**Demande / Contexte**
Les bons de commande fournisseur (modèles `CommandeFournisseur`/`LigneCommandeFournisseur`, déjà en base) n'étaient accessibles que depuis un onglet noyé dans la fiche d'un fournisseur (`/fournisseur/[id]?tab=commandes`), avec un formulaire de création en pleine page qui remplaçait l'onglet. Demande de traiter les bons de commande « comme les proforma » : une page dédiée listant tous les bons (tous fournisseurs confondus), accessible directement depuis la navbar, avec un lien direct, et une création via un dialogue (choix du fournisseur, ajout des produits, montant affiché).

**Modifications apportées**
- [app/api/fournisseurs/commandes/route.ts](app/api/fournisseurs/commandes/route.ts) : `GET` rendu plus général — `fournisseurId` devient optionnel (retourne tous les bons de commande si absent, filtrable aussi par `statut`), et inclut désormais la relation `fournisseur` pour l'affichage du nom d'entreprise dans la liste globale. Le comportement existant (filtré par fournisseur) reste identique pour l'onglet déjà en place dans la fiche fournisseur.
- [components/CommandeFournisseurModal.tsx](components/CommandeFournisseurModal.tsx) (nouveau) : dialogue de création reprenant la logique de [components/fournisseurs/NewCommandeForm.tsx](components/fournisseurs/NewCommandeForm.tsx) (choix produit, dimensions si m², quantité, prix, calcul du total) mais avec en plus un sélecteur de fournisseur (`FournisseurCombobox`) en tête — le catalogue produits se recharge dynamiquement selon le fournisseur choisi.
- [app/(main)/fournisseur/commandes/page.tsx](app/(main)/fournisseur/commandes/page.tsx) (nouveau) : page dédiée listant tous les bons de commande, sur le même gabarit que [app/(main)/fournisseur/factures/page.tsx](app/(main)/fournisseur/factures/page.tsx) — cartes de synthèse (total commandé, validées/livrées, brouillons), filtres (fournisseur, statut), tableau avec changement de statut en ligne (Select → `PATCH /api/fournisseurs/commandes/[commandeId]`), et bouton « Voir » vers la page de détail déjà existante (`/fournisseur/[id]/commandes/[commandeId]`, avec génération PDF).
- [components/app-sidebar.tsx](components/app-sidebar.tsx) : ajout du lien « Bons de Commande » (`/fournisseur/commandes`) dans la section Fournisseurs de la navbar, à côté de « Liste Fournisseurs » et « Liste Factures ».

L'onglet « Bons de Commande » existant dans la fiche fournisseur (`FournisseurCommandes.tsx`/`NewCommandeForm.tsx`) n'a pas été touché — il reste utilisable comme vue filtrée sur un seul fournisseur, en plus de la nouvelle page globale (même schéma de coexistence que pour les factures fournisseurs).

**Erreurs rencontrées & solutions**
Aucune.

**À tester / points d'attention**
- Test manuel à faire par l'utilisateur : ouvrir `/fournisseur/commandes`, créer un bon de commande via le dialogue (choisir un fournisseur, ajouter un produit de son catalogue), vérifier qu'il apparaît dans la liste avec le bon montant, changer son statut en ligne, puis cliquer sur « Voir » pour confirmer que la page de détail (et le PDF) fonctionnent toujours.

---

## 2026-09-10 — Export Excel de la liste des factures proforma

**Demande / Contexte**
Demande d'un bouton d'export Excel sur la page `/facture` pour obtenir une "base de données" des factures proforma, respectant le filtre actif (carte de statut cliquée, recherche, client, dates/année) : objet, client, produits avec quantités, montant TTC, payé/reste à payer, et toute autre colonne utile.

**Modifications apportées**
- [app/(main)/facture/page.tsx](app/(main)/facture/page.tsx) : ajout d'un bouton « Exporter (Excel) » dans l'en-tête de la page, à côté du réglage de visibilité des cartes. `handleExport()` exporte `filteredFactures` (la même liste déjà filtrée par carte de statut + recherche + filtres avancés que celle affichée dans le tableau) via `xlsx` (déjà une dépendance du projet, même pattern que [app/(main)/journal-caisse/export/page.tsx](app/(main)/journal-caisse/export/page.tsx)). Colonnes exportées : Numéro, Date, Client, Objet, Produits (désignation + quantité), Gestionnaire(s), Devise, Total HT, TVA, Total TTC, Payé, Reste à payer, Statut (libellé lisible réutilisé depuis `FACTURE_STATUS_META` de [components/FactureStatusBadge.tsx](components/FactureStatusBadge.tsx)). Nom de fichier dynamique incluant le filtre de statut actif et la date du jour.

**Erreurs rencontrées & solutions**
Aucune.

**À tester / points d'attention**
- Vérifier visuellement dans le navigateur : cliquer sur une carte (ex. « Brouillon »), exporter, et confirmer que seules les factures de ce statut apparaissent dans le fichier généré (pas d'accès navigateur côté assistant pour ce test).

---

## 2026-08-18 — Historique des Flux (fiche facture) : libellés tronqués + carte scrollable

**Demande / Contexte**
Avec la nouvelle possibilité d'enregistrer des dépenses liées à une proforma depuis l'API d'intégration, le nombre d'entrées dans la carte "Historique des Flux" de la fiche facture (`/facture/[id]`) va augmenter significativement. Demande : tronquer les libellés/références trop longs pour qu'ils ne prennent pas trop de place, et rendre la carte scrollable plutôt que de s'étendre indéfiniment en hauteur.

**Modifications apportées**
- `app/(main)/facture/[id]/page.tsx` :
  - La colonne "Libellé / Référence" du tableau limite désormais sa largeur (`max-w-[220px]`) et tronque le texte (`truncate`) ; le texte complet reste consultable via une `Tooltip` au survol (composants déjà importés dans ce fichier, réutilisés tels quels).
  - Le tableau est enveloppé dans un conteneur `max-h-[420px] overflow-y-auto` avec en-tête collant (`sticky top-0`), même pattern que celui déjà utilisé sur `/journal-caisse` — la carte garde une hauteur fixe et défile au lieu de pousser le reste de la page vers le bas quand les opérations se multiplient.
  - Colonnes Date/Encaissement/Décaissement passées en `whitespace-nowrap` pour ne pas se compresser bizarrement à côté de la colonne libellé qui, elle, peut se tronquer.

**Erreurs rencontrées & solutions**
Aucune. `tsc --noEmit` et `next lint` passent sans erreur.

**À tester / points d'attention**
- Vérifier visuellement avec une facture ayant beaucoup de paiements/dépenses (ou un libellé très long, ex: une dépense liée via l'API avec numéro de proforma + client + objet) que le texte est bien tronqué avec `...` et que le survol affiche le texte complet.
- Vérifier que le défilement de la carte n'empêche pas de cliquer sur les boutons d'action (upload de preuve, lien vers pièce jointe) dans les dernières lignes visibles.

---

## 2026-08-18 — Correctif : libellé "Dépense liée" générique au lieu du vrai libellé sur la fiche facture

**Demande / Contexte**
Une dépense créée via l'API d'intégration avec `proformaId` apparaissait dans l'historique des paiements de la fiche facture avec le texte générique "Dépense liée", alors que le journal de caisse affichait bien le libellé enrichi (numéro de proforma, client, objet) pour la même opération. Question posée : est-ce à gérer côté camptrack ou côté cette app ? Réponse : côté cette app — camptrack n'a rien à faire de plus, l'API d'intégration ne renseignait tout simplement pas le bon champ.

**Cause réelle**
`app/(main)/facture/[id]/page.tsx:640` affiche `p.reference` (avec un texte générique en repli si vide). La route `app/api/integration/cash-journal/depenses/route.ts` construisait bien un libellé enrichi et le passait à `recordDepensePaiement`, mais seulement via le paramètre `libelle`, qui n'alimente que `CashJournal.libelle` (voir `lib/paiements.ts`) — jamais `Paiement.reference`. Résultat : `Paiement.reference` restait `null`, d'où le texte générique côté fiche facture.

**Modifications apportées**
- `app/api/integration/cash-journal/depenses/route.ts` : le libellé enrichi (`"${libelle} (Proforma ${numero} de ${client} pour ${objet})"`) est désormais passé aussi en `reference` à `recordDepensePaiement`, en plus de `libelle` — les deux affichages (journal de caisse et historique des paiements de la facture) montrent maintenant exactement le même texte.
- `docs/API-INTEGRATION.md` : précision ajoutée dans la section 6 sur le fait que `CashJournal.libelle` et `Paiement.reference` reçoivent le même texte enrichi.

**Erreurs rencontrées & solutions**
Aucune erreur de code — bug de champ manquant, corrigé directement. `tsc --noEmit` et `next lint` passent sans erreur.

**À tester / points d'attention**
- Les dépenses déjà créées avant ce correctif gardent leur `Paiement.reference` vide (donc toujours "Dépense liée" pour l'historique) — seules les nouvelles dépenses créées via l'API après ce correctif afficheront le bon libellé. Pas de script de rattrapage prévu pour les anciennes entrées (à faire manuellement si besoin).
- Vérifier sur une nouvelle dépense de test que le texte affiché sur la fiche facture correspond bien à celui du journal de caisse.

---

## 2026-08-18 — Dépense liée à une proforma via l'API d'intégration (Paiement + CashJournal en une fois)

**Demande / Contexte**
Dans l'app campagnes, une `Campagne` peut être liée à une proforma via `id_proforma`. Demande : quand une dépense est enregistrée côté campagnes pour une campagne liée à une proforma, elle doit être enregistrée ici comme un `Paiement` (type `DEPENSE`) rattaché à la facture, **avec une seule écriture** dans le journal de caisse (pas de double comptage) — sinon, dépense de caisse simple comme avant. Décisions validées : un seul endpoint intelligent (extension de `POST /api/integration/cash-journal/depenses` plutôt qu'un endpoint séparé) ; repli silencieux (pas d'erreur) si `proformaId` est fourni mais ne correspond à aucune facture.

**Modifications apportées**
- `lib/paiements.ts` (nouveau) : `recordDepensePaiement(tx, { invoiceId, cashRegisterId, montant, libelle, date_operation, methode?, reference?, notes? })` — factorise la logique déjà existante de `app/api/factures/[id]/paiements/route.ts` (branche `type === "DEPENSE"`) : vérifie le solde de la caisse, crée **une** entrée `CashJournal`, met à jour `CashRegister.balance`, crée le `Paiement` (type `DEPENSE`) lié via `cashJournalEntryId`. Ne touche pas à `Invoice.resteAPayer`/`statut` (seul le type `PAIEMENT` les modifie, logique inchangée).
- `app/api/factures/[id]/paiements/route.ts` : la transaction du `POST` utilise désormais `recordDepensePaiement` pour la branche `DEPENSE` (comportement inchangé, y compris `methode`/`reference`/`notes` qui étaient bien pris en compte côté UI interne — vérifié dans `app/(main)/facture/[id]/page.tsx` avant de les intégrer à la fonction extraite, pour ne pas les perdre). La branche `PAIEMENT` (qui met à jour `resteAPayer`/`statut`) n'a pas été touchée.
- `app/api/integration/cash-journal/depenses/route.ts` : ajout du champ optionnel `proformaId` au schéma zod. Si fourni et qu'une facture correspondante existe, la dépense passe par `recordDepensePaiement` (libellé enrichi avec numéro de proforma / client / objet) au lieu de `recordCashMovement` ; sinon repli sur le comportement existant. **Changement de forme de la réponse `201`** : passée de l'entrée `CashJournal` à plat à `{ cashJournalEntry }` (ou `{ paiement, cashJournalEntry }` si liée à une facture), pour rester cohérente entre les deux cas — à prendre en compte si l'app campagnes avait déjà commencé une intégration sur l'ancienne forme.
- `docs/API-INTEGRATION.md` : section 6 mise à jour (champ `proformaId`, comportement détaillé selon les 3 cas, nouvelle forme de réponse, exemple `curl` avec lien facture, checklist mise à jour).

**Erreurs rencontrées & solutions**
Repéré avant de coder : la logique `DEPENSE` interne gérait aussi `methode`/`reference`/`notes` (utilisés par le formulaire de dépense sur la fiche facture) — la première version de `recordDepensePaiement` les omettait. Corrigé en ajoutant ces trois champs optionnels à la fonction avant de brancher la route interne dessus, pour ne pas régresser le formulaire existant. `tsc --noEmit` et `next lint` passent sans erreur sur les 3 fichiers modifiés/créés.

**À tester / points d'attention**
- Tester `POST /cash-journal/depenses` avec un `proformaId` valide et vérifier que la dépense apparaît bien dans l'historique des paiements de la fiche facture (`/facture/[id]`), avec le bon montant et le bon lien vers l'entrée de caisse.
- Tester avec un montant supérieur au solde de la caisse et `proformaId` valide → doit être bloqué en `400` avec un message explicite (comportement hérité du formulaire interne).
- Tester avec un `proformaId` invalide/inexistant → doit se rabattre silencieusement sur une dépense de caisse simple.
- Vérifier côté app campagnes que le changement de forme de la réponse (`{ cashJournalEntry }` au lieu de l'objet à plat) est bien pris en compte si une intégration avait déjà commencé.

---

## 2026-08-04 — Documentation des API publiques d'intégration

**Demande / Contexte**
Demande d'expliquer comment utiliser l'API de dépense de caisse côté app appelante sans erreur, et d'en profiter pour documenter dans un fichier Markdown **toutes** les routes `/api/integration/*` déjà réalisées (pas seulement la nouvelle), avec un titre clair par route et sa date de réalisation — les dates réelles ont été reprises du journal de ce fichier plutôt qu'une date par défaut, puisqu'elles y étaient déjà consignées.

**Modifications apportées**
- `docs/API-INTEGRATION.md` (nouveau) : documentation complète des 6 routes d'intégration existantes — authentification (header `Authorization: Bearer <INTEGRATION_API_KEY>`, codes d'erreur communs), puis pour chacune : méthode/chemin, date de réalisation, description, paramètres/corps attendu, exemple de réponse, codes d'erreur, exemple `curl`.
  - `GET /api/integration/proformas` — 19 juillet 2026
  - `GET /api/integration/proformas/:id` — 19 juillet 2026
  - `GET /api/integration/clients` — 19 juillet 2026
  - `POST /api/integration/clients/find-or-create` — 19 juillet 2026
  - `GET /api/integration/cash-journal/registers` — 4 août 2026
  - `POST /api/integration/cash-journal/depenses` — 4 août 2026, avec une checklist dédiée côté app appelante (variables d'environnement à définir, ordre d'appel liste-caisses puis création, types de données attendus, gestion des codes retour) pour éviter les erreurs les plus courantes (ex: envoyer `montant` en chaîne au lieu d'un nombre).
- `README.md` : ajout d'un lien vers `docs/API-INTEGRATION.md`, à côté du lien déjà existant vers `MEMO.md`.

**Erreurs rencontrées & solutions**
Aucune — travail de documentation uniquement, aucun code applicatif modifié.

**À tester / points d'attention**
- À chaque nouvelle route `/api/integration/*` ajoutée à l'avenir, penser à ajouter une section à `docs/API-INTEGRATION.md` (le fichier le rappelle en en-tête).
- Vérifier côté app Campagnes que la checklist (variables d'env, ordre des appels, types JSON) permet bien une intégration sans erreur au premier essai.

---

## 2026-08-04 — API d'intégration publique : enregistrer une dépense de caisse

**Demande / Contexte**
L'app sœur (campagnes) doit pouvoir enregistrer une dépense dans le journal de caisse de cette app, avec un utilisateur qui choisit lui-même la caisse concernée côté app appelante. Objectif : exposer ça via le mécanisme d'intégration serveur-à-serveur déjà en place (`app/api/integration/*`, clé `INTEGRATION_API_KEY`).

**Modifications apportées**
- `lib/cashJournal.ts` (nouveau) : `recordCashMovement(tx, { cashRegisterId, type, montant, libelle, date_operation, isApportDeCaisse })` — factorise le calcul de solde (chaîne de soldes par caisse) et la création d'entrée `CashJournal` + mise à jour de `CashRegister.balance`, précédemment dupliqué en ligne dans la route interne.
- `app/api/cash-journal/route.ts` : le bloc `RECETTE`/`DEPENSE` du `POST` utilise désormais `recordCashMovement` au lieu de sa propre logique inline — comportement inchangé, juste dé-dupliqué.
- `app/api/integration/cash-journal/registers/route.ts` (nouveau) : `GET`, protégé par `verifyIntegrationKey`, liste les caisses visibles (`view: true`) — `{ id, name }` — pour peupler un sélecteur côté app appelante.
- `app/api/integration/cash-journal/depenses/route.ts` (nouveau) : `POST`, protégé par `verifyIntegrationKey`, corps validé par `zod` (`cashRegisterId`, `montant`, `libelle`, `date_operation` optionnelle). Le type est fixé à `DEPENSE` côté serveur — l'app appelante ne peut pas créer de `RECETTE`/`TRANSFERT` via cet endpoint. Vérifie que la caisse existe et est visible avant d'enregistrer.

**Erreurs rencontrées & solutions**
Aucune. `tsc --noEmit` et `next lint` passent sans erreur sur les 4 fichiers.

**À tester / points d'attention**
- Tester avec `curl` (comme les autres routes `/api/integration/*`) : sans clé → 401 ; `GET registers` → liste des caisses visibles ; `POST depenses` avec un `cashRegisterId` valide → entrée créée, `CashRegister.balance` mis à jour, solde cohérent avec la route interne pour un montant identique.
- Tester avec un `cashRegisterId` inexistant ou masqué → doit renvoyer `404`, pas une erreur Prisma brute.
- Documenter l'URL (`/api/integration/cash-journal/registers` et `/depenses`) et rappeler que c'est la même `INTEGRATION_API_KEY` déjà partagée avec l'app campagnes pour les autres endpoints.

---

## 2026-08-04 — Cadre de signature "Bon pour accord" dans le PDF de la proforma

**Demande / Contexte**
Demande d'ajouter un cadre assez grand pour la signature du client sur le PDF de la proforma, avec les mentions Nom & Prénom, Signature et "Bon pour accord", positionné tout en bas à droite de la page, au même niveau que la légende des abréviations (HT/TTC/TVA/NB) en bas à gauche.

**Modifications apportées**
- `lib/pdf.ts` : la section légende, auparavant seule en bas de page, est maintenant accompagnée d'un cadre rectangulaire (`page.drawRectangle`, 220×110) dessiné à droite au même niveau vertical (`blockTopY`, capturé avant de dessiner l'un ou l'autre). Le cadre contient le titre "BON POUR ACCORD" centré en gras/couleur primaire, puis les lignes "Nom & Prénom :" et "Signature :" avec l'espace vide nécessaire en dessous pour signer à la main. La hauteur du bloc bas de page (`checkNewPage`) est calculée sur le plus grand des deux éléments (légende ou cadre) pour que ni l'un ni l'autre ne soit coupé par un saut de page.

**Erreurs rencontrées & solutions**
Aucune. `tsc --noEmit` et `next lint` passent sans erreur.

**À tester / points d'attention**
- Générer un PDF et vérifier que le cadre de signature s'affiche entièrement en bas à droite, aligné avec la légende à gauche, sans chevaucher le footer (numéro de page).
- Vérifier sur une facture avec beaucoup de lignes de produits (déclenchant plusieurs pages) que le cadre reste bien sur la dernière page sans être coupé.

---

## 2026-08-04 — Ajustement du bloc CGV du PDF : alignement à gauche + rubriques en gras

**Demande / Contexte**
Retour immédiat sur le bloc "Conditions d'exécution & paiement" ajouté juste avant : préférence pour un alignement à gauche plutôt qu'à droite, avec les rubriques ("Paiement", "Validations", "Cadre") mises en gras au début de chaque paragraphe.

**Modifications apportées**
- `lib/pdf.ts` : ajout de deux fonctions utilitaires `wrapLabeledParagraph` (découpe un paragraphe "Label : texte" en lignes, en réservant la largeur du label en gras uniquement sur la première ligne) et `drawLabeledParagraph` (dessine le label en gras suivi du reste en police normale sur la même ligne, alignées à gauche). Le bloc CGV utilise désormais ces fonctions au lieu de `getLines`/`drawText` avec alignement `'right'` — chaque paragraphe commence par son libellé en gras ("Paiement :", "Validations :", "Cadre :") suivi du texte normal, le tout aligné à gauche comme le reste du document (au lieu d'aligné à droite).

**Erreurs rencontrées & solutions**
Aucune. `tsc --noEmit` et `next lint` passent sans erreur.

**À tester / points d'attention**
- Générer un PDF avec un paragraphe "Paiement" assez long pour vérifier que le retour à la ligne fonctionne bien (la 1ère ligne est plus courte à cause du label en gras, les suivantes utilisent toute la largeur).

---

## 2026-08-04 — Bloc "Conditions d'exécution & paiement" dans le PDF de la proforma

**Demande / Contexte**
La direction a fourni un nouveau texte de conditions générales de validation à faire figurer sur les devis (acompte obligatoire, délais de validation, solde, adhésion au Contrat Cadre), avec deux formulations selon que l'acompte demandé est partiel ou correspond à un règlement intégral (100%) à la commande. Objectif : remplacer le message d'acompte basique actuellement généré dans le PDF de la proforma par ce nouveau bloc, avec les montants calculés automatiquement et affiché aligné à droite.

**Modifications apportées**
- `lib/pdf.ts` : le bloc conditionnel (affiché uniquement si `paymentConditionPercentage > 0`, comportement inchangé) remplace l'ancien texte *"NB : Un acompte de X%..."* par un bloc **"CONDITIONS D'EXÉCUTION & PAIEMENT"** avec 3 paragraphes (Paiement / Validations / Cadre) :
  - Si `paymentConditionPercentage` = 100 → formulation "Règlement intégral (100 % à la commande...)" avec délai de validation à 3 jours ouvrés.
  - Si entre 1 et 99 → formulation "Acompte de X % ... — Solde de (100-X) % ..." avec le vrai pourcentage saisi (pas figé à 50%), délai de validation à 5 jours ouvrés.
  - Les montants d'acompte et de solde sont calculés sur le **total TTC** (`Math.round(totalTTC * pct / 100)`), pour rester cohérents avec le montant "Acompte requis" déjà affiché sur la fiche facture à l'écran (`app/(main)/facture/[id]/page.tsx`), qui utilise la même base.
  - Tout le bloc (titre + paragraphes wrappés) est dessiné aligné à droite (`x = width - pageMargin`, `align: 'right'`), avec estimation de hauteur et appel à `checkNewPage` pour éviter une coupure au milieu d'une page.

**Erreurs rencontrées & solutions**
Aucune. `tsc --noEmit` et `next lint` passent sans erreur sur `lib/pdf.ts`.

**À tester / points d'attention**
- Générer un PDF avec un acompte à 50% et un à 100% pour vérifier visuellement les deux formulations et les montants calculés.
- Générer un PDF sans acompte (0% ou non renseigné) pour confirmer qu'aucun bloc ne s'affiche (comportement inchangé).
- Le texte légal fourni par la direction mentionnait un calcul sur le montant HT ; le TTC a été retenu à la place pour cohérence avec l'existant (décision validée avec l'utilisateur) — à signaler si le service juridique tient spécifiquement au HT.

---

## 2026-08-04 — Ajout de client en dialogue + compaction des cartes de statut sur la fiche client

**Demande / Contexte**
Demande de faire ouvrir le formulaire d'ajout de client en dialogue depuis la liste des clients (au lieu d'une page dédiée), et de retravailler les cartes de statistiques de statut de facture en haut de la fiche client (`/client/[id]`), jugées trop grandes verticalement et pas assez UI/UX.

**Modifications apportées**
- `components/ClientModal.tsx` (nouveau) : reprend le même formulaire et le même appel `POST /api/clients` que l'ancienne page `/client/new`, dans un `Dialog`.
- `app/(main)/client/page.tsx` : le bouton "Nouveau Client" ouvre désormais le dialogue ; `fetchClients` extrait en fonction réutilisable (`useCallback`) et rappelée en `onSuccess` pour rafraîchir la liste après création.
- Suppression de `app/(main)/client/new/page.tsx` et de son entrée "Nouveau Client" dans `components/app-sidebar.tsx` (devenue obsolète).
- `app/(main)/client/[id]/page.tsx` : `StatCard` (cartes de statut de facture) redessiné en version compacte façon SaaS neutre, cohérente avec la refonte déjà faite sur `/facture` et `/fournisseur/factures` — icône dans un badge gris neutre, libellé en petites majuscules, montant + compteur sur une seule ligne, détail Payé/Reste (facture "Payer") réduit à une ligne verte/rouge sans labels. Suppression du `scale-105` sur l'état actif (remplacé par un anneau primaire discret) et de la prop `colorClass` devenue inutile. Grille passée à `grid-cols-[repeat(auto-fit,minmax(130px,1fr))]` (comme sur `/facture`) pour occuper toute la largeur sans réserver une hauteur excessive.

**Erreurs rencontrées & solutions**
Aucune. `tsc --noEmit` et `next lint` passent sans erreur sur tous les fichiers créés/modifiés.

**À tester / points d'attention**
- Vérifier que la création d'un client depuis le dialogue rafraîchit bien la liste et que la recherche continue de fonctionner sur les nouveaux clients.
- Vérifier visuellement la hauteur des 7 cartes de statut sur `/client/[id]` avec un client ayant des factures dans plusieurs statuts.

---

## 2026-08-01 — Mise en place du versionnage sémantique (SemVer) de l'application

**Demande / Contexte**
Demande de commencer à versionner officiellement l'application (norme MAJOR.MINOR.PATCH), avec la documentation de la convention dans le README et l'historique, et une variable unique à modifier pour afficher/utiliser la version partout dans l'app.

**Modifications apportées**
- `package.json` : champ `"version"` passé de `0.1.0` à `1.0.0` — l'app étant déjà en production et utilisée quotidiennement par l'équipe finance, on démarre à `1.0.0` plutôt qu'à `0.0.1` (qui signifierait conventionnellement "version instable, tout peut changer").
- `next.config.ts` : ajout de `env: { NEXT_PUBLIC_APP_VERSION: packageJson.version }` — injecte la version de `package.json` comme variable d'environnement publique au build, disponible aussi bien côté serveur que dans les composants client (`"use client"`).
- `lib/version.ts` (nouveau) : exporte `APP_VERSION` (lit `NEXT_PUBLIC_APP_VERSION`, avec fallback `"0.0.0"`) — point d'import unique à utiliser partout où la version doit être affichée, plutôt que de coder la version en dur à plusieurs endroits.
- `components/app-sidebar.tsx` : le pied de page de la sidebar affiche désormais `V{APP_VERSION}` dynamiquement (au lieu d'un texte codé en dur), avec l'année courante calculée (`new Date().getFullYear()`) au lieu d'une année fixe.
- `README.md` : nouvelle section « 🏷️ Versioning » expliquant la convention SemVer (quand incrémenter MAJOR/MINOR/PATCH), la source unique de vérité (`package.json` → `APP_VERSION`), et comment publier une nouvelle version (`npm version patch|minor|major`).

**Erreurs rencontrées & solutions**
Aucune. `tsc --noEmit` et `next lint` passent sans erreur sur les fichiers modifiés.

**À tester / points d'attention**
- Après un `npm run build`, vérifier que le pied de page de la sidebar affiche bien `V1.0.0`.
- Pour toute future version affichée ailleurs dans l'app (ex: page Paramètres, écran de connexion), importer `APP_VERSION` depuis `lib/version.ts` plutôt que de recoder la valeur.
- Pour publier la prochaine version : `npm version patch` (ou minor/major selon la nature du changement), puis ajouter une entrée dans ce fichier décrivant ce qui a changé.

---
## 2026-08-01 — Dashboard & test build 

**Demande / Contexte**
Demande de création d'un dashboard pour afficher les statistiques de l'entreprise.

**Modifications apportées**
- Création du fichier `app/api/dashboard/route.ts` pour récupérer les données.
- Création du fichier `app/dashboard/page.tsx` pour afficher les données.

**Erreurs rencontrées & solutions**
Aucune erreur rencontrée.

**À tester / points d'attention**
- Tester le dashboard pour s'assurer que les données sont correctes.
```

## 2026-07-31 — Messages d'erreur explicites pour les échecs d'écriture disque (upload pièce jointe fournisseur)

**Demande / Contexte**
Sur le VPS de production, l'upload de pièce jointe sur une facture fournisseur renvoie « Erreur interne du serveur », alors que l'upload de documents sur d'autres fonctionnalités (proforma) n'a jamais posé ce problème. Impossible de diagnostiquer sans accès aux logs serveur.

**Analyse**
Le code d'upload des factures fournisseurs (`lib/uploadFactureFournisseur.ts`, `mkdir` + `writeFile` dans `public/Upload/FactureFournisseur`) est fonctionnellement identique aux autres routes d'upload du projet (`app/api/factures/[id]/upload/route.ts` écrit dans `public/Upload/Bon|Facture/...` de la même façon). Aucune différence de code trouvée qui expliquerait un échec spécifique à ce dossier. L'hypothèse la plus probable est donc **environnementale** : le dossier `public/Upload/FactureFournisseur` sur le VPS a pu être créé (ou son parent `public/Upload`) avec des droits/propriétaire différents des autres sous-dossiers déjà utilisés (`Bon`, `Facture`, `CashJournal`), empêchant le process Node d'y créer le fichier (`EACCES`), ou un souci d'espace disque (`ENOSPC`). Le message générique masquait jusqu'ici la vraie cause.

**Modifications apportées**
- `lib/uploadFactureFournisseur.ts` : nouvelle fonction `describeFsError(error)` qui traduit les codes d'erreur `fs` Node (`EACCES`/`EPERM`, `ENOSPC`, `EROFS`, `ENOENT`) en message explicite.
- `app/api/factures-fournisseurs/route.ts` et `app/api/factures-fournisseurs/[id]/route.ts` : les blocs `catch` vérifient désormais `describeFsError(error)` avant de retomber sur le message générique — si l'échec vient bien du système de fichiers, le message reçu par le frontend (et affiché dans le toast) sera explicite (ex: « Le serveur n'a pas la permission d'écrire le fichier... »).

**Erreurs rencontrées & solutions**
Aucune erreur de code. `tsc --noEmit` et `next lint` passent sans erreur. Le vrai correctif dépend de la cause réelle sur le VPS, qui reste à confirmer (voir points d'attention).

**À tester / points d'attention**
- Reproduire l'upload qui échoue sur le VPS et noter le message exact désormais affiché : il devrait indiquer clairement si c'est un problème de permissions, d'espace disque, ou de dossier introuvable.
- Sur le VPS, vérifier via SSH : `ls -la public/Upload` (propriétaire/droits de `Upload` et de `FactureFournisseur` s'il existe déjà) et comparer avec l'utilisateur sous lequel tourne le process Next.js (`whoami` dans le contexte du service PM2/systemd/Docker). Si `FactureFournisseur` n'existe pas encore et que `Upload` n'autorise pas la création de sous-dossiers par cet utilisateur, c'est la cause la plus probable.
- Vérifier aussi l'espace disque disponible (`df -h`) et les logs du process (`pm2 logs` / `journalctl` / `docker logs`) pour voir la stack trace complète déjà loguée par `console.error`.

---

## 2026-07-31 — Refonte UI/UX de la sidebar + loader de navigation par lien

**Demande / Contexte**
Demande de revoir un peu l'UI/UX de la sidebar, et surtout d'ajouter un indicateur de chargement quand une section/lien est cliqué, le temps que la page se charge — pour éviter que l'utilisateur pense que rien ne se passe.

**Modifications apportées**
- `components/app-sidebar.tsx` :
  - Nouveau composant interne `NavLink` (+ `NavLinkIcon`) factorisant les 5 blocs de rendu de liens quasi identiques (Proforma, Client, Fournisseurs, Commercial, Finance, Paramètres) qui dupliquaient le même JSX.
  - Loader de navigation : `NavLinkIcon` utilise le hook `useLinkStatus()` de `next/link` (Next.js 15) pour détecter qu'un lien précis est en cours de navigation, et remplace son icône par un spinner (`Loader2` animé) pendant ce temps — retour visuel immédiat au clic, sans dépendance externe.
  - Style des liens revu : l'ancien `hover:bg-pink-600 hover:text-pink-600` (bug — texte rose sur fond rose, donc invisible au survol) remplacé par un survol gris neutre ; l'état actif, auparavant un bloc noir plein (`bg-gray-900 text-white`) assez brut, devient un fond teinté primaire discret (`bg-primary/10 text-primary font-medium`), plus cohérent avec le reste de l'admin.
  - En-tête de la sidebar simplifié : suppression d'un `<div>` vide résiduel, ajout d'un petit badge "RP" à côté du titre pour ancrer visuellement la marque, texte compacté.
  - Le lien "Paramètres" du footer (qui n'utilisait pas le même style que les autres liens, avec un chevron statique sans fonction) utilise maintenant le même composant `NavLink` que le reste du menu.

**Erreurs rencontrées & solutions**
Aucune. `tsc --noEmit` et `next lint` passent sans erreur.

**À tester / points d'attention**
- Vérifier que le spinner apparaît bien uniquement sur le lien cliqué (pas sur tous les liens en même temps) et disparaît une fois la nouvelle page affichée.
- `useLinkStatus` reflète la navigation Next.js (chargement du module de la route + transition) : pour les pages qui font ensuite leur propre fetch de données côté client (pattern `useEffect` + `fetch` déjà en place ailleurs dans l'app), le loader de la sidebar peut disparaître avant la fin du chargement des données de la page — c'est un comportement normal, les tableaux affichent déjà leur propre état "Chargement..." pour cette partie.

---

## 2026-07-31 — Pastille animée sur les badges de statut des proformas

**Demande / Contexte**
Les badges de statut du tableau `/facture` n'avaient pas la pastille clignotante (`animate-ping`) déjà utilisée sur les factures fournisseurs pour signaler les statuts encore "actifs"/modifiables.

**Modifications apportées**
- `app/(main)/facture/page.tsx` : `FactureStatusBadge` reçoit désormais `animate={!["Solde", "Annuler", "Archiver"].includes(facture.statut)}` — la pastille clignote pour les statuts encore en circulation (Brouillon, Envoyée, Validée, Payer), et reste fixe pour les statuts terminaux (Soldée, Annulée, Archivée), par cohérence avec le comportement déjà en place sur `/fournisseur/factures` (clignote = encore modifiable, fixe = verrouillé/terminé).

**Erreurs rencontrées & solutions**
Aucune. `tsc --noEmit` et `next lint` passent sans erreur.

**À tester / points d'attention**
- Vérifier visuellement que la pastille clignote bien pour Brouillon/Envoyée/Validée/Payer et reste statique pour Soldée/Annulée/Archivée.

---

## 2026-07-31 — Cartes de statut des proformas : design neutre façon SaaS

**Demande / Contexte**
Les cartes de statut en haut de `/facture` avaient chacune une bordure supérieure colorée différente (bleu, orange, violet, vert, etc.) et un badge d'icône teinté assorti. L'utilisateur trouvait ce rendu trop chargé/pas assez "SaaS" et souhaitait quelque chose de plus simple mais toujours soigné pour un dashboard d'administration.

**Modifications apportées**
- `app/(main)/facture/page.tsx` :
  - Suppression des couleurs par carte (`bg`/`text`/`border` par statut) dans la définition de `cards` — retour à une simple liste `{ label, value, stats, icon }`.
  - Design de carte neutre façon SaaS : bordure fine neutre (`border-border/60`) avec léger survol (`hover:shadow-sm`), icône dans un badge gris neutre (`bg-muted text-muted-foreground`) au lieu d'un badge coloré par statut, libellé en petites majuscules discrètes (`uppercase tracking-wide text-muted-foreground`), montant en semi-gras avec chiffres alignés (`tabular-nums`).
  - L'état actif (carte sélectionnée) se distingue désormais par une bordure/anneau teinté primaire discret (`border-primary/50 ring-1 ring-primary/30 bg-primary/[0.03]`) plutôt que par la couleur de la carte elle-même.
  - Le détail Payé/Reste (carte "Paiement en cours") garde des couleurs vert/rouge (`emerald-600`/`rose-500`) car ce sont des données financières significatives (positif/négatif), pas une simple décoration.

**Erreurs rencontrées & solutions**
Aucune. `tsc --noEmit` et `next lint` passent sans erreur.

**À tester / points d'attention**
- Vérifier visuellement le rendu en clair/sombre si le thème sombre est un jour activé (les classes `border-border`/`bg-muted` sont déjà theme-aware via les tokens shadcn/ui existants).

---

## 2026-07-31 — Badge "Payé X%" avec pourcentage calculé pour le statut Payer

**Demande / Contexte**
Suite à l'entrée précédente, le libellé "Paiement en cours" a été jugé trop générique. Demande finale : afficher "Payé" suivi du pourcentage déjà réglé sur la facture (ex: "Payé 50%"), calculé à partir du montant payé et du reste à payer, plutôt qu'un renommage textuel simple ("Partielle"/"Encours" proposés mais non retenus).

**Modifications apportées**
- `components/FactureStatusBadge.tsx` : le libellé par défaut du statut `Payer` passe à `Payé` ; nouvelle prop `percentPaid` qui, si fournie pour ce statut, remplace le libellé par `Payé {percentPaid}%`.
- `app/(main)/facture/page.tsx` : calcul du pourcentage payé par facture (`(totalTTC - resteAPayer) / totalTTC * 100`, arrondi) et transmission via `percentPaid` à `FactureStatusBadge`, uniquement pour les factures au statut `Payer`.

**Erreurs rencontrées & solutions**
Aucune. `tsc --noEmit` et `next lint` passent sans erreur.

**À tester / points d'attention**
- Vérifier avec une facture partiellement payée que le badge affiche bien le bon pourcentage (ex: 300 000 payés sur 600 000 TTC → "Payé 50%").
- Le libellé de la carte de statistique en haut de page reste "Paiement en cours" (elle agrège plusieurs factures à des pourcentages différents, un pourcentage unique n'aurait pas de sens) — à voir si un renommage est aussi souhaité là, en cohérence avec le badge du tableau.

---

## 2026-07-31 — Badges de statut à pastille colorée sur le tableau des proformas

**Demande / Contexte**
Demande d'appliquer sur le tableau des proformas (`/facture`) le même style de badge à pastille colorée que celui déjà en place sur les factures fournisseurs, avec des couleurs différenciées par statut : Validée en bleu, Paiement en cours en jaune, Soldée en vert, Envoyée en orange, et des couleurs distinctes pour les statuts restants (Brouillon, Annulée, Archivée).

**Modifications apportées**
- `components/FactureStatusBadge.tsx` (nouveau) : composant dédié aux statuts de proforma (`StatusFacture` : Brouillon, Envoyer, Valider, Payer, Solde, Annuler, Archiver), sur le même principe visuel que `FactureFournisseurStatusBadge` (pastille + fond teinté + texte de la même teinte) mais avec sa propre palette : Brouillon gris, Envoyée orange, Validée bleu, Paiement en cours ambre/jaune, Soldée vert, Annulée rouge, Archivée slate. Pastille statique par défaut (`animate=false`) car ce tableau n'a pas de sélecteur de statut interactif comme celui des factures fournisseurs.
- `app/(main)/facture/page.tsx` : remplacement du `Badge` à variantes (`envoyer`/`valider`/`payer`/`annuler`/`archiver`/`success`/`brouillon`) et de son enchaînement de conditions pour le libellé, par un simple `<FactureStatusBadge status={facture.statut} />` qui gère à la fois la couleur et le libellé.

**Erreurs rencontrées & solutions**
Aucune. `tsc --noEmit` et `next lint` passent sans erreur sur les fichiers créés/modifiés.

**À tester / points d'attention**
- Vérifier visuellement que les 7 statuts s'affichent avec des couleurs bien distinctes et lisibles dans le tableau.
- Les variantes `Badge` (`envoyer`, `valider`, etc.) restent définies dans `components/ui/badge.tsx` et potentiellement utilisées ailleurs (ex: `facture/[id]/page.tsx`) — non touchées par ce changement, seul l'usage sur la liste `/facture` a été remplacé.

---

## 2026-07-31 — Cartes de statut des proformas étirées sur toute la largeur

**Demande / Contexte**
Après la première refonte compacte des cartes de statut sur `/facture`, la grille utilisait des paliers de colonnes fixes (`grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8`). Avec 6 cartes visibles par défaut sur un écran large (`xl`, 8 colonnes prévues), les cartes restaient regroupées à gauche et laissaient un vide à droite au lieu de remplir toute la largeur.

**Modifications apportées**
- `app/(main)/facture/page.tsx` : grille remplacée par `grid-cols-[repeat(auto-fit,minmax(140px,1fr))]`. Le nombre de colonnes s'adapte automatiquement à la largeur disponible et au nombre de cartes visibles, et chaque carte s'étire (`1fr`) pour occuper toute la largeur de la ligne, quel que soit le nombre de cartes affichées (via le panneau de visibilité) ou la largeur d'écran.

**Erreurs rencontrées & solutions**
Aucune. `next lint` passe sans erreur sur le fichier modifié.

**À tester / points d'attention**
- Vérifier à différentes largeurs d'écran (mobile, tablette, grand écran) et avec différents nombres de cartes visibles (via le bouton « œil ») que les cartes remplissent bien toute la largeur sans espace vide à droite.

---

## 2026-07-31 — Refonte UI/UX des cartes de statut sur la liste des proformas + libellé « Paiement en cours »

**Demande / Contexte**
Sur `/facture` (liste des proformas émises), les cartes de statistiques par statut (Brouillon, Envoyée, Validée, etc.) prenaient trop de place et passaient sur deux lignes. Demande : les rendre plus petites pour qu'elles tiennent sur une seule ligne sur toute la largeur (ou se répartissent proprement sinon), avec un design plus « dashboard moderne d'administration ». Demande aussi de renommer le statut « En cours de paiement » (trop long) en « Paiement en cours » dans le tableau des factures.

**Modifications apportées**
- `app/(main)/facture/page.tsx` :
  - Grille des cartes passée de `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` (2 lignes pour 6 cartes) à `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8` (tient sur une seule ligne dès la largeur `lg` pour les 6 cartes visibles par défaut, et jusqu'à `xl` si les 8 sont affichées).
  - Cartes réduites et redessinées façon mini stat-card de dashboard admin : `CardHeader`/`CardTitle` remplacés par un en-tête compact dans `CardContent` (padding réduit `p-3`, icône dans un badge coloré `bg-*/text-*`, bordure supérieure colorée `border-t-4` par statut au lieu d'un simple `border-2` générique), texte réduit (`text-[11px]`/`text-sm`), et le détail Payé/Reste (pour la carte « Paiement en cours ») compacté sur une seule ligne avec icônes `✓`/`↳` au lieu de deux lignes avec libellés « Payé:  »/« Reste: ».
  - Carte et statut « En cours de paiement » renommés en « Paiement en cours » (label de la carte, entrée `visibleCardLabels` par défaut, et libellé affiché dans le badge de statut du tableau) pour rester cohérents entre la carte et le tableau.

**Erreurs rencontrées & solutions**
Avertissement ESLint temporaire (`CardHeader`/`CardTitle` importés mais plus utilisés après la refonte des cartes) → imports nettoyés. `tsc --noEmit` et `next lint` passent sans erreur.

**À tester / points d'attention**
- Vérifier visuellement sur différentes largeurs d'écran que les cartes restent lisibles une fois réduites (surtout sur mobile en `grid-cols-2`).
- Si de nouvelles cartes de statut sont ajoutées plus tard, penser à leur donner un triplet `bg`/`text`/`border` cohérent avec les autres (palette actuelle : bleu, gris, orange, violet, vert, émeraude, rouge, slate).

---

## 2026-07-31 — Filtres de la liste des factures fournisseurs : panneau repliable + période consolidée

**Demande / Contexte**
La section « Filtres » de `/fournisseur/factures` était toujours visible, prenait de la place, et contenait deux contrôles redondants (un menu « Année » et un calendrier de plage de dates, désactivé de façon peu claire dès qu'une année était sélectionnée) ainsi qu'un bouton « Rechercher » qui ne servait à rien. Demande : la rendre repliable, enlever les champs inutiles et proposer un vrai sélecteur de période.

**Modifications apportées**
- `app/(main)/fournisseur/factures/page.tsx` :
  - Panneau de filtres masqué par défaut, ouvert/fermé via un bouton « Filtres » (icône + chevron animé) affichant un badge du nombre de filtres actifs.
  - Remplacement des filtres `year` + `dateRange` séparés par un unique sélecteur `period` (`current` / `previous` / `all` / `custom`) ; le calendrier de plage ne s'affiche que si `custom` est choisi.
  - Suppression du bouton « Rechercher » (la liste se recharge déjà automatiquement à chaque changement de filtre via le `useEffect` existant sur `fetchFactures`).
  - Ajout de « chips » de filtres actifs (fournisseur, statut, période) affichées en permanence sous le bouton, chacune retirable individuellement, plus un bouton « Tout effacer ».
- `app/api/factures-fournisseurs/route.ts` : le paramètre `year=ALL` désactive désormais complètement le filtre de date (nécessaire pour l'option « Toutes les périodes », qui n'existait pas avant — la route retombait toujours sur l'année en cours par défaut en l'absence de `year`/`startDate`/`endDate`).

**Erreurs rencontrées & solutions**
Avertissements ESLint temporaires (`CardHeader`/`CardTitle` importés mais plus utilisés après suppression du titre « Filtres » statique) → imports nettoyés. `tsc --noEmit` et `next lint` passent sans erreur.

**À tester / points d'attention**
- Vérifier que le choix « Toutes les périodes » renvoie bien des factures de toutes les années (avant ce correctif, l'API imposait toujours l'année en cours par défaut).
- Vérifier que retirer une chip individuelle remet bien le filtre correspondant à sa valeur par défaut (période → « Cette année »).

---

## 2026-07-31 — Statuts en pastille colorée + verrouillage étendu aux factures Annulées

**Demande / Contexte**
Sur les tableaux de factures fournisseurs, il fallait : griser/verrouiller aussi les factures au statut Annulée (comme Payée), retravailler visuellement le sélecteur de statut, harmoniser les couleurs avec une pastille clignotante par statut (vert=Payée, jaune=En attente, rouge=Annulée), et uniformiser la taille des boutons d'action.

**Modifications apportées**
- `components/FactureFournisseurStatusBadge.tsx` (nouveau) : composant `FactureFournisseurStatusBadge` (pastille pleine + point coloré, `animate-ping` optionnel) et `StatusDot`, réutilisés partout où un statut de facture fournisseur est affiché.
- `components/AttachmentPreviewButton.tsx` : bouton d'aperçu passé en icône seule (`variant="outline" size="icon"`) avec `Tooltip`, pour matcher la taille du bouton d'édition ; état « aucun fichier » aussi restylé en icône avec tooltip au lieu d'un badge texte.
- `components/FactureFournisseurModal.tsx` + `app/api/factures-fournisseurs/[id]/route.ts` : la règle de verrouillage (déjà en place pour « Payée ») s'applique désormais aussi au statut « Annulée » — seule l'ajout d'une pièce jointe manquante reste possible ; message du bandeau d'avertissement adapté dynamiquement (« payée » vs « annulée »).
- `app/(main)/fournisseur/factures/page.tsx` et `app/(main)/fournisseur/[id]/page.tsx` : le sélecteur de statut n'est affiché (cliquable) que pour les factures « En attente » ; pour Payée/Annulée, affichage d'un badge non interactif. Les options du menu déroulant de statut affichent désormais le point coloré correspondant. Bouton d'édition uniformisé en `variant="outline" size="icon"` avec tooltip (« Modifier »/« Voir » selon le verrouillage).

**Erreurs rencontrées & solutions**
Aucune. `tsc --noEmit` et `next lint` passent sans erreur sur tous les fichiers modifiés.

**À tester / points d'attention**
- Vérifier visuellement que le point clignotant n'apparaît que pour le statut « En attente » (modifiable) et reste fixe pour Payée/Annulée (verrouillé), conformément au choix de design fait.
- Confirmer avec l'utilisateur si le verrouillage d'une facture Annulée doit aussi bloquer l'ajout d'une pièce jointe (actuellement autorisé, comme pour Payée) ou non.

---

## 2026-07-31 — Édition des factures fournisseurs (verrouillée si Payée) + aperçu de pièce jointe en modale

**Demande / Contexte**
Il n'existait aucun moyen de modifier une facture fournisseur après création (ni même d'ajouter la pièce jointe si elle avait été oubliée à la création). Demande : permettre l'édition complète tant que la facture n'est pas « Payée » (auquel cas elle doit être verrouillée, seul l'ajout d'une pièce jointe manquante restant possible), et améliorer l'affichage/consultation du fichier joint.

**Modifications apportées**
- `lib/uploadFactureFournisseur.ts` (nouveau) : helper `saveFactureFournisseurPieceJointe` partagé entre la création et l'édition (déduplique la logique d'écriture disque déjà présente dans la route POST).
- `app/api/factures-fournisseurs/[id]/route.ts` : réécriture du `PATCH` pour accepter soit un corps JSON `{ status }` (changement rapide de statut, utilisé par les sélecteurs inline), soit un `FormData` complet (référence, montant, date, fournisseur, statut, pièce jointe). Règle métier : si la facture existante est verrouillée, toute modification est refusée (`403`) sauf l'ajout d'une pièce jointe absente.
- `components/FactureFournisseurModal.tsx` : ajout du mode édition (`initialData`) — préremplissage du formulaire, champs désactivés/affichés en lecture seule et bandeau d'avertissement quand la facture est verrouillée, appel `PATCH` au lieu de `POST` en édition.
- `components/AttachmentPreviewButton.tsx` (nouveau) : bouton « Voir » ouvrant une modale avec aperçu direct (image affichée, PDF en `iframe`, message générique sinon) + lien de téléchargement/ouverture en nouvel onglet ; badge dédié si aucune pièce jointe.
- `app/(main)/fournisseur/factures/page.tsx` et `app/(main)/fournisseur/[id]/page.tsx` : ajout d'un bouton « Modifier » (crayon) par ligne ouvrant la modale d'édition, et remplacement du lien « Voir PJ » par `AttachmentPreviewButton`.

**Erreurs rencontrées & solutions**
Aucune. `tsc --noEmit` et `next lint` passent sans erreur sur tous les fichiers créés/modifiés.

**À tester / points d'attention**
- Sur `/fournisseur/[id]`, la modale d'édition ne reçoit que le fournisseur courant (pas la liste complète) : changer le fournisseur d'une facture n'est donc pas proposé depuis cette page — seulement depuis `/fournisseur/factures`. À signaler si un besoin de réassignation depuis la fiche fournisseur apparaît.
- Vérifier qu'une tentative de modification d'une facture verrouillée renvoie bien un message clair (409/403) plutôt qu'une erreur générique.

---

## 2026-07-31 — Ajout de facture fournisseur en dialogue (au lieu d'une page dédiée)

**Demande / Contexte**
Le formulaire d'ajout de facture fournisseur était une page séparée (`/fournisseur/factures/new`). Demande : l'ouvrir en dialogue directement depuis la liste des factures, sans changer la logique ni l'API d'ajout, et recharger le tableau après création.

**Modifications apportées**
- `components/FactureFournisseurModal.tsx` (nouveau à l'origine, puis étendu en mode édition dans une entrée suivante) : reprend exactement le même formulaire et le même appel `POST /api/factures-fournisseurs` (FormData) que l'ancienne page, dans un `Dialog`.
- `app/(main)/fournisseur/factures/page.tsx` : bouton « Ajouter une facture » ouvrant le dialogue ; `onSuccess={fetchFactures}` recharge le tableau après création (la dernière facture apparaît immédiatement, triée par date décroissante comme le fait déjà l'API).
- Suppression de `app/(main)/fournisseur/factures/new/page.tsx` et de son entrée « Ajouter Facture » dans `components/app-sidebar.tsx` (devenue obsolète).

**Erreurs rencontrées & solutions**
Aucune. `tsc --noEmit` et `next lint` passent sans erreur.

**À tester / points d'attention**
- Aucun particulier — fonctionnalité vérifiée par lecture de code, logique/API inchangées par rapport à l'ancienne page.

---

## 2026-07-31 — Messages d'erreur explicites à la création d'une facture fournisseur

**Demande / Contexte**
Depuis un bon moment, l'enregistrement d'une facture fournisseur échouait « en ligne » avec le message générique « Erreur interne du serveur », sans que l'utilisateur (ni le développeur) puisse en identifier la cause réelle.

**Cause réelle**
`FactureFournisseur.reference` est `@unique` dans `prisma/schema.prisma`. Toute tentative de création avec une référence déjà utilisée en base (double soumission du formulaire, référence ressaisie) fait échouer `prisma.factureFournisseur.create` avec une erreur de contrainte unique (`P2002`), mais le `catch` générique de la route renvoyait toujours le même message flou, quelle que soit la cause réelle (référence dupliquée, fournisseur introuvable, montant/date invalides...).

**Modifications apportées**
- `app/api/factures-fournisseurs/route.ts` :
  - Vérification explicite de l'unicité de la référence avant insertion (`prisma.factureFournisseur.findUnique`) → réponse `409` avec message clair si la référence existe déjà.
  - Validation du `montant` (`parseFloat` + `Number.isNaN`) et de la `date` (`Number.isNaN(dateValue.getTime())`) avant insertion → réponse `400` explicite plutôt qu'une erreur Prisma silencieuse.
  - Dans le `catch`, distinction des erreurs Prisma connues via `Prisma.PrismaClientKnownRequestError` : `P2002` (référence dupliquée) et `P2003` (fournisseur introuvable) renvoient désormais un message dédié ; seules les erreurs vraiment inattendues gardent le message générique 500.

**Erreurs rencontrées & solutions**
Aucune erreur de code. `tsc --noEmit` et `next lint` passent sans erreur sur le fichier modifié.

**À tester / points d'attention**
- Reproduire volontairement une référence dupliquée depuis le formulaire (`app/(main)/fournisseur/factures/new/page.tsx`) et vérifier que le toast affiche désormais le message précis (409) au lieu de « Erreur interne du serveur ».
- Point non résolu par ce correctif : la route (comme les autres routes d'upload du projet — `cash-journal/upload`, `factures/upload`, etc.) écrit les pièces jointes directement sur le disque via `fs.writeFile` dans `public/Upload/...`. Si l'hébergement de production utilise un système de fichiers en lecture seule ou éphémère (ex: plateforme serverless), l'upload de fichier échouera toujours avec une 500 même sans référence dupliquée — à vérifier selon la plateforme de déploiement réelle, et migrer vers un stockage externe (S3, Vercel Blob, etc.) si c'est le cas.

---
<!-- 
## 2026-07-31 — Refonte visuelle du Dashboard (centrage des caisses + design admin)

**Demande / Contexte**
Sur la nouvelle page `/dashboard`, les cartes de solde par caisse s'affichaient collées à gauche (grille avec colonnes vides quand il y a peu de caisses). Demande de les centrer et de retravailler le design général pour qu'il ressemble davantage à un tableau de bord d'administration.

**Modifications apportées**
- `app/(main)/dashboard/page.tsx` :
  - Les cartes « Solde par caisse » passent d'une grille (`grid`) à `flex flex-wrap justify-center`, ce qui les centre quel que soit leur nombre.
  - Contenu regroupé en sections `<section>` avec icône + titre (« Solde par caisse », « Vue d'ensemble »), séparées du header par une bordure.
  - En-tête simplifié (titre + sous-titre) avec un badge « Données en temps réel » (pastille verte animée) à la place du texte brut précédent.
  - `StatCard` enrichi d'un accent de couleur en bordure supérieure (`border-t-*`) assorti à la couleur de son icône, plus un effet de survol (`hover:shadow-md`), pour distinguer visuellement les 3 indicateurs clés.
  - Cartes de caisse avec effet de survol (légère élévation) et icône dans un badge arrondi.

**Erreurs rencontrées & solutions**
Un avertissement ESLint temporaire (`TrendingUp` importé mais plus utilisé après la refonte du header) → import supprimé. `tsc --noEmit` et `next lint` passent sans erreur.

**À tester / points d'attention**
- Vérifier visuellement le rendu avec un nombre variable de caisses visibles (1, 2, 5+) pour confirmer que le centrage reste cohérent à toutes les largeurs d'écran.

--- -->

## 2026-07-31 — Création de la page Dashboard (KPI dirigeante)

**Demande / Contexte**
Le menu « Tableau de bors » avait été ajouté dans `components/app-sidebar.tsx` (array `dashboard`) mais pointait vers une page vide. Objectif : construire un vrai tableau de bord temps réel pour la dirigeante avec les chiffres clés de l'activité : commandes totales, encaissements (avec reste à encaisser, ventilé par année de facture), et solde de caisse, avec des graphes de comparaison.

**Modifications apportées**
- `app/api/dashboard/route.ts` (nouveau) : agrège les factures aux statuts « commandés » (`Valider`, `Payer`, `Solde`) groupées par année de `dateCreation` — total commandé (`totalTTC`), total encaissé (`totalTTC - resteAPayer`), reste à encaisser, et nombre de clients distincts ayant encore un impayé par année. Calcule aussi le solde total des caisses visibles (`CashRegister.view = true`) et l'évolution mensuelle Recettes/Dépenses de l'année en cours (même logique que `app/api/statistiques/route.ts`).
- `app/(main)/dashboard/page.tsx` (nouveau) : page cliente (`fetch` + `useState`/`useEffect`, même pattern que `statistiques/page.tsx`) avec 3 cartes KPI (Commande Totale, Encaissement Total + reste à encaisser, Solde Caisse Total) et 3 graphiques `recharts` : Commandé/Encaissé/Reste par année, Clients avec impayé par année, Évolution mensuelle de la caisse.
- `components/app-sidebar.tsx` : le lien Dashboard n'est affiché que pour `role === "org:admin"`, en haut de la sidebar (avant la section Proforma).

**Erreurs rencontrées & solutions**
Aucune. `tsc --noEmit` et `next lint` passent sans erreur sur les fichiers créés/modifiés.

**À tester / points d'attention**
- Vérifier que les montants affichés sur `/dashboard` sont cohérents avec ceux de `/statistiques` et `/journal-caisse` (mêmes sources de données).
- Se connecter avec un rôle non-admin pour confirmer que le lien Dashboard n'apparaît pas dans la sidebar.
- Il n'existe pas de statut « en cours de paiement » distinct dans `StatusFacture` : une facture partiellement payée reste au statut `Payer` avec `resteAPayer > 0`, ce qui est déjà couvert par le regroupement actuel.

---

## 2026-07-20 — Correction définitive du mapping des champs camptrack (bug réel identifié)

**Demande / Contexte**
En conditions réelles (une vraie campagne liée à une proforma), la carte « Campagne(s) liée(s) » affichait un nom et un numéro vides, une date invalide (« Invalid Date »), et la console listait un warning React « Each child in a list should have a unique key prop » sur `FactureDetailPage`.

**Cause réelle**
Vérification faite directement dans le code source de l'app camptrack (`c:\Users\HP\Desktop\Dev\camptrack-reseaupub\app\api\integration\campagnes\route.ts`, disponible en local) : sa route `/api/integration/campagnes` interroge la table `Campagne` avec les vrais noms de colonnes (`id_campagne`, `nom_campagne`, etc.) **mais remappe déjà la réponse JSON en camelCase** (`{ id, nom, numero, statut, dateDebut, dateFin }`) avant de la renvoyer. Les entrées précédentes du journal (2026-07-19 et plus tôt le 2026-07-20) avaient supposé à tort que camptrack renvoyait les noms de colonnes bruts, et `lib/camptrackClient.ts` + la route interne remappaient donc `c.id_campagne`, `c.nom_campagne`, etc. — des champs qui n'existent pas dans la réponse réelle, donc toujours `undefined`. Ce bug n'avait jamais été détecté car le seul test précédent portait sur une liste vide (aucune campagne liée), qui masque un mauvais nom de champ.

**Modifications apportées**
- `lib/camptrackClient.ts` : le type `CamptrackCampagne` reflète maintenant la vraie forme de la réponse camptrack (`id`, `nom`, `numero`, `statut`, `dateDebut`, `dateFin`, en camelCase).
- `app/api/factures/[id]/campagnes/route.ts` : suppression du remapping devenu inutile (et faux) — la route renvoie désormais directement le résultat de `getCampagnesForProforma` (`return NextResponse.json(campagnes)`), sans transformation, puisque camptrack fournit déjà le format attendu par le frontend.
- `app/(main)/facture/[id]/page.tsx` : aucun changement nécessaire, le type `Campagne` utilisait déjà ce format camelCase.

**Erreurs rencontrées & solutions**
Le warning « missing key prop » était un symptôme du même bug : `c.id` étant toujours `undefined` (mauvais nom de champ), toutes les clés de la liste `campagnes.map(...)` étaient identiques/`undefined`. Résolu par la correction du mapping ci-dessus (plus besoin de changement sur le `key={c.id}` lui-même). `tsc --noEmit` et `eslint` passent sans erreur.

**À tester / points d'attention**
- Recharger la fiche proforma ayant une vraie campagne liée côté camptrack et vérifier que le nom, le numéro et les dates s'affichent correctement, et que le warning React a disparu.
- Retenir la leçon pour la suite : toujours valider un contrat d'API d'intégration avec un jeu de données non vide des deux côtés avant de le considérer comme testé.

---

## 2026-07-20 — Normalisation des champs camptrack au niveau de la route interne

**Demande / Contexte**
Plutôt que d'exposer les noms de champs bruts de camptrack (`id_campagne`, `nom_campagne`, `numero_campagne`, `status`, `date_debut`, `date_fin`) jusqu'au frontend, la conversion doit se faire dans la route interne `app/api/factures/[id]/campagnes/route.ts`, qui renvoie des champs propres en camelCase au frontend.

**Modifications apportées**
- `app/api/factures/[id]/campagnes/route.ts` : la réponse mappe désormais chaque campagne camptrack vers `{ id, nom, numero, statut, dateDebut, dateFin }` avant de la renvoyer.
- `app/(main)/facture/[id]/page.tsx` : le type `Campagne` et l'affichage dans la carte « Campagne(s) liée(s) » repassent sur les noms de champs camelCase (`id`, `nom`, `numero`, `statut`, `dateDebut`, `dateFin`), cohérents avec la nouvelle réponse de la route interne.
- `lib/camptrackClient.ts` reste inchangé (garde les noms de champs bruts `id_campagne`/`nom_campagne`/etc., qui reflètent fidèlement le contrat réel de l'API camptrack) — la conversion se fait uniquement à la frontière entre la route interne et le frontend.

**Erreurs rencontrées & solutions**
Aucune. `tsc --noEmit` et `eslint` passent sans erreur.

**À tester / points d'attention**
- Toujours pas re-testé avec camptrack réellement démarré (arrêté au moment de ce changement) — à revérifier dès que possible avec une vraie campagne liée.

---

## 2026-07-20 — Correction des champs camptrack + affichage du numéro de campagne

**Demande / Contexte**
Les noms de champs réels renvoyés par l'API camptrack (`id_campagne`, `nom_campagne`, `numero_campagne`, `status`, `date_debut`, `date_fin`) sont différents de ceux supposés initialement (`id`, `nom`, `statut`, `dateDebut`, `dateFin`). Il fallait corriger le typage en conséquence et ajouter l'affichage du numéro de campagne sur la fiche proforma.

**Modifications apportées**
- `lib/camptrackClient.ts` : le type `CamptrackCampagne` utilise désormais les vrais noms de champs (`id_campagne`, `nom_campagne`, `numero_campagne`, `status`, `date_debut`, `date_fin`).
- `app/(main)/facture/[id]/page.tsx` : le type `Campagne` est aligné sur les mêmes champs. La carte « Campagne(s) liée(s) » affiche maintenant le numéro de campagne (`numero_campagne`) dans un badge à côté du nom, en plus des dates de début/fin.

**Erreurs rencontrées & solutions**
Aucune erreur de code, juste un décalage de nommage entre l'hypothèse initiale et le vrai contrat d'API — corrigé après clarification de l'utilisateur. `tsc --noEmit` et `eslint` passent sans erreur.

**À tester / points d'attention**
- Round-trip non re-testé avec camptrack (serveur local arrêté au moment de ce changement) — à revérifier visuellement dès que camptrack est relancé en local ou en prod, avec une vraie campagne liée à une proforma.

---

## 2026-07-19 — Affichage des campagnes liées sur la fiche proforma

**Demande / Contexte**
Sur la page de détail d'une proforma, afficher le nom ainsi que les dates de début/fin de la ou des campagne(s) camptrack liées à cette proforma (utilise la route `/api/factures/[id]/campagnes` codée juste avant).

**Modifications apportées**
- `app/(main)/facture/[id]/page.tsx` :
  - Nouveau type `Campagne` (`id`, `nom`, `statut`, `dateDebut`, `dateFin`).
  - Nouveau state `campagnes`, alimenté en parallèle des autres fetchs dans `fetchFacture` via `GET /api/factures/${id}/campagnes`.
  - Nouvelle carte « Campagne(s) liée(s) » dans la colonne de droite (entre la carte Client et le Récapitulatif Financier) : liste le nom de chaque campagne + `dateDebut → dateFin` formatées en `fr-FR`. Affiche un message « Aucune campagne liée pour le moment. » si la liste est vide.

**Erreurs rencontrées & solutions**
Aucune. `tsc --noEmit` et `eslint` passent sans erreur.

**À tester / points d'attention**
- Non vérifié visuellement dans le navigateur (la page est protégée par Clerk, pas de session dispo depuis cet environnement) — à vérifier manuellement que la carte s'affiche bien et que les dates sont lisibles, une fois une vraie campagne liée à une proforma côté camptrack.
- Comme `getCampagnesForProforma` ne lève jamais d'exception (retourne toujours `[]` en cas de souci), la carte affichera simplement « Aucune campagne liée » si camptrack est injoignable — pas d'erreur visible pour l'utilisateur, mais pas d'indication non plus qu'il y a un problème de configuration. À surveiller si besoin de diagnostiquer plus tard.

---

## 2026-07-19 — Appel sortant proforma → camptrack (récupération des campagnes liées)

**Demande / Contexte**
Suite à l'intégration entrante (camptrack → proforma), camptrack a mis en place le sens inverse : une route `GET /api/integration/campagnes?id_proforma=xxx` chez camptrack qui retourne les campagnes liées à une proforma donnée, protégée par une clé (`CAMPTRACK_INTEGRATION_API_KEY`, même pattern que `lib/integrationAuth.ts` côté proforma). Il fallait coder, côté proforma, l'appel sortant vers cette route.

**Modifications apportées**
- `.env` : ajout de `CAMPTRACK_INTEGRATION_API_KEY` (fournie par camptrack, à garder identique des deux côtés) et `CAMPTRACK_API_URL=http://localhost:3001` (URL locale de camptrack ; à changer pour l'URL HTTPS de prod le moment venu).
- `lib/camptrackClient.ts` (nouveau) : `getCampagnesForProforma(proformaId)` — appelle `GET ${CAMPTRACK_API_URL}/api/integration/campagnes?id_proforma=...` avec le header `Authorization: Bearer ${CAMPTRACK_INTEGRATION_API_KEY}`. Ne lève jamais d'exception : retourne un tableau vide et logue l'erreur si camptrack est injoignable, mal configuré ou répond en erreur (pour ne jamais faire planter une page/API de cette app à cause d'un souci côté camptrack).
- `app/api/factures/[id]/campagnes/route.ts` (nouveau) : `GET` — vérifie que la facture existe puis délègue à `getCampagnesForProforma`. Protégé par Clerk comme le reste de `/api/factures/*` (route destinée à être appelée par le frontend authentifié, pas par camptrack).

**Erreurs rencontrées & solutions**
- Premier test avec un script `tsx` placé dans `/tmp` (hors du repo) → `Cannot find module '../lib/camptrackClient'` car le chemin relatif ne pointait plus vers le bon dossier. Solution : placer le script de test temporaire dans `scripts/` (à l'intérieur du repo) le temps du test, puis le supprimer.
- Aucune erreur de code sinon. `tsc --noEmit` et `eslint` passent sans erreur.

**À tester / points d'attention**
- Testé en conditions réelles avec camptrack démarré en local sur le port 3001 : sans clé → 401 ; avec la clé → 200 `[]` (liste vide, cohérent car aucune campagne n'est encore liée à la proforma de test utilisée). Le round-trip complet (lecture des env vars + appel HTTP + parsing JSON) fonctionne.
- `app/api/factures/[id]/campagnes/route.ts` n'est pas encore branché dans l'UI (page facture) — à faire quand on voudra afficher les campagnes liées sur la fiche proforma.
- Penser à mettre à jour `CAMPTRACK_API_URL` avec la vraie URL HTTPS de camptrack lors du déploiement en production (actuellement `http://localhost:3001`, valable seulement en local).

---

## 2026-07-19 — API d'intégration serveur-à-serveur avec l'app « Campagnes »

**Demande / Contexte**
Le projet a une app sœur pour la gestion des campagnes publicitaires. Objectif : que cette app campagnes puisse (1) lister/consulter les proformas validées de cette app-ci pour les associer à une campagne, et (2) rechercher/créer un client en réutilisant la même base client plutôt que d'en dupliquer une. Les deux apps sont sur le même VPS avec chacune une URL HTTPS ; à terme elles pourraient être sur des serveurs séparés — la solution devait fonctionner dans les deux cas.

**Modifications apportées**
- `lib/integrationAuth.ts` (nouveau) : helper `verifyIntegrationKey(request)` qui vérifie le header `Authorization: Bearer <clé>` contre `process.env.INTEGRATION_API_KEY`, avec comparaison à temps constant (`crypto.timingSafeEqual`) pour éviter les attaques par timing. Retourne une `NextResponse` 401/500 ou `null` si OK.
- `middleware.ts` : les routes `/api/integration/*` sont ajoutées à `isPublicRoute` (exemptées de `auth.protect()` de Clerk, qui est pensé pour des sessions utilisateur navigateur, pas pour des appels serveur-à-serveur). La sécurité de ces routes est assurée par `verifyIntegrationKey` appelé au début de chaque handler.
- `app/api/integration/proformas/route.ts` (nouveau) : `GET` — liste les proformas, filtrées par `?statut=` (défaut `Valider`), avec client, gestionnaires et produits (désignation, quantité, prix, durée).
- `app/api/integration/proformas/[id]/route.ts` (nouveau) : `GET` — détail d'une proforma précise par id (404 si absente).
- `app/api/integration/clients/route.ts` (nouveau) : `GET ?search=` — recherche de clients existants (nom ou email, insensible à la casse).
- `app/api/integration/clients/find-or-create/route.ts` (nouveau) : `POST` — upsert d'un client sur le champ unique `nom` (schéma Prisma `Client.nom @unique`). Retourne toujours l'`id` canonique du client, à stocker côté app campagnes.
- `.env` : ajout de `INTEGRATION_API_KEY` (générée avec `openssl rand -hex 32`), à dupliquer à l'identique dans le `.env` de l'app campagnes. Jamais commitée (`.env*` est dans `.gitignore`).

**Erreurs rencontrées & solutions**
- Aucune erreur de code. `tsc --noEmit` et `eslint` passent sans erreur sur tous les nouveaux fichiers.
- ⚠️ Point d'attention découvert en testant en local : le `.env` local a `DATABASE_URL` pointé sur la base **PROD** (la section DEV DATABASE est commentée). Le test de l'endpoint `find-or-create` a donc créé un vrai client de test (« TEST INTEGRATION CLIENT ») dans la base de production. Il a été supprimé immédiatement après vérification via un script Prisma ponctuel. **Il faudrait décommenter/configurer une vraie base DEV pour les tests locaux futurs**, afin d'éviter d'écrire accidentellement dans la prod.

**À tester / points d'attention**
- Tests manuels effectués en local avec `curl` : sans clé → 401 ; mauvaise clé → 401 ; bonne clé → 200 avec les données attendues sur les 4 endpoints (`proformas`, `proformas/:id` non testé explicitement mais suit le même pattern, `clients?search=`, `clients/find-or-create`).
- Reste à faire côté app campagnes : appeler ces endpoints avec la même `INTEGRATION_API_KEY` en header `Authorization: Bearer`, stocker `proformaId`/`numero` + `clientId` comme références (pas de duplication des données financières).
- Si les deux apps finissent sur des serveurs séparés : rien à changer dans le code, seulement possibilité d'ajouter en plus une restriction par IP publique au niveau Nginx en couche supplémentaire (optionnel).
- Réfléchir à une politique de rotation de `INTEGRATION_API_KEY` si elle venait à fuiter.

---

## 2026-07-17 — Masquage des caisses non visibles dans le formulaire de paiement

**Demande / Contexte**
Dans la page de détail d'une facture (`app/(main)/facture/[id]/page.tsx`), le formulaire d'ajout d'un paiement/dépense affiche la liste des caisses d'enregistrement. Il fallait masquer les caisses dont le champ `view` (modèle `CashRegister` dans `prisma/schema.prisma`, `view Boolean @default(true)`) est à `false`.

**Modifications apportées**
- `app/(main)/facture/[id]/page.tsx` :
  - Le type du state `cashRegisters` inclut désormais `view?: boolean`.
  - À la récupération des caisses (`fetchFacture`), la sélection par défaut (`selectedCashRegisterId`) choisit la première caisse **visible** (`view !== false`) plutôt que la première de la liste brute.
  - Le `<Select>` de « Caisse de destination » dans le dialogue de paiement filtre désormais `cashRegisters` sur `r.view !== false` avant de générer les options.

**Erreurs rencontrées & solutions**
Aucune. L'API `/api/cash-journal` (utilisée aussi par le journal de caisse pour la gestion des caisses) n'a pas été modifiée — le filtrage est fait côté client, uniquement pour ce formulaire de paiement, afin de ne pas casser l'affichage des caisses masquées ailleurs (ex: page d'administration des caisses).

**À tester / points d'attention**
- Créer/marquer une caisse avec `view = false` en base et vérifier qu'elle n'apparaît plus dans le sélecteur de caisse du formulaire de paiement, mais reste utilisable ailleurs si nécessaire.
- Le filtrage est uniquement côté UI : l'API `/api/factures/[id]/paiements` accepte toujours un `cashRegisterId` de caisse masquée si on le forge manuellement (non bloqué côté serveur).

---

## 2026-07-16 — Ajout du nom du client dans l'objet de l'email de validation

**Demande / Contexte**
L'objet de l'email de notification de validation devait aussi contenir le nom du client, en plus du numéro de proforma et de l'objet de la facture.

**Modifications apportées**
- `lib/email/proformaValidation.ts` : l'objet de l'email passe de `Proforma {numero} validée - {objet}` à `{client.nom} - Commande validée - Proforma {numero} - {objet}`.
- (Modification utilisateur constatée sur le même fichier) : la liste `NOTIFICATION_RECIPIENTS` a été réduite temporairement à `informatique@reseaupub.com` et `reseaupub01@gmail.com` (les autres adresses sont commentées, pas supprimées).

**Erreurs rencontrées & solutions**
Aucune. `tsc --noEmit` passe sans erreur.

**À tester / points d'attention**
- Vérifier l'affichage de l'objet dans un client mail réel avec un nom de client contenant des caractères spéciaux.

---

## 2026-07-16 — Notification email interne à la validation d'une proforma

**Demande / Contexte**
Lorsqu'une proforma passe au statut « Validée », l'équipe (plusieurs personnes en copie) doit recevoir un email récapitulatif : numéro de la proforma (PRO...), informations du client (nom, email, téléphone, adresse), produits proposés avec quantités (sans les prix), dans un format soigné et lisible.

**Modifications apportées**
- `lib/email/proformaValidation.ts` (nouveau) : construit et envoie l'email de notification interne via `nodemailer` (même config SMTP que l'envoi de facture au client : `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`). Contenu : numéro de proforma, objet, date de validation, infos client, gestionnaire assigné, tableau des produits (désignation + quantité + durée, **sans prix**). Destinataires en copie (CC) : `info@reseaupub.com`, `finance@reseaupub.com`, `karamatouagbetou@reseaupub.com`, `commercial@reseaupub.com`, `partenariat@reseaupub.com`, `informatique@reseaupub.com`, `reseaupub01@gmail.com`.
- `app/api/factures/[id]/route.ts` : dans `updateFacture`, on capture le statut de la facture *avant* modification (`previousStatut`). Après la transaction Prisma, si le statut demandé est `Valider`, que le statut précédent n'était **pas** déjà `Valider`, et que le statut final est bien `Valider` (transition réelle), on déclenche l'envoi de la notification. L'envoi est fait en tâche de fond (`.catch` local) pour ne jamais faire échouer la mise à jour de la facture si l'email échoue.

**Erreurs rencontrées & solutions**
Aucune erreur bloquante. `tsc --noEmit` et `eslint` passent sans erreur sur les fichiers modifiés.

**À tester / points d'attention**
- Déclencher un vrai changement de statut vers « Valider » depuis l'interface (`app/(main)/facture/[id]/page.tsx`) et vérifier que l'email arrive correctement formaté et avec les bons destinataires en copie (dépend des variables d'environnement SMTP réelles, non testables depuis cet environnement).
- Le modèle `Client` en base n'a qu'un champ `nom` (pas de prénom/entreprise séparés) — l'email utilise `client.nom` tel quel.
- Si la liste des destinataires en copie doit changer, modifier `NOTIFICATION_RECIPIENTS` dans `lib/email/proformaValidation.ts`.
