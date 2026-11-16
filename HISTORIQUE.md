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

## 2026-11-18 — Budget signé après la décision de la DG (paramétrable) et correctif « Tout valider »

**Demande / Contexte**
- « Tout valider » plantait (erreur 500 `P2028 Transaction not found`), alors que la validation ligne par ligne marchait.
- Nouveau circuit demandé :
  - la DG valide d'abord les lignes ;
  - le demandeur reçoit alors une notification pour joindre la version papier signée ;
  - la section est en rouge sur la fiche ;
  - le budget passe « Validé » seulement quand toutes les lignes sont validées et que le scan signé est joint, sinon il reste « Validation partielle ».
- Choix de l'utilisateur :
  - (A) **aucune dépense** tant que le scan manque ;
  - (B) scan exigé pour les budgets de **campagne et mensuels**, réglable dans les paramètres pour l'étendre aux autres types.

**Modifications apportées**
- Cause du plantage : « Tout valider » accordait les lignes une par une dans une transaction. Avec Supabase, cela dépassait les 5 s par défaut de Prisma.
  - Correctif : une seule requête (`updateMany`) dans `app/api/demandes-budget/[id]/valider/route.ts`.
  - Délai porté à 30 s (attente de connexion 10 s) pour toutes les transactions, dans `lib/prisma.ts` (`transactionOptions`), et explicitement sur les routes de validation.
- Migration `20261118100000_budget_signe_parametrable` (appliquée, ajout d'une colonne seulement) : `EntrepriseConfig.typesBudgetSigneRequis TypeBudget[]`, par défaut `[CAMPAGNE, MENSUEL]`.
- `lib/budgetSuivi.ts` :
  - nouvelles fonctions `typesBudgetSigneRequis`, `budgetSigneJoint`, `signatureAttendue`, `etatDepensable` (budget ouvert ET scan joint s'il est exigé) ;
  - `refusBudgetSigneManquant` est supprimé, car le scan n'est plus exigé avant d'accorder ;
  - `majStatutApresDecision` :
    - VALIDEE seulement si toutes les lignes sont décidées ET le scan est joint (ou n'est pas exigé) ;
    - renvoie `signatureDemandee`, à la première ligne accordée puis quand toutes les lignes sont décidées ;
    - nouvelle option `declencheur: "SIGNATURE"` ;
    - le valideur enregistré (`validatedByEmail`) est celui qui a décidé la dernière ligne, jamais le demandeur qui joint le scan ou retire une ligne.
- Routes :
  - décision de ligne et « Tout valider » : plus de blocage sur le scan, et notification au demandeur ;
  - `documents` : joindre un BUDGET_SIGNE pendant la validation recalcule le statut, qui passe Validé si tout est décidé, et envoie la notification « Budget validé » ;
  - `GET /api/demandes-budget/[id]` renvoie `budgetSigneRequis`.
- Dépenses : `controlerLigneBudget` (`lib/depenses/enregistrerDepense.ts`) utilise `etatDepensable`. Les dépenses sont donc refusées sans scan, depuis le budget, la proforma, le rattachement ou CampTrack.
  - La liste des lignes de la proforma (`/api/factures/[id]/lignes-depense`) et celle de CampTrack (`/api/integration/budgets/lignes`) ne proposent plus ces lignes.
  - `ChoixLigneBudgetDialog` affiche le motif.
- Notification `BUDGET_SIGNE_A_JOINDRE` (au demandeur, canal réglable) : `lib/notifications/evenements.ts` et `sendBudgetSigneDemandeNotification` dans `lib/email/demandeBudget.ts`.
- Fiche budget :
  - carte rouge « Budget signé à joindre », avec Imprimer et Joindre, dès qu'une ligne est accordée ;
  - boutons Accorder, Ajuster et Tout valider débloqués ;
  - bouton Dépense masqué tant que le scan manque.
- Paramètres → Rôles : carte « Budget signé exigé », avec un interrupteur par type de budget (`/api/budget-config`, champ `typesBudgetSigneRequis`).
- Documentation : guide des équipes (section 2 et messages) et document CampTrack (nouveau message de refus).

**Ce qui ne change pas**
- La séparation des tâches, le plafond, les dépassements, les corrections de ligne et le rejet.
- Les budgets ponctuels et pour tiers, tant qu'ils ne sont pas cochés : validés sans scan, comme avant.
- **Les budgets déjà validés ne sont jamais bloqués**, par exemple le budget mensuel validé sans scan qui existe en base.

**Tests**
- Nouveau test en base (transaction annulée) : 26/26. Il couvre le partiel sans scan, le refus de dépense, la notification, le passage à Validé au dépôt du scan avec la DG comme valideur, le scan joint avant la fin des décisions, le ponctuel sans scan, l'ancien budget validé, le réglage coché ou décoché, « Tout valider » sur 12 lignes et le rejet.
- Non-régression : budget (logique 89, base 37), Lot A 15, Lot C (19, 8 et 5), service de dépense 18, factures de prestataires 11, routes CampTrack 16 : tout passe. Deux anciens tests ont été adaptés à la nouvelle règle (plus de scan exigé avant d'accorder), et le délai du test c2 a été allongé (Supabase lent).
- `tsc` et lint OK.

**Erreurs rencontrées & solutions**
- `prisma generate` en EPERM, car le serveur de dev tient le moteur. Les types sont bien générés. **Il faut redémarrer le serveur de dev** pour qu'il voie la nouvelle colonne.

**À tester / points d'attention**
- Tester sur un vrai budget : la DG accorde (le demandeur reçoit la notification, la carte est rouge), puis le demandeur joint le scan (le budget passe Validé et les comptables sont prévenus).

---

## 2026-11-17 (suite 4) — Vérification de non-régression de toute la logique métier

**Demande / Contexte**
S'assurer que la chaîne de dépense unifiée, les lots CampTrack et la nuance des prestataires ne cassent aucune logique existante.

**Vérifications faites**
- 9 suites de tests en base (transactions annulées ou données marquées puis nettoyées) : 218 contrôles, tous OK. Ils couvrent le budget (logique 89 et base 37), le Lot A (15), le Lot C (19 + 8 + 5), le service de dépense (18), les factures de prestataires (11) et les routes CampTrack avec le vrai JSON (16).
- Recherche dans le code de tout calcul du « payé » d'un bon de commande qui ne passerait pas par les imputations : aucun trouvé.
- Audit des données en lecture seule : aucun solde de caisse négatif, aucun écart entre les soldes et le journal, aucun lot ni paiement à rattacher. 3 bons validés sans scan signé ne sont pas payables, ce qui est voulu par la procédure.
- Build de production complet, puis ouverture dans le navigateur (Playwright) des 29 grandes pages, y compris les nouvelles. Aucun écran d’erreur, aucune erreur JavaScript, aucune API en erreur 500. Le planificateur démarre sans erreur avec le build de production.

**Régressions trouvées et corrigées**
- **138 anciennes factures fournisseurs EN_ATTENTE**, créées sans bon ni ligne de budget, ne pouvaient plus être marquées « payée ». Correctif dans `app/api/factures-fournisseurs/[id]/route.ts` et les pages `fournisseur/factures` et `fournisseur/[id]` :
  - le passage manuel à PAYEE reste refusé pour une facture liée à un bon, à une ligne ou à des dépenses ;
  - une facture non liée (le cas de toutes les factures existantes) se marque « payée » à la main **comme avant, par tout le monde**. Une première version réservait ce passage à la DG : c’était un changement par rapport à l’existant, il a été retiré à la demande de l’utilisateur.
- **Planificateur en production** : `instrumentation.ts` → `etatSoir` → `budgetAuth` importait `@clerk/nextjs`, ce qui échoue au démarrage en production. `getBudgetRecipients` est déplacé dans le nouveau module `lib/budgetDestinataires.ts`, sans Clerk. `budgetAuth` le réexporte, et rien ne change pour les autres appelants. Constat : le planificateur démarre maintenant avec le build de production.

**Autres modifications**
- `next.config.ts` : `distDir: process.env.NEXT_DIST_DIR || ".next"`. Le build de vérification se fait dans `.next-verif` sans toucher au serveur de dev. Docker n'est pas changé, puisque `.next` reste la valeur par défaut. `.gitignore` est complété.
- `e2e/non-regression.spec.ts` : une page lente ou une navigation interrompue est notée en échec sans arrêter la tournée (limite de 90 s par page, 15 min au total). Ajout des pages notifications, paramètres des notifications, recherche, aide, liste des factures, bons de commande et fiche d'un bon.

**Changements de comportement voulus (ce ne sont pas des régressions)**
- Le bouton Dépense de la proforma passe par une ligne du budget quand la campagne en a un.
- Une nouvelle facture d'un prestataire de type Fournisseur exige un bon de commande.
- Les transitions de statut des bons sont restreintes, et PAYEE est automatique.
- La saisie au journal de caisse exige le droit « Saisir au journal de caisse ».
- Toute sortie au-delà du solde de la caisse est refusée.

**Erreurs rencontrées & solutions**
- Coupures ponctuelles de Supabase (P1001) pendant les tests et au démarrage, avec la synchronisation des rôles en échec : relance. Ce n'est pas lié au code.

**À tester / points d'attention**
- Le rôle ASSISTANT (1 utilisateur actif) n’a pas le droit « Saisir au journal de caisse ». Avant la branche, aucun droit n’était demandé : cette personne pouvait saisir une dépense sur une proforma et écrire au journal de caisse, et elle ne le peut plus. Pour retrouver l’ancien fonctionnement, cocher ce droit sur le rôle (Paramètres → Rôles).
- Un build avec `NEXT_DIST_DIR` fait réécrire `tsconfig.json` par Next.js, qui y ajoute `<dossier>/types`. Il faut restaurer `tsconfig.json` après coup (`git restore tsconfig.json`) et ne pas le committer.
- Le rôle « Comptable » n'a aucun utilisateur. Les 5 admins ont tous les droits, la séparation des tâches s'applique donc entre eux. Il faut attribuer les rôles réels avant la mise en service.

---

## 2026-11-17 (suite 3) — Lots CampTrack : alignement sur le contrat déjà codé dans CampTrack

**Demande / Contexte**
Vérification de l'intégration des lots de paiement CampTrack. Le développeur de CampTrack avait déjà codé l'envoi par lot (branche `feature/paiements_groupes`, non fusionnée) avec son propre contrat (`POST /api/integration/cash-journal/depenses-groupees`, document `docs/INTEGRATION_FINANCE_PAIEMENTS_GROUPES.md` côté CampTrack), différent de celui prévu ici (`/lots-paiement` : adresse, noms de champs, 409 sur doublon, forme de la réponse). Décision : Proforma s'aligne sur le contrat de CampTrack ; le développeur n'ajoute que les champs liés au budget.

**Modifications apportées**
- Nouvelle route `app/api/integration/cash-journal/depenses-groupees` : accepte le JSON de CampTrack **tel quel** (`montant`, `campagne`, `lignes[]` avec numéro MoMo, type, idPaiement…) et répond comme il l'attend (`cashJournalEntry`, `lignes[{numero, id}]`, `409` si la référence existe, `404` caisse introuvable) ; ajouts facultatifs `ligneBudgetId`, `comptableEmail` (requis avec la ligne), `modePaiement`, `datePaiement`. Avec ligne → dépense de budget via `enregistrerDepense` ; campagne avec budget sans ligne (transition) → enregistré et marqué « à rattacher » ; campagne sans budget → dépense sur la proforma ; sans proforma → sortie de caisse. Réponse enrichie de `budgetDepenseId` et `aRattacher`.
- Route `/lots-paiement` **supprimée** (jamais utilisée) : une seule route pour les lots.
- Migration `20261117300000_lot_paiement_contrat_camptrack` (appliquée) : `LotPaiement.proformaId` et `comptableEmail` facultatifs, `campagneId`, `campagneNom`, `libelle`.
- Rattachement d'une dépense CampTrack : le lot correspondant est lié à la dépense de budget créée.
- Détail du lot visible sur l'écriture du **journal de caisse** (demande du document CampTrack) et sur la fiche budget (numéro MoMo, type).
- `docs/integration/camptrack-paiements-lots.md` réécrit pour le développeur CampTrack : ce qui est prêt, les 3 champs à ajouter, l'appel des lignes de budget, l'écran, les messages d'erreur, la transition, les tests.

**Tests**
- Avec le JSON exact du document CampTrack (vraies écritures, nettoyées) : 16/16 — JSON tel quel → 201 et « à rattacher », doublon → 409, ligne + comptable → dépense de budget, comptable manquant → 400, séparation des tâches → 400, plafond → 400, total incohérent → 400, caisse introuvable → 404, solde insuffisant → 400, sans budget, sans proforma, appel unitaire inchangé, reste des lignes. `tsc` et `lint` OK.

**À tester / points d'attention**
- Transmettre `docs/integration/camptrack-paiements-lots.md` au développeur CampTrack.

---

## 2026-11-17 (suite 2) — Registre de la dette technique

**Demande / Contexte**
Conserver l'analyse franche de la solidité du code (risques pour les futures fonctionnalités) afin de la traiter lors de prochains correctifs.

**Modifications apportées**
- Nouveau fichier `docs/dette-technique.md` : ce qui est solide (à préserver), puis 15 points classés par priorité — tests automatisés absents du projet, développement sur la base de production, routes sans contrôle de droits, fusion de `feature/budgets`, montants de caisse en `Float`, double gestionnaire de paquets (pnpm / npm), écrans trop volumineux, calculs de suivi dupliqués, annulation des dépenses hors budget, double calcul du statut « payée » des factures, champs redondants, fichiers sur disque, `Paiement.methode` en texte libre, client Prisma isolé, envoi d'email hors `sendEmail` — et les rappels à suivre pour toute nouvelle fonctionnalité.

**À tester / points d'attention**
- Consulter ce fichier avant chaque nouveau chantier ; cocher les points traités et les consigner ici.

---

## 2026-11-17 (suite) — Factures de prestataires internes / externes réglées sur une ligne de budget

**Demande / Contexte**
Nuance sur la règle « une facture répond à un bon de commande » : elle ne vaut que pour les prestataires de type **Fournisseur**. Les prestataires **internes** et **externes** peuvent être associés directement à un budget — par exemple le budget mensuel de la comptabilité pour la paie des employés.

**Modifications apportées**
- Migration `20261117200000_facture_prestataire_ligne_budget` (appliquée) : `FactureFournisseur.ligneBudgetId` (facultatif).
- `lib/typeFournisseur.ts` : `exigeBonDeCommande(type)` — vrai seulement pour « Fournisseur » (un prestataire sans type compte comme interne).
- Création de facture (`/api/factures-fournisseurs`) : bon obligatoire pour un Fournisseur ; pour un prestataire interne / externe, bon facultatif **ou** ligne de budget (jamais les deux). Fenêtre de facture : libellé « Bon de commande * / (facultatif) » selon le type, choix « Ligne de budget (facultatif) » parmi les lignes accordées des budgets ouverts.
- Paiement : `controlerPaiementFacture` / `recalculerStatutFacture` (`lib/commandeFournisseurSuivi.ts`), branchés dans `enregistrerDepense` : une dépense sur une ligne de budget peut régler une facture de prestataire interne / externe (en attente, sans bon, rattachée à cette ligne ou à aucune, montant ≤ reste) ; **paiement partiel possible**, facture **PAYEE** une fois entièrement réglée, de nouveau « à payer » si une dépense est annulée. Fenêtre de dépense (fiche budget et fiche proforma) : option « Facture … — prestataire (reste …) » ; liste fournie par `facturesPrestatairesPayables`.
- Guide des équipes : sous-partie « Prestataires internes et externes » et message d'erreur correspondant.

**Tests**
- Transaction annulée : 11/11 (règle par type, factures payables par ligne, acompte puis solde → PAYEE, dépassement refusé, facture payée non repayable, annulation → à payer, autre ligne refusée, facture de Fournisseur sans bon refusée, prestataire sans type traité en interne). Non-régression : chaîne de dépense 18/18, Lot C 19/19, budget 37/37. `tsc` et `lint` OK.

**À tester / points d'attention**
- Vérifier le **type** de chaque prestataire (fiche prestataire) : un ancien prestataire sans type est traité comme « interne » (bon de commande facultatif).

---

## 2026-11-17 — Une seule chaîne de dépense (budget ↔ bon de commande ↔ facture ↔ caisse ↔ proforma), lots Camptrack, guide des équipes

**Demande / Contexte**
Toute sortie d'argent doit être une seule opération, qu'elle parte de la fiche budget, de la fiche proforma ou de Camptrack, et tout mettre à jour d'un coup (caisse, ligne de budget, marge de la proforma, ligne de produit du bon de commande, facture). Décisions : les campagnes sans budget gardent la dépense directe sur la proforma ; avec budget, la ligne est obligatoire (y compris pour Camptrack) ; Camptrack paie **par lots** (un lot par proforma) et n'est **pas modifié ici** — l'appel actuel doit continuer de marcher, des instructions sont écrites pour son développeur ; un guide des processus consultable et téléchargeable dans Proforma.

**Modifications apportées**
- Migration `20261117100000_chaine_depense_imputations_lots` (appliquée, écart nul) : `ImputationCommande` (source unique du payé d'un bon et de chaque ligne de produit ; reprise au prorata des dépenses déjà liées à un bon), statut `PAYEE` des bons (automatique), `BudgetDepense.source` (MANUEL / PROFORMA / CAMPTRACK) et `referenceExterne`, `Paiement.aRattacherBudget`, `LotPaiement`.
- `lib/depenses/enregistrerDepense.ts` : **fonction unique** de toute sortie d'argent — avec ligne de budget (`controlerLigneBudget` : budget ouvert, séparation des tâches, dates, ligne accordée, plafond) ou, seulement si la proforma n'a aucun budget, sortie directe ; bon de commande (`controlerPaiementCommande` revu : ligne de produit ou « tout le bon » réparti au prorata du reste, bon lié à la ligne de budget ou à la proforma) ; écriture de caisse + dépense sur la proforma ; imputations ; facture PAYEE au solde ; bon PAYEE quand il est soldé (`majStatutCommande`) ; historique et statut du budget. Utilisée par `/api/demandes-budget/[id]/depenses`, `/api/factures/[id]/paiements` (DEPENSE) et les lots Camptrack. Annulation : `annulerImputations` (facture à payer, bon revenu à Livrée / Validée).
- Fiche proforma : le bouton **Dépense** propose la ligne de budget si la campagne en a un (`ChoixLigneBudgetDialog`, puis la même fenêtre que la fiche budget), sinon la sortie directe avec bon de commande facultatif ; route `GET /api/factures/[id]/lignes-depense`.
- Fenêtre de dépense : choix de la **ligne de produit** du bon (ou tout le bon). Fiche du bon : **payé / reste par ligne de produit**, paiements de toute origine. Factures fournisseurs : **bon de commande obligatoire** à la création (écran et serveur). Liste des bons : filtre « Payée ».
- **Camptrack (transition)** : `POST /api/integration/cash-journal/depenses` garde son contrat ; sur une campagne avec budget, le paiement est marqué « à rattacher » → carte orange sur la fiche budget, bouton **Rattacher** (`/api/demandes-budget/[id]/rattacher` : crée la dépense de budget sur l'écriture existante, plafond contrôlé, caisse non retouchée), et section dans l'état du soir.
- **Camptrack (lots)** : `GET /api/integration/budgets/lignes?proformaId=` et `POST /api/integration/cash-journal/lots-paiement` (résumé du lot, total = somme des lignes, ligne de budget obligatoire si budget, **idempotent** par `reference`, lot justifié dans Camptrack). Sur la fiche budget, le détail du lot s'ouvre depuis la dépense. Instructions pour le développeur : `docs/integration/camptrack-paiements-lots.md`.
- Dépenses Camptrack considérées **justifiées dans Camptrack** (hors justificatifs manquants, « Oui (Camptrack) »).
- **Guide des équipes** : `public/docs/procedure-paiement-plateforme.md`, affiché sur la page **Aide** (`/aide`, lien dans la barre latérale : sommaire, Imprimer / PDF, téléchargement Markdown) ; `/docs/*` réservé aux utilisateurs connectés (middleware). Dépendance `marked` ajoutée (package-lock.json et pnpm-lock.yaml synchronisés, aucune autre version changée).

**Tests**
- Service, transaction annulée : 18/18 (prorata 60 000 / 30 000, ligne de produit et son reste, refus sans ligne sur une campagne avec budget, sortie directe sans budget, BC d'un budget refusé hors budget, solde → facture et bon payés, bon payé non repayable, annulation → facture à payer et bon « Livrée », séparation des tâches, plafond, budget non validé, Camptrack justifié).
- Routes Camptrack, vraies écritures **nettoyées** : 15/15 (ancien appel inchangé avec et sans budget, marqué à rattacher ; lignes de budget ; lot : total incohérent, ligne obligatoire, plafond, succès, renvoi idempotent, sans budget, hors justificatifs manquants).
- Non-régression : budget 37/37 et 89/89, Lot A 15/15, Lot C 19/19 (adapté aux imputations) et 8/8. `tsc` et `lint` OK.

**À tester / points d'attention**
- Transmettre `docs/integration/camptrack-paiements-lots.md` au développeur de Camptrack ; d'ici là, rattacher les paiements Camptrack depuis les fiches budget.
- Relire le guide (`public/docs/procedure-paiement-plateforme.md`) avant de le partager en ligne.
- Les anciennes factures fournisseurs sans bon de commande restent telles quelles ; toute nouvelle facture exige un bon.

---

## 2026-11-16 (suite 3) — Correctif : build Docker (package-lock) et erreur de la cloche en local

**Demande / Contexte**
En local, `GET /api/notifications` répondait 500 (`prisma.notification` indéfini). En préparant le déploiement, constat que le build Docker du VPS aurait échoué.

**Erreurs rencontrées & solutions**
- `prisma.notification` indéfini : le serveur `next dev` lancé avant la migration du Lot C gardait l'ancien client Prisma en mémoire (le client régénéré contient bien les nouveaux modèles) → **redémarrer `next dev`**. Rien à corriger dans le code.
- **Build Docker cassé** : `infra/Dockerfile` installe avec `npm ci` (et non pnpm) ; `@playwright/test` et `@clerk/testing`, ajoutés avec pnpm pour les tests de bout en bout, manquaient dans `package-lock.json` → `npm ci` aurait refusé de s'exécuter. `package-lock.json` régénéré avec `npm install --package-lock-only` (ne touche pas `node_modules`). La dernière `@clerk/testing` faisait monter `@clerk/backend` (utilisé en production) de 2.23.0 à 2.33.9 : **`@clerk/testing` épinglé en 1.13.10**, compatible avec les versions de production — le lock n'ajoute plus que les 6 paquets de test, aucune version existante ne change. `pnpm-lock.yaml` aligné (`pnpm install --lockfile-only`).

**À tester / points d'attention**
- À chaque ajout de dépendance avec pnpm, mettre aussi à jour `package-lock.json` (`npm install --package-lock-only`), sinon le build Docker échoue.
- `pnpm install` en local installera `@clerk/testing` 1.13.10 (même API pour les tests Playwright).

---

## 2026-11-16 (suite 2) — Lot C (3/3) : état du soir par campagne, minuterie interne, recherche par mot-clé

**Demande / Contexte**
Procédure de paiement, sections 7 et 8 : chaque soir la DG reçoit l'état par campagne (prévu, payé par moyen, reste), la liste des justificatifs manquants et les avances non justifiées ; tout document classé doit se retrouver en quelques mots-clés. Choix confirmé : les envois sont déclenchés par l'application elle-même (pas de crontab).

**Modifications apportées**
- `lib/rapports/etatSoir.ts` : `listerJustificatifsManquants` (calcul unique, repris par la route existante), `construireEtatSoir` (budgets CAMPAGNE ouverts : prévu = accordé + dépassements, payé total et **par moyen**, payé du jour, reste ; justificatifs manquants ; avances dont la liasse est incomplète), `envoyerEtatSoir` → `notifier("ETAT_DU_SOIR")` (DG, comptables en copie ; rien si tout est vide). Route `POST /api/integration/rapports/etat-soir` (clé d'intégration, `?dryRun=1`). La liste seule des justificatifs (`…/justificatifs-manquants`) passe aussi par `notifier`.
- `lib/taches/planificateur.ts`, démarré par `instrumentation.ts` **seulement si `SCHEDULER_ENABLED=true`** (jamais en local : base partagée avec la production) : toutes les 5 min, heure du Bénin — clôture des budgets mensuels chaque jour dès 6 h, état du soir à 19 h du lundi au vendredi ; verrou `TacheExecution` (clé « tâche:jour ») = une seule exécution par jour même avec plusieurs instances ; rattrapage le jour même après un redémarrage ; pas de nouvel essai automatique après un échec (consigné dans `TacheExecution.resultat`, renvoi possible par la route).
- Recherche : `GET /api/recherche?q=` (plusieurs mots en ET, insensible à la casse, un nombre cherche aussi les montants) — budgets et leurs pièces (circuit budget, sinon ses propres budgets), journal de caisse (section finance), bons de commande, pièces de liasse, factures fournisseurs et prestataires (section fournisseurs), proformas (section proforma). Page `/recherche` (lien en tête de la barre latérale), aperçu direct des pièces.

**Tests**
- 8/8 : heure du Bénin, échéances (pas avant 19 h, pas le week-end, clôture le samedi matin, passage de minuit), verrou (2e exécution refusée — ligne de test supprimée), cohérence de l'état du soir sur les données réelles (lecture seule, aucun envoi).
- Non-régression : budget 37/37 et 89/89, Lot A 15/15. `tsc` et `lint` OK.

**À tester / points d'attention**
- **Déploiement** : ajouter `SCHEDULER_ENABLED=true` dans le `.env` du VPS uniquement ; une crontab éventuelle sur la clôture mensuelle peut rester (opération idempotente) ou être retirée.
- `next build` non relancé (serveur de développement actif sur `.next`) : à faire avant de déployer (supprimer d'abord `.nextstandalone`).
- Manuellement : Paramètres → Notifications (choisir le canal de « État du soir ») ; `POST /api/integration/rapports/etat-soir?dryRun=1` pour voir le contenu ; page Recherche avec un compte sans section Finance (le journal de caisse ne doit pas apparaître).

---

## 2026-11-16 (suite) — Lot C (2/3) : bons de commande, avances et soldes, factures fournisseurs ↔ caisse

**Demande / Contexte**
Procédure de paiement, section 4 : les bons de commande sont émis à partir du budget et signés par la DG ; l'avance est versée sur BC signé et reste « non justifiée » (rouge) tant que la liasse n'est pas complète (BC signé, bordereau ou attestation de service fait, facture, rapport) ; le solde n'est payé qu'avec la liasse complète. Choix confirmés : avance / solde = dépense de budget liée au BC ; liasse = les 4 pièces.

**Modifications apportées**
- `lib/commandeFournisseurLiasse.ts` (calculs purs, aussi côté écran) : `etatLiasse`, `payeSurCommande`, libellés des pièces et des natures, `TRANSITIONS_COMMANDE`. `lib/commandeFournisseurSuivi.ts` (serveur) : `controlerPaiementCommande` (BC de la ligne, validé ou livré, BC signé ; solde = liasse complète + facture du BC en attente ; montant ≤ reste du BC ; verrou sur le BC), `libererFactureApresAnnulation`, `refusLigneBudgetCommande`, `prochainNumeroCommande`.
- Dépenses de budget (`app/api/demandes-budget/[id]/depenses`) : `commandeId`, `nature` (AVANCE / SOLDE), `factureFournisseurId` ; le solde passe la facture fournisseur **PAYEE** ; l'annulation de la dépense la remet **EN_ATTENTE**. Tous les contrôles existants restent (ligne accordée, plafond, solde de caisse, séparation des tâches).
- Bons de commande : création / modification réservées à la section « Prestataires » (aucune garde avant) ; numéro **par année** dans une transaction (`BCF-AAAA-NNNN`, suit le plus grand numéro de l'année, nouvel essai si doublon) ; `ligneBudgetId` ; **statut contrôlé côté serveur** (avant : n'importe quelle valeur, dans n'importe quel sens) — BROUILLON → VALIDEE → LIVREE, ANNULEE sans paiement, aucun retour ; **VALIDEE réservé à la direction et seulement avec le scan du BC signé** (notification « BC validé » aux comptables). Nouvelle route `POST /api/fournisseurs/commandes/[commandeId]/documents` (pièces de la liasse, `public/Upload/CommandeFournisseur/<id>/`, nommées `date_campagne_document_montant`, jamais supprimées). La liste des BC reste lisible par tout utilisateur connecté (le formulaire de budget s'en sert).
- Factures fournisseurs : impossible de les passer (ou de les créer) « payée » à la main — elles le deviennent par le solde ; pas d'annulation tant qu'un paiement actif les règle ; rattachement possible à un BC (`commandeId`, même prestataire). Choix « Payée » désactivé dans les écrans.
- Interface : carte **« Budget, liasse et paiements »** sur la fiche du BC (`components/fournisseurs/CommandeLiasseCard.tsx` : ligne de budget à rattacher, 4 pièces cochées / manquantes avec « Joindre », factures du prestataire avec « Enregistrer la facture », payé / reste, avance non justifiée en rouge) ; liste de statuts limitée aux passages autorisés (« Validée » grisé sans droit ou sans scan) ; fenêtre « Enregistrer une dépense » : choix Dépense simple / Avance / Solde par BC, état de la liasse et reste du BC, facture à régler ; fiche budget : BC de chaque ligne (liasse x/4), nature des dépenses, « Avance non justifiée » en rouge.

**Tests**
- En base, transaction annulée : 19/19 (ligne retirée refusée, numérotation, avance refusée sur brouillon / sans BC signé / autre ligne / au-delà du BC, solde refusé sans liasse ou sans facture, accepté avec liasse complète, facture payée non réutilisable, annulation → facture à payer, transitions) — rien enregistré. `tsc` et `lint` OK.

**À tester / points d'attention**
- Les BC déjà VALIDEE sans scan signé ne peuvent recevoir aucun paiement tant que le scan n'est pas joint.
- Le rattachement d'un BC à une ligne de budget se fait depuis la fiche du BC (pas encore dans le formulaire de création).

---

## 2026-11-16 — Lot C (1/3) : notifications dans l'application, canal choisi par événement

**Demande / Contexte**
Plutôt qu'un email à chaque événement, un système de notifications dans Proforma : pour chaque événement qui envoie aujourd'hui un email, l'admin choisit le canal — email, application ou les deux. Socle du Lot C (plan : notifications, puis avances / soldes fournisseurs, puis état du soir et recherche).

**Modifications apportées**
- Migration `20261116100000_lot_c_notifications_fournisseurs` (générée par `migrate diff`, appliquée, écart nul vérifié ; elle contient aussi les tables du reste du Lot C) : `Notification`, `NotificationPreference` (enum `CanalNotification` EMAIL / APP / LES_DEUX), `TacheExecution` ; `CommandeFournisseurDocument` (enum `TypeDocumentCommande`), `CommandeFournisseur.ligneBudgetId`, `BudgetDepense.commandeId / nature (NatureDepense) / factureFournisseurId`, `FactureFournisseur.commandeId`. `prisma format` a réaligné le schéma (sans changement de fond).
- `lib/notifications/evenements.ts` : catalogue des 15 événements (budgets, pilotage, proformas, fournisseurs), canal par défaut **les deux** (les emails continuent de partir comme avant).
- `lib/notifications/notifier.ts` : point d'entrée unique `notifier(evenement, {to, cc, subject, html, message, lien})` — notification pour chaque destinataire qui a un compte actif, email selon le canal ; une adresse sans compte (liste de diffusion) reçoit toujours l'email ; un canal en erreur n'empêche pas l'autre.
- Toutes les notifications existantes passent par `notifier` (signatures et appelants inchangés) : 10 de budget (`lib/email/demandeBudget.ts`, via `notifierBudget`, lien vers la fiche), encaissement de proforma, validation de proforma — qui avait son propre transporteur nodemailer et échappait à `EMAIL_DISABLED` —, création de bon de commande ; nouvelle `sendCommandeFournisseurValideeNotification` (BC validé → comptables).
- Routes : `GET /api/notifications`, `POST /api/notifications/lues`, `GET/PUT /api/notifications/preferences` (administrateurs).
- Interface : **cloche** dans l'en-tête de la barre latérale (pastille des non lues, rafraîchie chaque minute et au retour sur l'onglet, 10 dernières, « Tout marquer comme lu ») ; page `/notifications` ; page **Paramètres > Notifications** (canal par événement, « Tout régler sur… »).

**Tests**
- En base (lignes de test supprimées ensuite, préférence remise en l'état) : 5/5 — « les deux » = notification pour le compte seulement (email insensible à la casse) + email à tous ; « application » = email seulement à l'adresse sans compte ; « email » = aucune notification. `tsc` et `lint` OK.

**À tester / points d'attention**
- Redémarrer `next dev` (nouveau client Prisma ; `prisma generate` a buté sur le moteur verrouillé).
- L'envoi de la proforma au client (`/api/factures/[id]/send-email`) n'est pas une notification : il reste un envoi direct.

---

## 2026-11-15 (suite) — Tests de bout en bout Playwright (en pause) et interrupteur des emails

**Demande / Contexte**
Tester la solution de bout en bout en local avec le compte admin de test : l'admin crée les autres profils, leur donne des droits, puis chaque acteur joue sa part du circuit ; vérifier l'absence de régression. La base locale étant celle de la production, choix confirmés : données marquées « E2E-… » et supprimées à la fin, emails coupés, tests rangés dans le projet. Mis **en pause** à la demande de l'utilisateur (durée d'exécution), pour passer au Lot C.

**Modifications apportées**
- `lib/email/sendEmail.ts` : interrupteur `EMAIL_DISABLED=true` — aucun envoi, l'email est seulement tracé en console (sans effet en production où la variable est absente). Les deux envois qui n'utilisent pas `sendEmail` (validation de proforma, envoi de facture) ne sont pas couverts ; les tests ne les déclenchent pas.
- Dépendances de développement : `@playwright/test` 1.56.1, `@clerk/testing` ; script `pnpm test:e2e` ; `.gitignore` (rapports, `e2e/.run/`).
- `playwright.config.ts`, dossier `e2e/` (mode d'emploi dans `e2e/README.md`) : `global-setup.ts` (contrôles, proforma de test, jeton Clerk de test), `cleanup.ts` / `global-teardown.ts` (suppression de tout ce que l'exécution a créé, y compris comptes Clerk et fichiers ; reprise si une exécution a été interrompue), `procedure-paiement.spec.ts` (13 scénarios), `non-regression.spec.ts` (toutes les grandes pages pour l'admin). Mot de passe admin jamais écrit : passé par variable d'environnement.

**Résultats de la 1re exécution (sur `next build` + `next start`)**
- `next build` OK (compilé en 4,5 min, 33 pages) — `node_modules` intact (`.next/standalone` supprimé avant).
- ✅ Non-régression : les 22 pages principales s'ouvrent sans erreur ni exception pour l'admin.
- ✅ Scénarios 1 à 3 : création des rôles et des comptes par l'admin, caisse de test, refus **serveur** d'une dépense et d'un transfert supérieurs au solde.
- ❌ Scénario 4 arrêté sur un sélecteur du test (bouton « Associer des proformas » non trouvé dans le formulaire de campagne) — à corriger dans le test, pas d'anomalie applicative constatée ; scénarios 5 à 13 non exécutés.
- Nettoyage vérifié : caisse, 3 comptes (base + Clerk), 3 rôles, proforma et client de test supprimés.

**Erreurs rencontrées & solutions**
- Navigateur de Playwright non téléchargeable (bloqué à 0 %) → option `E2E_BROWSER_CHANNEL=chrome` (Chrome installé sur le poste).
- `next dev` trop lent (≈ 1 min de compilation par page) → tests lancés sur la version compilée.

**À tester / points d'attention**
- Reprise : corriger le sélecteur du scénario 4, puis `EMAIL_DISABLED=true pnpm start` (après `pnpm build`) et `E2E_BROWSER_CHANNEL=chrome E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… E2E_EMAILS_DESACTIVES=true pnpm test:e2e`.
- Changer le mot de passe du compte de test, partagé dans la conversation.

---

## 2026-11-15 — Procédure de paiement (Lot A) : verrou du journal de caisse, moyen de paiement par ligne, budget signé, justificatifs à 24 h, fichiers protégés

**Demande / Contexte**
La direction a diffusé la « Procédure de paiement RESEAUPUB – de A à Z » (v3, 12/11/2026). L'analyse d'écart (plan : Lots A à E) a montré que le circuit budget couvrait déjà l'essentiel, mais que des sorties d'argent restaient possibles hors de tout contrôle. Le Lot A ferme ces failles et applique les réglages de la section 10 qui ne dépendent d'aucun arbitrage de la DG.

**Modifications apportées**
- Migration `20261115100000_procedure_paiement_lot_a` (générée par `migrate diff`, appliquée, écart nul vérifié) : `Role.canSaisirCaisse` ; `DemandeBudgetLigne.modePaiement` ; valeur `CARTE` dans `ModePaiementDemande` ; valeur `BUDGET_SIGNE` dans `TypeAttachmentDemande`. Reprise : chaque ligne existante prend le moyen de sa demande ; le droit de caisse est coché sur les rôles qui avaient déjà accès au journal (section Finance), à l'administration (`canManageUsers`) et au comptable (`canPayBudget`) — résultat en base : **Admin** et **Comptable** l'ont, **ASSISTANT** non.
- **Verrou du journal de caisse** (règle d'or n° 2 : aucun argent ne sort sans validation de la DG) : nouveau droit « Saisir au journal de caisse (hors budget) » dans Paramètres > Rôles ; garde `requireCaisseUser()` (`lib/budgetAuth.ts`) sur `POST /api/cash-journal` (recettes, dépenses, transferts), `POST /api/cash-registers`, `PATCH /api/cash-registers/[id]`, `POST /api/cash-journal/recalculate` et les **dépenses** sur proforma (`POST /api/factures/[id]/paiements` type DEPENSE ; les encaissements clients restent ouverts). Ces routes n'avaient jusque-là aucun contrôle de droit. Côté écran, les boutons de saisie sont masqués sans le droit (journal de caisse, fiche proforma), avec la mention « Consultation seule ».
- **Solde contrôlé côté serveur** : `recordCashMovement` (`lib/cashJournal.ts`) refuse toute DEPENSE non couverte par le solde, sous verrou de la caisse — donc aussi la saisie manuelle et l'API d'intégration Camptrack sans proforma, qui ne vérifiaient rien. Les transferts vérifient la caisse source (`assertSoldeSuffisant`). Erreur « Solde insuffisant… » renvoyée en 400 (et non 500).
- **Moyen de paiement prévu par ligne** (section 4, point 1) : sélecteur par ligne dans le formulaire (« Principal (…) » par défaut), total par moyen sous le total, sur la fiche (demandé / accordé), dans l'impression et dans le rapport « Suivi budgétaire » (tableau et onglet Excel « Par moyen », colonne dans le détail). La dépense pré-sélectionne le moyen de la ligne ; la correction de ligne permet d'en changer. Libellés communs dans `lib/budgetTypes.ts` (`MODE_PAIEMENT_OPTIONS`, `modePaiementLabel`, `totauxParModePaiement`). Ajout de **Carte bancaire**.
- **Budget de campagne signé par la DG** (section 4, points 2-3) : bouton **Imprimer** sur la fiche (PDF `lib/pdf/budgetPdf.ts` : lignes, moyens, total par moyen, cadres de signature Préparé par / Vérifié comptable / Approuvé Direction générale) ; nouveau type de document « Budget signé (DG) » ; un budget **CAMPAGNE** ne peut avoir aucune ligne accordée (Tout valider, Accorder, Ajuster) tant que ce scan n'est pas joint (`refusBudgetSigneManquant`, `lib/budgetSuivi.ts`). Les documents peuvent désormais être ajoutés pendant la validation.
- **Justificatifs à 24 h ouvrées** (section 7) : `lib/justificatifs.ts` (délai lundi-vendredi, heure du Bénin) ; colonne « Justificatif reçu : Oui / Non », échéance affichée, dépense **en rouge** une fois le délai dépassé ; compteur « dont N en retard » sur la fiche et dans la liste des budgets. **État du soir** : `POST /api/integration/rapports/justificatifs-manquants` (clé d'intégration) envoie à la DG (comptables en copie) la liste des dépenses sans justificatif, les retards en tête ; rien n'est envoyé s'il n'en manque aucun ; `?dryRun=1` pour contrôler sans envoyer.
- **Nommage des pièces** (section 7) : les pièces de budget sont nommées `date_campagne_document_montant` (ex. `2026-11-12_BIIC-DB-2026-0012_Preuve-paiement_350000F.pdf`, client de la proforma + numéro du budget) — `lib/uploadDemandeBudget.ts`.
- **Fichiers protégés** : `middleware.ts` couvre désormais `/Upload/*` — un fichier déposé (justificatif, état, bon…) n'est plus servi qu'à un utilisateur connecté (vérifié : 307 vers la connexion sans session ; le logo public reste accessible).

**Erreurs rencontrées & solutions**
- Fichiers en fins de ligne Windows (CRLF) : remplacements faits par un petit script qui les conserve.
- `prisma generate` : EPERM (moteur verrouillé par `next dev`) — types bien générés ; redémarrer `next dev`.
- Une commande de test lancée avec `cat >` sans entrée a bloqué le terminal → arrêtée, relancée correctement.

**Tests**
- Nouveau scénario en base, transaction annulée : 15/15 (dépense manuelle > solde refusée, dépense = solde acceptée, caisse vide refusée pour `recordCashDepense` et les transferts, recette toujours possible, solde cohérent ; CAMPAGNE sans scan refusée, un devis ne suffit pas, scan signé → accepté ; PONCTUEL non concerné, enum CARTE ; moyen par ligne ; total par moyen ; nommage) — rien enregistré.
- Non-régression : 37/37 (base) et 89/89 (sans base). `tsc` et `lint` OK.

**À tester / points d'attention**
- Redémarrer `next dev` (nouveau moteur Prisma).
- **Paramètres > Rôles** : vérifier le droit « Saisir au journal de caisse » — cocher le rôle de la caissière (Mme Dolorès) s'il n'est ni Admin ni Comptable ; décocher Admin si la DG ne doit pas saisir elle-même.
- **Caisses à solde négatif** : toute sortie y est maintenant refusée jusqu'à un approvisionnement (y compris les paiements Camptrack envoyés sans proforma, qui reçoivent un 400 et n'enregistrent rien côté Camptrack).
- **Crontab du serveur** : ajouter l'état du soir, par ex. `0 19 * * 1-5 curl -s -X POST -H "Authorization: Bearer $INTEGRATION_API_KEY" https://<domaine>/api/integration/rapports/justificatifs-manquants` (à côté de la clôture mensuelle).
- Budget CAMPAGNE : Imprimer → signer → « Joindre le budget signé » → les boutons Accorder / Tout valider se débloquent.
- Liens vers des fichiers dans des e-mails existants : ils demandent désormais une connexion.

---

## 2026-11-14 (suite 3) — Budgets : validation ligne par ligne, correction ou retrait par le demandeur

**Demande / Contexte**
L'admin veut valider un budget **ligne par ligne** ; le bouton « Valider » existant devient « tout valider d'un coup ». Une ligne non validée n'est pas refusée définitivement : le demandeur la **corrige** selon le commentaire laissé (elle repart en validation) ou la **retire** du budget, pour que le budget puisse passer entièrement validé. Décisions confirmées : montant ajustable **à la baisse** par le valideur ; une ligne accordée est **dépensable immédiatement** (validation partielle).

**Modifications apportées**
- `prisma/schema.prisma` + migration `20261114200000_budget_validation_par_ligne` (écrite à la main faute d'accès à Supabase au moment de la génération, puis vérifiée : `migrate diff` base ↔ schéma = migration vide) : enum `StatutLigneBudget` (EN_ATTENTE, ACCORDEE, A_CORRIGER, RETIREE) ; `DemandeBudgetLigne.statutValidation / montantAccorde / decideParEmail / decideAt / motifDecision` (`montant` = montant **demandé**) ; statut budget `VALIDATION_PARTIELLE` ; actions d'historique `LIGNE_ACCORDEE / LIGNE_A_CORRIGER / LIGNE_CORRIGEE / LIGNE_RETIREE`. Reprise : les lignes des budgets déjà validés sont ACCORDEE (vérifié : 4 lignes VALIDEE → ACCORDEE, 4 autres EN_ATTENTE) — aucun changement pour l'existant.
- `lib/budgetSuivi.ts` : `montantAccordeLigne` (ACCORDEE → accordé ou demandé ; sinon 0) remplace `ligne.montant` partout où il sert de plafond (`getLigneDisponible`, `getBudgetTotaux`, `recalculerStatutBudget`) ; `majStatutApresDecision` (toutes retirées → REJETEE ; plus rien à décider → VALIDEE puis EN_COURS / PAYEE si déjà dépensé ; ≥ 1 accordée → VALIDATION_PARTIELLE ; sinon SOUMISE ; recalcule `montantTotal` demandé hors lignes retirées) ; `retirerLignesNonAccordees` (clôture).
- Nouvelles routes : `POST /api/demandes-budget/[id]/lignes/[ligneId]/decider` (valideur, même matrice `refusValidation` : ACCORDER au demandé ou à un montant réduit avec motif, jamais plus ; CORRIGER avec motif, qui ouvre aussi le fil de commentaires de la ligne et prévient le demandeur) et `PATCH /api/demandes-budget/[id]/lignes/[ligneId]` (demandeur ou comptable, ligne A_CORRIGER : MODIFIER → EN_ATTENTE + notification aux valideurs ; RETIRER → RETIREE ; réponse facultative ajoutée au fil).
- Routes modifiées : `valider` = « tout valider » (accorde les lignes EN_ATTENTE, garde les décisions déjà prises, refusé tant qu'une ligne est à corriger) ; `rejeter` aussi en validation partielle si aucune dépense ; `depenses` (validation partielle acceptée, ligne ACCORDEE uniquement, interdite à celui qui a accordé la ligne) ; `depassements` (ligne ACCORDEE uniquement) ; `cloturer` + clôture automatique (validation partielle incluse, lignes non accordées retirées) ; `documents` ; liste (plafond = accordé, compteur « lignes à corriger ») ; rapport « Suivi budgétaire » (lignes accordées seulement, colonne Demandé en plus) ; reconduction (reprend le montant accordé, ignore les lignes retirées).
- E-mails : tableau des lignes avec statut / montant accordé / motif ; nouvelles notifications « ligne à corriger » (demandeur) et « ligne corrigée » (valideurs compétents).
- Interface : fiche budget — colonnes Demandé / Accordé, pastille par ligne (En attente, Accordée, Accordée partiellement, À corriger, Retirée), boutons **Accorder / Ajuster / Demander une correction** pour le valideur, **Modifier la ligne / Retirer du budget** pour le demandeur, bandeau « N ligne(s) à corriger », avancement dans la carte de validation (« Tout valider » grisé tant qu'une ligne est en correction), synthèse « Accordé … sur … demandés » ; badge « Validation partielle » ; filtre de statut dans la liste. Composants `components/budget/BudgetLigneDecisionDialog.tsx` et `BudgetLigneCorrectionDialog.tsx`.

**Erreurs rencontrées & solutions**
- Supabase injoignable pendant `migrate diff` → SQL écrit à la main au format Prisma, appliqué dès le retour de la connexion, puis contrôle d'écart nul.
- `prisma generate` : EPERM (moteur verrouillé par `next dev` lancé pour les tests) — types bien générés ; redémarrer `next dev` pour charger le nouveau moteur.
- Le fichier de test en base avait été ré-encodé par PowerShell (`Get-Content`/`Set-Content` : accents abîmés, BOM, CRLF) → réécrit proprement ; à l'avenir, ne pas modifier ces fichiers via PowerShell.
- `next build` non lancé (serveur de dev actif sur `.next`) ; `tsc` + `lint` OK.

**Tests**
- Sans base : 89/89 (dont validation ligne par ligne : montant accordé, SOUMISE → VALIDATION_PARTIELLE → VALIDEE, correction avec recalcul du total demandé, retrait, tout retiré → REJETEE).
- En base, transaction annulée : 37/37 (dont lignes EN_ATTENTE par défaut, verrou de toutes les lignes, plafond de 7 000 sur une ligne ajustée, retrait → VALIDEE avec total recalculé, clôture qui retire les lignes non accordées) — `ROLLBACK` vérifié.

**À tester / points d'attention**
- Redémarrer `next dev` (nouveau moteur Prisma).
- Scénario manuel : budget de 3 lignes → accorder la 1re (statut « Validation partielle », Dépense possible dessus) ; ajuster la 2e (10 000 → 7 000, motif) ; demander une correction sur la 3e → le demandeur reçoit l'e-mail, voit le bandeau, modifie la ligne → elle revient « En attente » → l'accorder → budget « Validé ». Variante : le demandeur retire la ligne → budget « Validé » sans elle.
- « Tout valider » sur un budget dont une ligne est à corriger → refusé avec message ; « Rejeter » refusé si des dépenses ont déjà été faites en validation partielle.
- Le valideur d'une ligne ne peut pas en enregistrer les dépenses (séparation des tâches, maintenant aussi au niveau de la ligne).

---

## 2026-11-14 (suite 2) — Budgets : tests, audit et corrections de sécurité (envois de fichiers, verrou de caisse)

**Demande / Contexte**
Tester les Lots 1 à 3 puis auditer le module budget. Aucune base de test locale (ni Docker ni Postgres sur le poste) : seule la base Supabase de production est disponible → tests sans base (base simulée en mémoire) et scénario réel en base **dans une transaction annulée** (accord de l'utilisateur). Corrections retenues par l'utilisateur : points 1 à 8 de l'audit ; le point 9 (demandeur ≠ payeur) n'est pas appliqué.

**Tests**
- `next build` : OK. Logique sans base : 71/71 (matrice de validation, seuils 80/100 %, règles par type, prévu/consommé/reste, dépassements, annulation, statuts, clôture automatique, unicité, noms de fichiers, mois acceptés). Scénario réel en base, transaction annulée : 27/27 (journal de caisse, solde insuffisant, paiement sur proforma, filtres de liste, dépassement, contre-écriture, marge neutralisée, exclusion au dashboard, clôture automatique, rapport) — `ROLLBACK` vérifié, journal de caisse inchangé. Les scripts de test sont dans le dossier temporaire de la session (non versionnés).
- Non testé ici : les écrans et les routes protégées par Clerk (pas de navigateur dans la session) → test manuel.

**Modifications apportées (corrections de l'audit)**
1. **Envois de fichiers** — nouveau `lib/uploadSecurity.ts` (`safeUploadFileName`, `assertAllowedUpload`, liste blanche pdf / images / Word / Excel / OpenDocument / csv / txt ; images seules pour les photos produit et le logo). Faille vérifiée : un nom `../../../x` était écrit hors du dossier d'upload, et un `.html` pouvait être envoyé puis ouvert dans l'aperçu (iframe, même origine). Appliqué à **tous** les envois : `lib/uploadDemandeBudget.ts`, `uploadFournisseurDocument.ts`, `uploadProduitFournisseur.ts`, `uploadFactureFournisseur.ts`, routes `cash-journal/[id]/upload`, `factures/[id]/paiements` (+ `upload-proof`), `factures/[id]/upload`, `entreprise/logo`. Contrôle fait **avant** toute écriture en base là où le fichier était enregistré après (paiement proforma, création / re-soumission de demande via `assertTypedAttachmentsAllowed`, création de produit fournisseur) : un fichier refusé ne laisse jamais un paiement ou une demande à moitié enregistré (sinon risque de double saisie). Refus → 400 avec message.
2. **Verrou de caisse** — `lockCashRegister` (`SELECT … FOR UPDATE`) dans `lib/cashJournal.ts`, appelé par `recordCashMovement`, `recordCashDepense` (avant la lecture du solde), les transferts entre caisses (deux caisses, par id croissant) et l'encaissement d'une proforma. Deux écritures simultanées sur une même caisse ne peuvent plus partir du même solde.
3. Un admin **demandeur d'un budget** ne peut plus approuver les dépassements de ce budget (serveur + interface).
4. Un budget mensuel ne peut viser qu'un mois en cours ou à venir (ou le mois précédent pendant les 5 jours de grâce) — `moisMensuelAccepte` dans `lib/budgetSchema.ts`, `min` sur le sélecteur de mois.
5. À la clôture (manuelle ou automatique), les dépassements en attente sont refusés automatiquement (« Budget clôturé »), avec trace — `refuserDepassementsEnAttente`.
6. Date de dépense bornée : pas dans le futur, pas avant la validation du budget (tolérance 1 jour).
7. `GET /api/cash-registers` réservé au comptable (droit « Enregistrer les dépenses ») ou à la section Finance ; client Prisma partagé au lieu d'un `new PrismaClient()`.
8. Numérotation `DB-AAAA-NNNN` : plus grand numéro de l'année + 1 (au lieu d'un comptage) et nouvel essai en cas de collision (P2002).

**Erreurs rencontrées & solutions**
- ⚠️ **Incident local** : la 2e compilation `next build` de la journée a **vidé des paquets de `node_modules`** (`next`, `react`, `react-dom`, `typescript`…). Cause : avec `output: "standalone"` sous Windows + pnpm, `.next/standalone/node_modules` contient des **liens symboliques vers les vrais paquets**, et le nettoyage de `.next` au début d'une compilation les a suivis. Réparé par `pnpm install --frozen-lockfile --force` (rien retéléchargé, magasin pnpm intact), puis `.next/standalone` supprimé avec `cmd /c rmdir /s /q` (supprime les liens sans toucher aux cibles — vérifié sur un dossier de test). Sans effet sur le VPS (Linux).
- Scripts de modification : `\s` perdu dans un heredoc bash → scripts placés dans des fichiers ; tous les remplacements « tout ou rien » (aucun fichier écrit si un motif manque).
- `pnpm install` : EPERM tant que le dossier courant de la session était dans le paquet à réinstaller.

**À tester / points d'attention**
- **En local, ne jamais relancer `next build` sans d'abord supprimer `.next\standalone` avec `cmd /c rmdir /s /q .next\standalone`**, sinon les paquets sont de nouveau vidés.
- Envoyer un PDF / une photo comme justificatif → accepté ; un `.html` ou `.svg` → refusé avec message clair, sans demande ni paiement créé.
- Encaissements et dépenses : fonctionnement inchangé ; deux opérations simultanées sur la même caisse passent l'une après l'autre.
- Fichiers déjà envoyés avant la correction : non modifiés (contrôle à faire manuellement si besoin dans `public/Upload`).
- Recommandations non appliquées : demandeur ≠ payeur (point 9), plafond ou alerte sur les dépenses sans justificatif (10), accès au rapport sans la page Tableau de bord (11).

---

## 2026-11-14 (suite) — Budgets : reconduction, unicité et clôture des mensuels, catégories, rapport de suivi (Lot 3)

**Demande / Contexte**
Dernier lot du plan budget : faciliter l'élaboration des budgets (reprendre le mois précédent), empêcher les doublons de budget mensuel, clôturer automatiquement les mensuels en fin de mois, normaliser les catégories de dépense et offrir un rapport « prévu vs réalisé » dans Rapports.

**Modifications apportées**
- `prisma/schema.prisma` + migration `20261114100000_budget_categories_depense` (appliquée) : enum `CategorieDepense` (carburant, transport, loyer & charges, téléphone & internet, fournitures, équipement, entretien, impression, prestations, personnel, restauration, autre) et `DemandeBudgetLigne.categorie` (nullable : les lignes existantes restent « Non catégorisé »).
- `lib/budgetTypes.ts` : libellés des catégories (`CATEGORIE_DEPENSE_LABELS`, `categorieLabel`). `lib/budgetSchema.ts` : catégorie **obligatoire** sur chaque ligne d'une nouvelle demande ou d'une re-soumission.
- `lib/budgetSuivi.ts` :
  - `budgetMensuelExistant` : un seul budget mensuel par service et par mois (les demandes rejetées ne comptent pas) → 409 à la création ou à la re-soumission, avec le numéro du budget existant ;
  - `cloturerBudgetsMensuelsEchus` : clôture des mensuels VALIDEE/EN_COURS dont le mois est fini depuis plus de **5 jours** (`JOURS_GRACE_CLOTURE_MENSUELLE`, laisse le temps de saisir les derniers reçus), journalisée dans l'historique (« Clôture automatique »). Idempotente (`updateMany` conditionnel) ; déclenchée à l'ouverture de la liste des budgets et avant chaque dépense.
- Nouvelle route `POST /api/integration/budgets/cloture-mensuelle` (clé `INTEGRATION_API_KEY`, déjà exclue de Clerk) : même clôture, à appeler par une tâche planifiée quotidienne si on veut ne pas dépendre de l'ouverture de la liste.
- Reconduction : `GET /api/demandes-budget/[id]/reconduction` renvoie les données de préremplissage (mêmes lignes et catégories, mois suivant pour un mensuel, proformas non reprises pour une campagne) et, pour chaque ligne, le prévu / plafond / réalisé du budget d'origine. Page `budget/nouvelle-demande?depuis=<id>` (boundary `Suspense` pour `useSearchParams`) ; bouton « Reconduire au mois suivant » (mensuel) / « Dupliquer » (autres types) sur la fiche. La nouvelle demande repasse par le circuit normal de validation.
- Formulaire : colonne « Catégorie » par ligne ; en reconduction, rappel « Précédent : X prévu, Y dépensé » sous chaque montant (en orange si le dépensé a dépassé le prévu).
- Rapport « Suivi budgétaire » (`/dashboard/rapports/suivi-budgetaire`, carte dans Rapports à la place de « Frais supplémentaires — bientôt ») : API `GET /api/rapports/suivi-budgetaire` (réservée aux rôles du circuit budget), filtres mois début/fin (6 derniers mois par défaut), type, service, catégorie ; indicateurs prévu / réalisé / écart / taux ; graphique prévu vs réalisé par mois ; tableaux par service et par catégorie ; détail ligne à ligne ; export Excel 4 onglets (par mois, par service, par catégorie, détail).

**Erreurs rencontrées & solutions**
- `zod` v4 : `nativeEnum(…, { errorMap })` n'existe plus → `{ message }`.
- Scripts de modification : fichiers en CRLF, les motifs multi-lignes ne correspondaient pas → normalisation `\r\n` ↔ `\n` avant/après remplacement.

**À tester / points d'attention**
- Créer un 2e budget mensuel pour le même service et le même mois → refus avec le numéro de l'existant.
- Reconduire un mensuel d'octobre → formulaire prérempli pour novembre, avec le dépensé d'octobre rappelé sous chaque ligne.
- Un mensuel d'octobre encore ouvert le 6 novembre → clôturé à l'ouverture de la liste, entrée « Clôture automatique » dans son historique ; une dépense sur ce budget est alors refusée.
- Rapport : vérifier les totaux par service / catégorie et l'export Excel. Les budgets payés avec l'ancien circuit sont comptés avec réalisé = prévu (signalé dans le rapport).
- Re-soumettre une ancienne demande rejetée impose désormais de choisir une catégorie par ligne.
- Optionnel : planifier l'appel quotidien de `/api/integration/budgets/cloture-mensuelle` sur le serveur.

---

## 2026-11-14 — Budgets : dépassements, journal d'audit, annulation par contre-écriture, alertes (Lot 2)

**Demande / Contexte**
Suite du plan budget : quand une ligne est épuisée, pouvoir demander un dépassement approuvé par l'admin ; tracer chaque action (qui, quand, quoi) ; séparer les tâches (qui valide un budget n'en enregistre pas les dépenses) ; annuler une dépense sans jamais la supprimer ; alerter à 80 % et 100 % de consommation d'une ligne. Code écrit le 2026-11-10 et commité sur la branche `feature/budgets` (`99c9572`), migration appliquée et vérifiée le 2026-11-14.

**Modifications apportées**
- `prisma/schema.prisma` + migration `20261110150000_budget_depassements_historique_annulation` :
  - modèles `BudgetDepassement` (ligne, montant, motif, statut EN_ATTENTE/APPROUVE/REJETE, demandeur, décideur) et `BudgetHistorique` (journal d'audit, enum `ActionBudget`) ;
  - `BudgetDepense` : `annuleeAt`, `annuleeParEmail`, `motifAnnulation`, `contreEcritureId` (2e relation vers `CashJournal`, d'où les relations nommées `BudgetDepenseEcriture` / `BudgetDepenseContreEcriture`) ;
  - reprise SQL de l'historique des demandes existantes (création, validation, rejet, dépenses, clôture, ancien circuit « payée »).
- `lib/budgetSuivi.ts` (nouveau) : `getLigneDisponible` (plafond = prévu + dépassements approuvés, consommé = dépenses non annulées — jamais stockés), `getBudgetTotaux`, `recalculerStatutBudget` (VALIDEE / EN_COURS / PAYEE, ne rouvre jamais un budget clôturé ni une demande de l'ancien circuit), `logBudget`, `seuilsFranchis` (80/100 %).
- API :
  - `[id]/depenses` : contrôle du reste sur le plafond avec dépassements, refus si l'utilisateur a validé ce budget, écriture au journal d'audit, alertes email 80/100 % hors transaction ;
  - `[id]/depenses/[depenseId]/annuler` (nouveau, admin) : contre-écriture RECETTE dans la même caisse, Paiement DEPENSE négatif **sans écriture de caisse** sur la proforma (neutralise la marge sans être compté comme CA), dépense marquée annulée, statut recalculé ;
  - `[id]/depassements` (nouveau, comptable ou demandeur, une seule demande en attente par ligne) et `[id]/depassements/[depassementId]/decider` (nouveau, admin, jamais sur sa propre demande de dépassement) ;
  - journal d'audit ajouté à création, re-soumission (les commentaires des lignes recréées y sont recopiés pour ne pas être perdus), validation, rejet, clôture, documents, justificatif ;
  - liste : plafond effectif, consommé hors annulations, compteur et filtre « dépassement en attente ».
- Reporting : `lib/dashboardReporting.ts` (`BUDGET_ANNULATION_SELECT`, `isEcritureBudgetAnnulee`) appliqué à `app/api/dashboard/route.ts` et au rapport hebdomadaire — une dépense annulée et sa contre-écriture sont exclues des « Dépenses » et des « Autres mouvements ». La courbe du solde réel n'est pas touchée (le couple s'y annule naturellement).
- E-mails (`lib/email/demandeBudget.ts`) : demande de dépassement (admins), décision (demandeur du dépassement + du budget), alerte de consommation (demandeur + admins), dépense annulée (demandeur + comptables).
- UI : fiche budget (plafond avec dépassements, boutons Dépense / Dépassement par ligne, carte Dépassements avec Approuver/Refuser, dépenses annulées barrées avec motif et n° de contre-écriture, bouton Annuler pour l'admin, carte Historique), liste (barre sur le plafond effectif, filtre). Composants `components/budget/BudgetDepassementDialog`, `BudgetDepassementsCard`, `BudgetAnnulationDialog`, `BudgetHistoriqueCard`.

**Erreurs rencontrées & solutions**
- `prisma migrate dev --create-only` refuse de tourner en non-interactif à cause de l'avertissement d'index unique → SQL généré avec `prisma migrate diff --from-schema-datasource … --to-schema-datamodel … --script`, puis réécrit sans BOM (PowerShell `Out-File` en ajoute un).
- Supabase injoignable (P1001) au moment du déploiement de la migration → appliquée ensuite ; `migrate status` confirme « Database schema is up to date ».
- Le 2026-11-11, le travail était sur `feature/budgets` mais la session a repris sur `review_code` (commits « REBUILD »), où les fichiers budget semblaient avoir disparu → rien de perdu, retour sur `feature/budgets`. ⚠️ Cette branche n'est pas encore fusionnée dans `review_code` / `develop` / `main` : le code déployé en production n'a pas les budgets, alors que la base partagée a déjà les deux migrations (sans conséquence : Prisma ignore les colonnes et tables qu'il ne connaît pas).

**À tester / points d'attention**
- **Rôles toujours pas configurés** (vérifié le 2026-11-14) : « ASSISTANT » n'a aucune case budget, et aucun rôle n'a « Enregistrer les dépenses » → personne ne peut enregistrer de dépense tant qu'un rôle Comptable n'est pas créé et coché.
- Scénarios : ligne de 10 000 consommée à 8 000 → alerte 80 % ; à 10 000 → alerte 100 % et bouton Dépense grisé ; demande de dépassement de 3 000 → l'admin approuve → reste 3 000, statut repasse EN_COURS ; un admin ne peut pas approuver son propre dépassement ; annulation d'une dépense sur un budget Campagne → recette compensatoire dans la caisse, paiement négatif dans la proforma, marge du dashboard revenue à l'état d'avant ; dépense refusée pour l'utilisateur qui a validé le budget.
- Le Paiement négatif d'annulation apparaît dans la liste des paiements de la proforma : vérifier que l'affichage du montant négatif y reste lisible.

---

## 2026-11-10 — Budgets : types, suivi par ligne lié au journal de caisse, droits par rôle (Lot 1)

**Demande / Contexte**
Refonte du module budget : distinguer des types de budget (mensuel par service, ponctuel, campagne, tiers), suivre la consommation ligne par ligne (ex. essence prévu 10 000, utilisé 5 000 → reste 5 000), lier chaque dépense au journal de caisse avec choix de la caisse, permettre à l'admin et au comptable de commenter les lignes, et ajouter un niveau de validation « Assistant-Direction » (tout sauf les budgets mensuels, sous un plafond). Plan validé en 3 lots ; ce lot = socle. Lots 2 (dépassements, journal d'audit, annulation par contre-écriture, alertes 80/100 %) et 3 (reconduction mensuelle, rapport de suivi budgétaire) restent à faire.

**Modifications apportées**
- `prisma/schema.prisma` + migration `20261110103515_budget_types_depenses_commentaires` (appliquée) :
  - enum `TypeBudget` (MENSUEL, PONCTUEL, CAMPAGNE, TIERS) ; statut `EN_COURS` ; `DemandeBudget.type` (défaut PONCTUEL pour l'existant), `periodeMois`, `clotureeAt`, `clotureeParEmail` ;
  - nouveaux modèles `BudgetDepense` (dépense réelle sur une ligne, `cashJournalEntryId` unique → toujours une écriture de caisse, `invoiceId` si budget lié à une proforma, `sansJustificatif` + motif) et `BudgetCommentaire` (par ligne) ; `DemandeBudgetAttachment.depenseId` ;
  - `Role.canValidateBudgetMensuel` / `canValidateBudget` / `canPayBudget` ; `EntrepriseConfig.plafondValidationDeleguee` (défaut 500 000) ;
  - reprise : les rôles `canManageUsers` reçoivent les deux droits de validation.
- `lib/budgetAuth.ts` réécrit : droits lus sur le rôle en base (`getBudgetCapabilities`), matrice `refusValidation` (mensuel ou > plafond → admin ; sinon validation déléguée ; jamais sa propre demande), `getBudgetRecipients` pour les emails. **Les variables `BUDGET_ADMIN_EMAILS` / `BUDGET_COMPTABLE_EMAILS` ne sont plus lues** (y compris `lib/email/commandeFournisseur.ts`).
- `lib/paiements.ts` : nouvelle `recordCashDepense` (contrôle de solde + `recordCashMovement` existant) ; `recordDepensePaiement` s'appuie dessus (comportement inchangé).
- `lib/budgetSchema.ts` (validation partagée création / re-soumission, règles par type) ; `lib/budgetTypes.ts` (libellés client).
- API : `demandes-budget` (GET filtres type/mois/sans justificatif + consommé ; POST type), `[id]` (dépenses, commentaires), `valider` / `rejeter` (matrice), `resoumettre`, `me-role` (capacités ; `isAdmin`/`isComptable` gardés pour les écrans fournisseurs), `documents` (justificatif ajouté après coup via `depenseId`) ; nouvelles routes `[id]/depenses` (transaction : verrou de ligne, contrôle du reste, écriture de caisse, paiement DEPENSE sur la proforma si liée, statut EN_COURS/PAYEE), `[id]/cloturer`, `[id]/commentaires` (ouverture réservée admin/comptable, réponses ensuite), `budget-config` (plafond, admins uniquement), `GET /api/cash-registers`. Route `[id]/payer` supprimée.
- UI : `DemandeBudgetForm` (choix du type, mois, règles), liste `budget/demandes` (type, filtres, barre consommé, compteur sans justificatif), fiche `budget/demandes/[id]` (prévu/consommé/reste par ligne, bouton Dépense, historique des dépenses avec pastille Justifiée / Sans justificatif, commentaires par ligne, clôture, validation selon la matrice), page Rôles (3 cases « Circuit budget » + plafond), nouveaux composants `components/budget/*`, badge `EN_COURS`.

**Erreurs rencontrées & solutions**
- `prisma migrate dev` : Supabase injoignable (P1001) juste après la création du fichier de migration → migration appliquée ensuite avec `prisma migrate deploy`.
- `prisma generate` : EPERM sur le moteur (DLL verrouillée par le serveur `next dev`) ; les types TypeScript ont bien été régénérés. **Redémarrer `next dev`** (puis `npx prisma generate`) pour charger le nouveau client.
- `tsc` : `getCurrentUserIdentity` encore utilisé par `app/api/fournisseurs/commandes/[commandeId]/route.ts` → conservé dans `lib/budgetAuth.ts`.
- Écart au plan : le plafond est réglé dans la page Rôles (route protégée `requireCanManageUsers`) plutôt que dans Paramètres entreprise, dont la route `PUT /api/entreprise` n'a aucun contrôle d'accès.

**À tester / points d'attention**
- **Configuration à faire dans Paramètres > Rôles avant usage** : il n'existe que 2 rôles (« Admin », 5 utilisateurs, et « ASSISTANT », 1 utilisateur). Cocher « Valider les budgets (hors mensuels) » sur ASSISTANT ; le comptable est dans le rôle Admin → créer un rôle « Comptable » avec « Enregistrer les dépenses » (sinon personne ne peut enregistrer de dépense, ou les 5 admins le pourraient). Un email de l'ancien `BUDGET_ADMIN_EMAILS` n'a pas de compte `User` : il n'a plus de droit budget.
- Scénarios : Assistant valide un ponctuel sous le plafond, refusé sur un mensuel / au-dessus du plafond / sa propre demande ; dépense 5 000 sur une ligne de 10 000 → reste 5 000, écriture DEPENSE dans la caisse choisie ; 6 000 ensuite refusé ; budget CAMPAGNE → dépense visible dans la proforma ; dépense sans fichier ni case cochée refusée ; commentaire impossible à ouvrir pour un demandeur.
- Non-régression : dépense sur proforma depuis `/facture/[id]` (refactor `recordCashDepense`).
- Les anciennes demandes PAYEE (ancien circuit) n'ont pas de dépenses : la fiche affiche leurs date/receveur comme avant.

---

## 2026-11-10 — Dashboard : "Recettes" basées uniquement sur les paiements de proforma

**Demande / Contexte**
L'utilisateur a signalé que les "Recettes" affichées sur le dashboard (StatCard, graphiques "Ce mois"/"Général", rapport trésorerie hebdomadaire) mélangeaient les vrais paiements de proforma avec les apports de caisse et les transferts entre caisses — faussant la lecture du chiffre d'affaires réel. Décisions confirmées : appliquer le filtre partout de façon cohérente (StatCard + graphiques + tableau "Lignes d'entrée"), garder une ligne distincte "Autres mouvements de caisse" pour la transparence, et laisser les "Dépenses" inchangées (pas de notion de CA côté dépenses).

**Diagnostic & solution**
Chaque ligne `CashJournal` créée pour un vrai paiement de proforma porte un lien `paiement.invoice` (via `recordPaiement`/l'ancienne logique inline). Les apports de caisse et les transferts n'ont jamais ce lien. La présence de `paiement.invoice` est donc un critère fiable et suffisant pour isoler le CA réel — plus robuste que l'ancienne détection par regex sur le libellé (`isInternalTransferIn`), qui ne couvrait que les transferts entre deux caisses toutes deux "visibles" et laissait passer apports et transferts non détectés.

**Modifications apportées**
- [app/api/dashboard/route.ts](app/api/dashboard/route.ts) : `getMonthView` et `getMonthlyEvolution` — le calcul des "recettes" (lignes, totaux, buckets jour/mois, détail du dialog au clic) ne retient plus que les `CashJournal` de type RECETTE avec `paiement.invoice` non nul. Les lignes RECETTE restantes (apports, transferts) sont désormais comptabilisées à part dans un nouveau total `autresMouvementsTotal` (+ `autresMouvementsLines` côté "Ce mois"), retourné par l'API. Import `isInternalTransferIn` retiré (devenu inutilisé pour les recettes ; `isInternalTransferOut` reste utilisé côté dépenses, inchangé).
- [app/api/rapports/tresorerie-hebdomadaire/route.ts](app/api/rapports/tresorerie-hebdomadaire/route.ts) : même traitement, `autresMouvementsTotal` ajouté à la réponse.
- [app/(main)/dashboard/page.tsx](app/(main)/dashboard/page.tsx) : onglet "Ce mois" — nouvelle 4e StatCard "Autres mouvements de caisse" (grille passée de 3 à 4 colonnes), sous-titre ajouté sur "Entrées du mois" précisant "CA réel, hors apports/transferts". Onglet "Général" — ligne d'info sous le graphique "Évolution CA vs Dépenses" affichant le total des autres mouvements sur 12 mois.
- [app/(main)/dashboard/rapports/tresorerie-hebdomadaire/page.tsx](app/(main)/dashboard/rapports/tresorerie-hebdomadaire/page.tsx) : même ligne d'info sous le graphique.
- `CashJournalLinesCard`/`MonthlyFluctuationChart`/`GlobalEvolutionChart`/`WeeklyTreasuryChart` : aucun changement de code nécessaire — ils affichent simplement les données déjà filtrées en amont par l'API.

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit` et `next lint` propres.

**À tester / points d'attention**
- Comparer "Entrées du mois" avant/après sur un mois contenant un apport de caisse connu : le montant doit baisser exactement du montant de l'apport, qui doit apparaître dans la nouvelle StatCard "Autres mouvements de caisse".
- Vérifier que le graphique "Évolution de la trésorerie (12 derniers mois)" (solde réel) n'a PAS changé — il doit continuer à inclure tous les mouvements (apports/transferts), sinon le solde reconstitué ne correspondrait plus aux caisses réelles.
- Vérifier que "Lignes d'entrée" (Ce mois) ne liste plus que des lignes avec un client — les apports de caisse n'y apparaissent plus (déplacés conceptuellement vers "Autres mouvements de caisse", visibles en détail uniquement dans /journal-caisse).
- "Dépenses" volontairement inchangées (toujours tous les décaissements réels, loyer/salaires inclus) — pas de régression attendue de ce côté.

---

## 2026-11-09 (suite 2) — Sidebar : section "Dashboard" dépliable (Tableau de bord + Rapports)

**Demande / Contexte**
L'utilisateur a demandé que "Tableau de bord" et "Rapports" soient regroupés dans une vraie section dépliable de la sidebar, sur le modèle de la section "Proforma" (qui regroupe "Facture proforma"/"Nouvelle Facture" sous un en-tête cliquable avec chevron), plutôt que deux liens affichés à plat sans regroupement visuel. Il a aussi demandé que ce regroupement soit pris en compte dans la gestion des pages/rôles.

**Modifications apportées**
- [components/app-sidebar.tsx](components/app-sidebar.tsx) : le bloc `dashboard` (jusque-là un `<SidebarMenu>` à plat avec un style de lien ad hoc, différent du reste de la sidebar) est remplacé par un `Collapsible` "Dashboard" (icône `BarChart`, chevron rotatif), contenant "Tableau de bord" et "Rapports" rendus via le composant `NavLink` déjà utilisé par toutes les autres sections (Proforma, Client, Fournisseurs, etc.) — cohérence visuelle et suppression d'un style en doublon. Variable `pathname` locale à `AppSidebar` supprimée (devenue inutilisée, `NavLink` gère son propre `usePathname()`).
- [lib/permissions.ts](lib/permissions.ts) : libellé de la clé de permission `dashboard` (utilisé dans l'écran `/parametres/roles`) précisé de "Tableau de bord" à "Tableau de bord & Rapports", pour que les administrateurs comprennent que cette unique case à cocher couvre aussi `/dashboard/rapports`. Aucun nouveau `PageKey` nécessaire : `resolvePageKeyFromPathname` fait déjà correspondre tout chemin commençant par `/dashboard` (donc `/dashboard/rapports` inclus) à la clé `dashboard` existante — le contrôle d'accès fonctionnait déjà correctement pour la nouvelle page, seul le libellé manquait de clarté.

**Erreurs rencontrées & solutions**
- `next lint` a signalé `pathname` inutilisée dans `AppSidebar` après le remplacement du bloc dashboard par `NavLink` — supprimée.

**À tester / points d'attention**
- Vérifier visuellement que la section "Dashboard" se déplie/replie comme "Proforma", et que "Tableau de bord"/"Rapports" sont bien surlignés comme actifs sur leurs pages respectives.
- Dans `/parametres/roles`, vérifier que le nouveau libellé "Tableau de bord & Rapports" s'affiche correctement pour la case existante (pas de nouvelle case créée).
- Point de nuance à garder en tête (pas un bug) : la carte "Statistique proforma" dans Rapports pointe vers `/statistiques`, qui reste gérée par la permission "proforma" (pas "dashboard") — un rôle avec "dashboard" mais sans "proforma" verrait la carte mais pas la page derrière.

---

## 2026-11-09 (suite) — Page Statistiques déplacée vers le dashboard, renommée "Statistique proforma"

**Demande / Contexte**
L'utilisateur a demandé de déplacer la page `/statistiques` (jusque-là accessible depuis le menu "Facture proforma" de la sidebar) vers le dashboard, et de la renommer "Statistique proforma". Décisions confirmées : ajout d'une nouvelle carte active dans la page "Rapports" créée juste avant (plutôt qu'un nouvel onglet du dashboard), en conservant l'URL `/statistiques` inchangée (pas de redirection nécessaire).

**Modifications apportées**
- [components/app-sidebar.tsx](components/app-sidebar.tsx) : suppression de l'entrée "Statistiques" du menu "Facture proforma" (elle n'apparaît plus qu'via Dashboard → Rapports).
- [app/(main)/dashboard/rapports/page.tsx](app/(main)/dashboard/rapports/page.tsx) : nouvelle carte active "Statistique proforma" → `/statistiques`.
- [app/(main)/statistiques/page.tsx](app/(main)/statistiques/page.tsx) : titre `&lt;h1&gt;` corrigé de "Tableau de Bord" (copier-coller oublié, prêtait à confusion avec la vraie page `/dashboard`) à "Statistique proforma".

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit` et `next lint` propres.

**À tester / points d'attention**
- Vérifier que `/statistiques` reste accessible (URL inchangée) et s'affiche correctement, uniquement via la nouvelle carte dans Dashboard → Rapports.
- Vérifier qu'aucun autre lien interne ne pointait spécifiquement vers l'ancienne entrée de sidebar supprimée.

---

## 2026-11-09 — Nouvelle sous-page "Rapports" (dashboard) : premiers rapports filtrables/exportables

**Demande / Contexte**
L'administratrice a demandé, à partir de captures d'écran d'une autre app (POS retail) listant de nombreux types de rapports, une sous-page du dashboard avec des cartes cliquables : chacune doit ouvrir un rapport filtrable (période) et exportable, avec graphique si pertinent. Elle a aussi explicitement demandé un "tableau de trésorerie semaine par semaine". Une analyse de faisabilité complète a d'abord été faite (mapping carte par carte entre l'app de référence — retail, avec stock/étiquettes/démarque — et le modèle métier réel de Proforma qui n'a pas ces concepts), puis l'utilisateur a demandé de démarrer sans attendre d'autres précisions.

**Modifications apportées**
- [lib/dashboardReporting.ts](lib/dashboardReporting.ts) (nouveau) : extraction des types partagés (`DetailClient`, `RecetteDetailLine`, `DepenseDetailLine`, `ProformaValideeDetailLine`) et des helpers de détection de virements internes (`isInternalTransferIn`/`isInternalTransferOut`), auparavant déclarés localement dans `app/api/dashboard/route.ts` — permet de les réutiliser dans le nouveau rapport hebdomadaire sans dupliquer la logique.
- [app/api/dashboard/route.ts](app/api/dashboard/route.ts) : importe désormais ces types/helpers depuis `lib/dashboardReporting.ts` au lieu de les redéclarer (pur refactor, aucun changement de comportement).
- [app/api/rapports/tresorerie-hebdomadaire/route.ts](app/api/rapports/tresorerie-hebdomadaire/route.ts) (nouveau) : même logique que la vue "Ce mois" (par jour)/"Général" (par mois) du dashboard, mais agrégée par semaine (lundi-dimanche, `date-fns` `eachWeekOfInterval`/`startOfWeek`), sur une période personnalisable (`?from=&to=`, 12 dernières semaines par défaut) — recettes/dépenses réelles de caisse + proformas validées/payées/soldées (règle `dateValidation ?? dateCreation` déjà établie), avec le détail ligne par ligne par semaine pour le dialog au clic.
- [components/dashboard/WeeklyTreasuryChart.tsx](components/dashboard/WeeklyTreasuryChart.tsx) (nouveau) : graphique en barres groupées (3 séries, clic → `DashboardDetailDialog`), réutilise exactement le pattern de `MonthlyFluctuationChart`/`GlobalEvolutionChart`.
- [app/(main)/dashboard/rapports/tresorerie-hebdomadaire/page.tsx](app/(main)/dashboard/rapports/tresorerie-hebdomadaire/page.tsx) (nouveau) : page du rapport — filtre de période (Calendar/Popover, pattern repris de `journal-caisse/export`), graphique, tableau avec totaux, export Excel (`xlsx`).
- [app/(main)/journal-caisse/export/page.tsx](app/(main)/journal-caisse/export/page.tsx) : ajout d'un graphique "Flux recettes/dépenses sur la période" (bucketing par jour des lignes déjà filtrées côté client, recharts) — cette page couvrait déjà filtre + tableau + export, il ne manquait que le graphique pour devenir la carte "Transactions journalières".
- [app/(main)/dashboard/rapports/page.tsx](app/(main)/dashboard/rapports/page.tsx) (nouveau) : grille de 8 cartes cliquables. 2 actives (Transactions journalières → `/journal-caisse/export`, Trésorerie hebdomadaire → nouvelle page) et 6 marquées "Bientôt disponible" (Ventes à percevoir, Achats fournisseurs, Frais supplémentaires, Rapport employés, Top produits & clients, Campagnes en cours) représentant la suite du périmètre analysé mais pas encore construite.
- [components/app-sidebar.tsx](components/app-sidebar.tsx) : nouvelle entrée "Rapports" dans la section Dashboard, sous "Tableau de bors", même permission (`canSeePage("dashboard", true)`).

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit` et `next lint` propres.

**À tester / points d'attention**
- Vérifier que la page `/journal-caisse/export` s'affiche toujours correctement (non-régression) avec le nouveau graphique.
- Tester `/dashboard/rapports/tresorerie-hebdomadaire` : changer la période, vérifier le tableau/graphique/export, et le clic sur chaque barre (dialog avec client/proforma cliquables).
- Les 6 cartes "Bientôt disponible" sont volontairement non cliquables — à construire une par une sur demande, selon la priorité de l'utilisateur (analyse détaillée de faisabilité déjà faite pour chacune, voir échange précédent dans la conversation).
- "Campagnes en cours" dépend d'un appel réseau par proforma vers l'API Camptrack (`getCampagnesForProforma`) — prévoir de limiter le nombre de proformas interrogées en attendant un futur endpoint de liste groupée côté Camptrack.

---

## 2026-11-05 (suite) — Dashboard "Général" : graphique "Évolution CA vs Dépenses" (12 mois) + détail cliquable

**Demande / Contexte**
L'utilisateur a demandé, en plus de la 3e barre ajoutée à l'onglet "Ce mois" (entrée précédente), un graphique équivalent sur l'onglet "Général" du dashboard : un "Évolution CA vs Dépenses" agrégé par mois (pas par jour) sur les 12 derniers mois, avec les recettes réelles de caisse, les dépenses réelles de caisse, et le montant des proformas validées/payées/soldées par mois. Première version livrée sans clic-détail (non demandé explicitement) ; l'utilisateur a ensuite confirmé qu'il voulait bien le même clic-détail (client/proforma) que sur la barre "Ce mois", ici aussi.

**Modifications apportées**
- [app/api/dashboard/route.ts](app/api/dashboard/route.ts) :
  - Interfaces `DetailClient`/`RecetteDetailLine`/`DepenseDetailLine`/`ProformaValideeDetailLine` remontées au niveau du module (étaient locales à `getMonthView`) pour être réutilisées aussi par `getMonthlyEvolution`.
  - `getTresorerieSnapshot` : la requête `entries13Mois` inclut désormais `id`, `cashRegister.name` et la chaîne `paiement.invoice.{resteAPayer, client}` (comme `monthEntries` dans `getMonthView`), nécessaire pour construire le détail cliquable par mois.
  - `getMonthlyEvolution(now, entries13Mois, visibleIdsSet)` : construit désormais, en plus des sommes mensuelles, le détail ligne par ligne (`recettesDetail`/`depensesDetail`/`proformasValideesDetail`, avec client et reste à payer pour les recettes) pour chaque mois, ainsi qu'un `monthLabel` ("novembre 2026") utilisé comme titre du dialog.
- [components/dashboard/DashboardDetailDialog.tsx](components/dashboard/DashboardDetailDialog.tsx) : généralisé pour accepter un `periodLabel` déjà formaté (au lieu de calculer un format "jour" en interne) — fonctionne maintenant aussi bien pour une barre "jour" (Ce mois) qu'une barre "mois" (Général). Message "Aucune ligne ce jour-là" généralisé en "Aucune ligne sur cette période".
- [components/dashboard/MonthlyFluctuationChart.tsx](components/dashboard/MonthlyFluctuationChart.tsx) : adapté pour calculer et passer `periodLabel` (date du jour formatée) au lieu du champ `date` brut.
- [components/dashboard/GlobalEvolutionChart.tsx](components/dashboard/GlobalEvolutionChart.tsx) : ajout du `onClick` par barre (comme `MonthlyFluctuationChart`) et rendu de `DashboardDetailDialog`, réutilisant exactement le même composant/les mêmes types que la barre "Ce mois".
- [app/(main)/dashboard/page.tsx](app/(main)/dashboard/page.tsx) : ajout de `monthlyEvolution` au type `GlobalData`, et rendu de `<GlobalEvolutionChart>` juste après le graphique "Évolution de la trésorerie" existant, dans l'onglet "Général".

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit` et `next lint` propres.

**À tester / points d'attention**
- Vérifier que les totaux mensuels de recettes/dépenses correspondent à ceux visibles ailleurs (ex. journal de caisse) pour quelques mois passés.
- Cliquer chacune des 3 barres d'un mois → vérifier le dialog (montant, liste, client cliquable vers `/client/{id}`, proforma cliquable vers `/facture/{id}`, reste à payer affiché uniquement pour les recettes).

---

## 2026-11-05 — Incident prod (migration manquante) + Dashboard : 3e barre "Proformas validées" avec détail cliquable

**Demande / Contexte**
Deux sujets traités dans la même session :
1. L'utilisateur a signalé une erreur en production (logs collés) lors de la création d'un bon de commande : `PrismaClientUnknownRequestError` / `22P03: incorrect binary data format in bind parameter 5`. Diagnostic : le commit de la veille (`quantite` `Int` → `Decimal`, voir entrée ci-dessous) était déjà déployé, mais la migration correspondante n'avait jamais pu être appliquée à la base Supabase (incident de connectivité documenté dans l'entrée précédente) — la colonne réelle était donc toujours `Int`, incompatible avec les valeurs `Decimal` envoyées par le code déployé. **Toute création de bon de commande était cassée en production.**
2. L'utilisateur a demandé d'ajouter, sur le tableau de bord admin (onglet "Ce mois"), une 3e barre au graphique Recettes/Dépenses représentant le montant des proformas validées dans le mois, avec un moyen de voir le détail (client, reste à payer) en interagissant avec chaque barre.

**Diagnostic & résolution de l'incident**
La base Supabase a été relancée par l'utilisateur en cours de session ; `npx prisma migrate deploy` échouait encore juste après (le pooler Supavisor met plus de temps à se resynchroniser que la base elle-même — erreurs `ENOTFOUND tenant/user ... not found` puis `P1001`), mais a fini par passer. La migration `20261104163341_quantite_decimal_commande_fournisseur`, en attente depuis la veille, a enfin été appliquée (en même temps que la nouvelle migration ci-dessous). Vérifié avec `npx prisma migrate status` → "Database schema is up to date!". Incident résolu.

**Modifications apportées (fonctionnalité dashboard)**
- [prisma/schema.prisma](prisma/schema.prisma) : nouveau champ `Invoice.dateValidation DateTime?` (nullable, pas de backfill possible — `historiqueModifications` n'a jamais été utilisé dans ce projet). Migration `20261105102511_add_date_validation_invoice` appliquée.
- [app/api/factures/[id]/route.ts](app/api/factures/[id]/route.ts) et [app/api/factures/[id]/upload/route.ts](app/api/factures/[id]/upload/route.ts) : `dateValidation` est désormais posée à `new Date()` au moment précis où le statut d'une proforma passe à `"Valider"` depuis un autre statut (dans les deux points d'entrée possibles de cette transition). Une proforma déjà validée, re-sauvegardée sans changer de statut, ne voit pas sa date réécrite.
- [app/api/dashboard/route.ts](app/api/dashboard/route.ts) (`getMonthView`) : nouvelle requête `prisma.invoice.findMany` ciblant les proformas aux statuts `Valider`/`Payer`/`Solde`, classées dans le mois via `dateValidation` si connue, sinon via `dateCreation` (cas des proformas validées avant l'ajout du champ). Le `dailyMap` par jour porte désormais, en plus des sommes `recettes`/`depenses`/`proformasValidees`, le détail ligne par ligne de chaque catégorie (`recettesDetail`/`depensesDetail`/`proformasValideesDetail`, avec client et — pour les recettes — le reste à payer de la proforma concernée) pour alimenter le nouveau dialog de détail.
- [components/dashboard/MonthlyFluctuationChart.tsx](components/dashboard/MonthlyFluctuationChart.tsx) : ajout d'une 3e barre "Proformas validées" (bleu `#3b82f6`), groupée à côté des 2 barres existantes (pas empilées). Chaque barre est désormais cliquable (`onClick` par série) et ouvre le nouveau dialog de détail plutôt qu'un simple survol (choix fait avec l'utilisateur : le survol seul ne permet pas des liens cliquables et ne fonctionne pas sur mobile).
- [components/dashboard/DashboardDetailDialog.tsx](components/dashboard/DashboardDetailDialog.tsx) (nouveau) : dialog affichant le montant total du jour pour la série cliquée et la liste des lignes concernées — client cliquable vers `/client/{id}` (même convention que `CashJournalLinesCard`), proforma cliquable vers `/facture/{id}`, reste à payer affiché uniquement pour les recettes.
- [app/(main)/dashboard/page.tsx](app/(main)/dashboard/page.tsx) : type `MonthData.fluctuation` mis à jour pour utiliser `DailyFluctuation` (importé du composant chart) au lieu du type inline précédent.

**Erreurs rencontrées & solutions**
Aucune côté code — `tsc --noEmit` et `next lint` propres. Côté infra : voir "Diagnostic & résolution de l'incident" ci-dessus.

**À tester / points d'attention**
- Valider une proforma aujourd'hui → vérifier qu'elle apparaît dans la barre bleue du jour avec son montant TTC, et que `dateValidation` est bien posée en base.
- Repérer une proforma déjà validée avant ce changement (donc `dateValidation` NULL) : doit apparaître dans le mois de sa `dateCreation`, pas disparaître.
- Cliquer chacune des 3 barres d'un jour avec des données → vérifier le contenu du dialog (montant, liste, liens client/proforma, reste à payer pour les recettes uniquement). Cliquer une barre à 0 ne fait rien (limite normale de Recharts, pas un bug).
- Sur une proforma qui repasse de "En Paiement"/"Soldée" à "Validée" (cas rare, via le script de recalcul), vérifier que `dateValidation` est bien ré-horodatée.

---

## 2026-11-04 (suite 3) — Upload de documents budget : échec sur mobile (fichiers volumineux)

**Demande / Contexte**
L'utilisateur a signalé que l'upload de documents dans le module "demandes de budget" fonctionne sans problème sur desktop, mais échoue sur mobile avec une erreur ressemblant à une erreur HTML.

**Diagnostic**
Aucune limite de taille de fichier n'était vérifiée ni côté client ni côté serveur pour les uploads du module budget, contrairement au module Fournisseurs (`components/fournisseurs/FournisseurDocuments.tsx` / `lib/uploadFournisseurDocument.ts`) qui applique déjà une limite de 10 Mo des deux côtés. Les photos prises à la caméra mobile (plusieurs Mo, parfois HEIC) dépassent probablement une limite du reverse-proxy du VPS (nginx `client_max_body_size`, non versionnée dans ce repo — déjà signalée comme hors de portée du code dans une entrée précédente de ce journal), qui renvoie alors une page d'erreur HTML (ex. 413) au lieu d'une réponse JSON. Le code frontend des 3 formulaires d'upload du module budget faisait `await res.json()` sur la réponse d'erreur sans vérifier le `content-type`, ce qui provoque une `SyntaxError` ("Unexpected token '<'...") en tentant de parser du HTML comme du JSON — correspondant exactement au symptôme "erreur HTML" décrit.

**Modifications apportées**
- [lib/uploadDemandeBudget.ts](lib/uploadDemandeBudget.ts) : ajout d'une limite de 10 Mo par fichier dans `saveDemandeBudgetFiles` (même convention que le module Fournisseurs), avec message d'erreur clair.
- [app/api/demandes-budget/route.ts](app/api/demandes-budget/route.ts), [app/api/demandes-budget/[id]/documents/route.ts](app/api/demandes-budget/[id]/documents/route.ts), [app/api/demandes-budget/[id]/payer/route.ts](app/api/demandes-budget/[id]/payer/route.ts), [app/api/demandes-budget/[id]/resoumettre/route.ts](app/api/demandes-budget/[id]/resoumettre/route.ts) : les blocs `catch` renvoyaient toujours "Erreur interne du serveur" pour toute erreur non-fs (donc auraient aussi masqué le nouveau message "fichier trop volumineux") — corrigés pour remonter `error.message` en plus de `describeFsError`, comme dans les routes Fournisseurs.
- [components/DemandeBudgetForm.tsx](components/DemandeBudgetForm.tsx), [components/DemandeBudgetAddDocumentsDialog.tsx](components/DemandeBudgetAddDocumentsDialog.tsx), [app/(main)/budget/demandes/[id]/page.tsx](app/(main)/budget/demandes/[id]/page.tsx) : ajout d'un contrôle de taille (10 Mo) au moment de la sélection du fichier (`toast.error` + réinitialisation de l'input si trop volumineux, avant même l'envoi réseau) sur les 3 inputs file concernés. Les 3 appels `await res.json()` sur une réponse en erreur vérifient désormais le `content-type` avant de parser, avec un message de repli explicite ("le fichier est peut-être trop volumineux") si la réponse n'est pas du JSON.

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit` et `next lint` propres.

**À tester / points d'attention**
- Tester sur mobile un upload avec une photo de plusieurs Mo : doit maintenant être bloqué immédiatement côté client avec un message clair ("dépasse la taille maximale autorisée (10 Mo)"), sans jamais atteindre le serveur.
- Si la limite réelle du reverse-proxy (nginx) est inférieure à 10 Mo, l'erreur HTML pourrait encore survenir pour des fichiers entre la limite nginx et 10 Mo — dans ce cas, le nouveau garde-fou content-type affichera au moins un message de repli compréhensible au lieu de planter silencieusement. À vérifier/ajuster la config nginx du VPS si le problème persiste sous 10 Mo.
- Le format HEIC (photos iPhone) n'est ni bloqué ni converti ; il est accepté tel quel (comme avant) — à surveiller si la prévisualisation de ces fichiers pose un problème distinct.

## 2026-11-04 (suite 2) — PDF du bon de commande : option d'inclure client/objet des proformas associées

**Demande / Contexte**
L'utilisateur a demandé à pouvoir afficher, pour chaque proforma associée à un bon de commande, le nom du client concerné et l'objet de la proforma — avec la possibilité de les masquer lors du téléchargement du PDF. L'affichage à l'écran (page de détail du bon de commande) montrait déjà ces deux informations ; seul le PDF (généré côté client avec `pdf-lib`) ne listait que les numéros de proforma, sans client ni objet, et sans aucune option de configuration.

**Modifications apportées**
- [app/(main)/fournisseur/[id]/commandes/[commandeId]/page.tsx](app/(main)/fournisseur/[id]/commandes/[commandeId]/page.tsx) :
  - `generatePDF` accepte désormais un 3ᵉ paramètre `{ includeClient, includeObjet }`. Le bloc "Proforma(s) associée(s)" liste maintenant une ligne par proforma (`NUMERO — Client · Objet`, les deux parties étant ajoutées seulement si leur option respective est activée et que la donnée existe), au lieu d'une seule ligne compacte listant juste les numéros.
  - Nouveaux states `includeClientPdf`/`includeObjetPdf` (par défaut tous les deux activés), passés à `generatePDF` depuis `handleDownloadPDF`.
  - Nouveau bouton d'options (icône `SlidersHorizontal`) à côté de "Télécharger PDF", visible uniquement s'il y a au moins une proforma associée : ouvre un `Popover` avec deux `Switch` ("Le client de la proforma associée" / "L'objet de la proforma associée") pour choisir ce qui doit apparaître dans le prochain PDF généré.

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit` et `next lint` propres.

**À tester / points d'attention**
- Télécharger le PDF d'un bon de commande ayant plusieurs proformas associées à des clients différents : vérifier que chaque ligne affiche le bon client/objet, et que désactiver un des deux interrupteurs le retire bien du PDF suivant.
- Vérifier le rendu quand une proforma associée n'a pas de client renseigné (ne doit pas planter, juste omettre cette partie de la ligne).
- Vérifier visuellement l'espacement du bloc "Proforma(s) associée(s)" dans le PDF avec un grand nombre de proformas associées (pas de gestion de saut de page dans ce générateur, comme avant).

## 2026-11-04 (suite) — Bon de commande : statut librement modifiable + champs Quantité/Mesure utilisables

**Demande / Contexte**
L'utilisateur a demandé que, sur les bons de commande fournisseur, le statut puisse être modifié librement (pas seulement par un admin), et a signalé un problème de saisie sur les champs Quantité/Mesure du formulaire de création (taper "50" ne gardait que "5", pas de décimales possibles, plafond apparent à 9).

**Modifications apportées**
- [components/fournisseurs/CommandeStatutControl.tsx](components/fournisseurs/CommandeStatutControl.tsx) : la règle `isAdmin && !isLocked` devient `!isLocked` — tout utilisateur (admin ou non) voit désormais le menu déroulant complet de statuts tant que le bon n'est pas `LIVREE`/`ANNULEE` (états finaux toujours verrouillés, comme avant). Suppression de la branche "Confirmer l'envoi" devenue inutile, et des imports (`Button`, `Send`) associés. La prop `isAdmin` reste dans l'interface (pour ne pas casser les 3 appelants) mais n'est plus utilisée pour cette logique.
- [app/api/fournisseurs/commandes/[commandeId]/route.ts](app/api/fournisseurs/commandes/[commandeId]/route.ts) : `PATCH` — suppression du blocage 403 "Seul un administrateur peut effectuer ce changement de statut" ; tout utilisateur authentifié peut désormais changer le statut. Import `isBudgetAdminEmail` retiré (plus utilisé dans ce fichier).
- Support des décimales pour "Quantité" (jusqu'ici entier, contrairement à Largeur/Hauteur déjà en `Decimal`) :
  - [prisma/schema.prisma](prisma/schema.prisma) : `LigneCommandeFournisseur.quantite` passe de `Int` à `Decimal @db.Decimal(10, 2)` (même convention que largeur/hauteur).
  - [app/api/fournisseurs/commandes/route.ts](app/api/fournisseurs/commandes/route.ts) et [app/api/fournisseurs/commandes/[commandeId]/route.ts](app/api/fournisseurs/commandes/[commandeId]/route.ts) : `quantite: z.number().int().min(1)` → `z.number().positive()` dans les deux schémas zod.
  - [lib/commandeFournisseurCalc.ts](lib/commandeFournisseurCalc.ts) : `computeLigne` enveloppe désormais `quantite` avec `Number(...)` avant les multiplications, par cohérence avec largeur/hauteur.
- Largeur d'affichage des champs numériques (trop étroits dans les modales, cause probable du symptôme "seul le premier chiffre reste visible/pris en compte") — dans les 3 formulaires [components/fournisseurs/NewCommandeForm.tsx](components/fournisseurs/NewCommandeForm.tsx), [components/CommandeFournisseurModal.tsx](components/CommandeFournisseurModal.tsx), [components/fournisseurs/EditCommandeFournisseurModal.tsx](components/fournisseurs/EditCommandeFournisseurModal.tsx) : ajout de `min-w-[70px]` sur l'input Qté et `min-w-[60px]` sur chacun des inputs L/H ; ajout de `step="0.01"` et `min="0.01"` (au lieu de `min="1"`) sur l'input Qté pour autoriser réellement la saisie de décimales.

**Erreurs rencontrées & solutions**
- `npx prisma migrate dev --name quantite_decimal_commande_fournisseur` a échoué de façon persistante (4 tentatives) : d'abord `FATAL: (ENOTFOUND) tenant/user ... not found`, puis `P1001: Can't reach database server at aws-0-eu-west-3.pooler.supabase.com:5432`. Contrairement à l'incident similaire déjà documenté plus haut (transitoire, résolu par une simple nouvelle tentative), celui-ci n'a pas pu être débloqué par retry — la base Supabase semble injoignable depuis cet environnement au moment de l'intervention. **La migration n'a donc pas pu être appliquée.**
- Contournement partiel : `npx prisma generate` (qui ne nécessite pas d'accès à la base, seulement au fichier `schema.prisma`) a été exécuté avec succès pour régénérer le client Prisma avec le nouveau type `Decimal`, ce qui a permis de vérifier que `npx tsc --noEmit` et `npx next lint` restent propres avec le code adapté.
- **Mise à jour 2026-11-05** : le code de ce changement étant déjà déployé en production sans la migration, toute création de bon de commande échouait réellement en prod (`22P03: incorrect binary data format in bind parameter 5`, confirmé par les logs serveur). Après redémarrage du projet Supabase par l'utilisateur, `npx prisma migrate dev --name quantite_decimal_commande_fournisseur` a enfin pu s'appliquer avec succès — voir l'entrée du jour pour les détails. Incident résolu.

**À tester / points d'attention**
- **IMPORTANT — action requise avant toute utilisation** : exécuter `npx prisma migrate dev` (ou `npx prisma migrate deploy` en production) dès que la base Supabase est de nouveau joignable, pour appliquer réellement le changement de colonne `quantite` (`Int` → `Decimal(10,2)`) en base. Sans cette migration, la base réelle a toujours une colonne `Int`, donc l'enregistrement d'une quantité décimale échouera encore côté serveur (erreur Prisma), même si le code applicatif est prêt.
- Une fois la migration appliquée : vérifier qu'une quantité décimale (ex. "2.5") se crée, s'affiche et se recharge correctement sur un bon de commande.
- Vérifier, en tant qu'utilisateur non-admin, qu'on peut désormais changer librement le statut d'un bon `BROUILLON`/`VALIDEE`, et que `LIVREE`/`ANNULEE` restent non modifiables.
- Vérifier que la saisie de "50" dans Qté (et dans L/H) fonctionne maintenant correctement visuellement, avec la largeur minimale ajoutée.

## 2026-11-04 — Correction : produit non pré-rempli lors de l'édition d'une proforma

**Demande / Contexte**
L'utilisateur a signalé que, lors de l'édition d'une proforma existante, la "désignation" d'une ligne de produit est bien pré-remplie, mais le sélecteur de produit (combobox) reste vide ("Sélectionner un produit") au lieu d'afficher le produit réellement associé.

**Cause identifiée**
Incohérence de nom de champ entre l'écriture et la lecture. Le champ Prisma de la clé étrangère produit sur `InvoiceProduit` s'appelle `productId` (`prisma/schema.prisma`). Les routes d'écriture (POST/PATCH) mappent correctement `produitId` (venant du client) vers `productId` (colonne Prisma). Mais `GET /api/factures/[id]` renvoyait l'objet Prisma brut, donc chaque ligne de `produits[]` n'exposait que `productId`, jamais `produitId` — alors que tout le frontend (type `Facture`, `ProduitCombobox value={p.produitId}`, filtre des produits inactifs) lit `produitId`. Résultat : le champ était `undefined` à la lecture, donc le combobox ne trouvait jamais de correspondance, bien que `designation` (même nom des deux côtés) s'affichait correctement.

**Modifications apportées**
- [app/api/factures/[id]/route.ts](app/api/factures/[id]/route.ts) : le handler `GET` mappe désormais chaque ligne de `produits` pour exposer `produitId` (alias de `productId`) avant de renvoyer la réponse JSON (`produits: facture.produits.map(p => ({ ...p, produitId: p.productId }))`).

**Erreurs rencontrées & solutions**
- `npx tsc --noEmit` a échoué avec `Cannot find module '.../typescript/bin/tsc'` (corruption connue de `node_modules` sur cette machine, déjà documentée plus haut dans cet historique) → résolu par `pnpm install --force`. Après réinstallation, `tsc --noEmit` et `next lint` sont propres.

**À tester / points d'attention**
- Ouvrir une proforma existante → "Modifier" → vérifier que chaque ligne de produit affiche bien le produit déjà sélectionné (et son prix), pas seulement la désignation.
- Vérifier aussi une ligne dont le produit a été désactivé depuis : il doit apparaître dans le combobox avec le badge "Inactif" au lieu d'être absent.
- Ce bug n'affectait que le mode édition (affichage du combobox) ; l'affichage en lecture seule (désignation, quantité, prix, montant) n'était pas impacté.

## 2026-11-02 — Produits en double autorisés sur une proforma + fiabilisation des toasts d'erreur

**Demande / Contexte**
L'utilisateur a signalé qu'il est actuellement impossible de sélectionner le même produit plusieurs fois lors de la création d'une proforma, et a demandé que ce soit désormais possible. Il a aussi demandé de revoir l'affichage des toasts d'erreur/succès, qui "ne s'affichent pas bien".

Analyse : aucune contrainte d'unicité en base (`InvoiceProduit` n'a pas de `@@unique([invoiceId, productId])`), et l'édition de facture n'imposait déjà aucune restriction — seule la création bloquait. Par ailleurs, le formulaire de création n'avait pas de callback d'erreur sur `handleSubmit` : toute validation zod échouée au niveau du tableau `produits` (dont l'ancien refine de doublon) restait **totalement silencieuse** pour l'utilisateur (aucun toast, aucun message visible) — c'est très probablement la cause du problème d'affichage des toasts signalé.

**Modifications apportées**
- [components/FactureForm.tsx](components/FactureForm.tsx) :
  - Suppression du `.refine()` qui empêchait les `produitId` dupliqués dans le schéma zod `produits` (garde uniquement `.min(1, "Au moins un produit est requis.")`).
  - Ajout d'un callback `onError` branché sur `handleSubmit(onSubmit, onError)` : affiche désormais un `toast.error(...)` dès qu'une validation du formulaire échoue (message spécifique du tableau `produits` si disponible, sinon message générique), pour que les erreurs ne soient plus jamais silencieuses.
- [app/api/factures/route.ts](app/api/factures/route.ts) (POST) : suppression du contrôle manuel `uniqueProduitIds` qui rejetait les produits dupliqués avec une erreur 400. Le contrôle "produitId requis pour chaque ligne" est conservé.
- [app/api/factures/[id]/route.ts](app/api/factures/[id]/route.ts) (PATCH) : en cas d'échec de validation zod, l'API renvoyait `{ error: validation.error.format() }` (objet imbriqué, pas une chaîne) — remplacé par `{ error: validation.error.issues.map(i => i.message).join(" ") }`, toujours une chaîne lisible exploitable par un toast.
- [app/(main)/facture/[id]/page.tsx](app/(main)/facture/[id]/page.tsx) : `handleUpdateFacture` affichait toujours un message générique figé ("Erreur lors de la mise à jour.") sans jamais lire le vrai message de l'API. Il lit désormais le corps JSON de la réponse d'erreur et affiche `data?.error` en priorité.

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit` propre ; vérification `next lint` en cours.

**À tester / points d'attention**
- Création de proforma : ajouter deux fois le même produit → la soumission doit désormais réussir.
- Création de proforma : soumettre sans aucune ligne de produit → un toast d'erreur clair doit apparaître (auparavant silencieux).
- Édition de facture : provoquer un échec de sauvegarde et vérifier que le toast affiche le vrai message d'erreur de l'API plutôt que le texte générique.
- Hors périmètre, signalé mais non traité : `components/AddEntryModal.tsx` (page journal-caisse) monte un second `<Toaster richColors />` en plus du Toaster global — doublon potentiel sur cette page précise, à corriger séparément si besoin.

## 2026-10-26 — Colonne "Client" sur les tableaux "Lignes d'entrée/sortie" du dashboard (onglet "Ce mois")

**Demande / Contexte**
L'utilisateur a demandé d'ajouter, dans l'onglet "Ce mois" du tableau de bord admin, une colonne affichant le nom du client concerné pour les lignes d'entrée et de sortie liées à une proforma.

**Modifications apportées**
- [app/api/dashboard/route.ts](app/api/dashboard/route.ts) : dans `getMonthView`, le `select` du `prisma.cashJournal.findMany` inclut désormais la relation `paiement.invoice.client` (id + nom). Le mapping vers `entreesLines`/`sortiesLines` ajoute un champ `client` (`{ id, nom } | null`) en remontant la chaîne `CashJournal → paiement → invoice → client`.
- [components/dashboard/CashJournalLinesCard.tsx](components/dashboard/CashJournalLinesCard.tsx) : interface `CashJournalLine` étendue avec `client?: { id: string; nom: string } | null`. Nouvelle colonne "Client" entre "Libellé" et "Caisse", avec le nom cliquable (lien vers `/client/{id}`, style cohérent avec la page liste des factures) quand une facture/client est associée, ou un tiret `—` sinon. `colSpan` de l'état vide passé de 4 à 5.

**Erreurs rencontrées & solutions**
Aucune à ce stade — vérification `tsc`/`lint` en cours.

**À tester / points d'attention**
- Toutes les lignes de caisse ne sont pas liées à une facture (apports de caisse, transferts internes, dépenses manuelles) : ces lignes afficheront normalement un tiret dans la colonne Client, ce qui est attendu.
- Vérifier visuellement le rendu des deux tableaux (entrées/sorties) sur le dashboard, notamment la largeur de la nouvelle colonne et le comportement du lien cliquable vers la fiche client.

## 2026-10-25 (suite 7) — Égalisation de la hauteur des cartes Client & Mission / Configuration

**Demande / Contexte**
L'utilisateur a demandé de réduire la carte « Configuration » (à droite, en haut) pour qu'elle ait la même hauteur que la carte « Détails du Client & Mission » (à gauche), les deux cartes du haut devant avoir une taille homogène.

**Modifications apportées**
- [components/FactureForm.tsx](components/FactureForm.tsx) :
  - Carte « Détails du Client & Mission » : ajout de `h-full` pour qu'elle occupe toute la hauteur de sa colonne de grille.
  - Carte « Configuration » : ajout de `h-full` également ; densifié son contenu pour réduire sa hauteur naturelle (`CardContent` passé de `space-y-6` à `space-y-4`, encarts TVA et Remise réduits de `p-4` à `p-3`, encart Remise de `space-y-3` à `space-y-2`).
  - La grille parente (`grid grid-cols-1 lg:grid-cols-3 gap-8`) étire déjà ses colonnes par défaut (`align-items: stretch`) : avec `h-full` sur les deux cartes, elles s'alignent désormais exactement sur la même hauteur, quelle que soit la carte la plus haute (y compris si la Remise est activée et ajoute une ligne).

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit` propre.

**À tester / points d'attention**
- Vérifier visuellement que les deux cartes du haut (Client & Mission / Configuration) ont bien la même hauteur, y compris quand la Remise est activée (ligne supplémentaire) ou sur différentes largeurs d'écran.
- Confirmer que la lisibilité du bloc Configuration reste bonne malgré le resserrement des espacements.

## 2026-10-25 (suite 6) — Carte Produits & Services en pleine largeur + repositionnement du Récapitulatif

**Demande / Contexte**
L'utilisateur a demandé de redesigner la page de création de proforma pour que la carte « Produits & Services » occupe toute la largeur disponible, et de déplacer la carte « Récapitulatif » vers un emplacement plus cohérent, tout en gardant une mise en page harmonieuse (UI/UX, user first).

**Modifications apportées**
- [components/FactureForm.tsx](components/FactureForm.tsx) :
  - La grille 2/3 + 1/3 d'origine (Client & Mission + Produits à gauche, Configuration + Récapitulatif à droite) est restructurée :
    - Une première rangée (grille 2/3 + 1/3) regroupe désormais « Détails du Client & Mission » et « Configuration » côte à côte.
    - La carte « Produits & Services » (tableau des lignes de facturation) devient un bloc autonome en pleine largeur de page, juste après cette rangée.
    - La carte « Récapitulatif » (totaux) est repositionnée juste après le tableau de produits, alignée à droite (`flex justify-end`, largeur plafonnée `max-w-md`), reprenant le schéma classique « tableau de lignes + bloc de totaux en bas à droite » des factures.
  - Aucune logique métier, calcul ou donnée n'a été modifiée : uniquement la structure JSX/CSS de mise en page.

**Erreurs rencontrées & solutions**
- Après la restructuration par étapes, une erreur JSX temporaire (« JSX expressions must have one parent element », balise `form` non fermée) est apparue car une des trois modifications de structure n'avait pas encore été appliquée au moment de la vérification. Résolu en appliquant la modification manquante (fermeture du tableau Produits + ouverture du nouveau conteneur du Récapitulatif). `tsc --noEmit` propre après correction.

**À tester / points d'attention**
- Vérifier visuellement la nouvelle mise en page de création de proforma : carte Produits & Services en pleine largeur, Récapitulatif bien aligné à droite sous le tableau, Configuration bien à côté de Détails Client & Mission en haut.
- Vérifier le rendu responsive (mobile/tablette) : le Récapitulatif doit repasser en pleine largeur sur petit écran (`w-full max-w-md`).
- Ce changement ne concerne que la page de création (`components/FactureForm.tsx`) ; la page de détail/édition (`app/(main)/facture/[id]/page.tsx`), dont la carte équivalente s'appelle « Prestations & Tarification » (nom différent), n'a pas été touchée — à confirmer si une harmonisation est aussi souhaitée là-bas.

## 2026-10-25 (suite 5) — Élargissement du conteneur principal des formulaires de proforma

**Demande / Contexte**
L'utilisateur a demandé d'élargir légèrement la carte/le conteneur principal des formulaires de proforma pour que tout le contenu (notamment le tableau de produits) ait plus d'espace et reste bien visible.

**Modifications apportées**
- [components/FactureForm.tsx](components/FactureForm.tsx) : conteneur principal passé de `container` (largeur implicite liée aux breakpoints Tailwind) à `container max-w-7xl`.
- [app/(main)/facture/[id]/page.tsx](app/(main)/facture/[id]/page.tsx) : conteneur principal élargi de `max-w-6xl` à `max-w-7xl`, pour une largeur cohérente entre création et édition.

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit` et `next lint` propres.

**À tester / points d'attention**
- Vérifier visuellement que le formulaire (création et édition) dispose de plus d'espace horizontal, en particulier pour le tableau de produits, sans casser la mise en page sur les écrans plus petits.

## 2026-10-25 (suite 4) — Retour à la troncature sur le select, élargissement du champ désignation modifiable

**Demande / Contexte**
Après coup, l'utilisateur a précisé : pour le bouton du sélecteur de produit (le "select" lui-même), revenir à l'affichage tronqué (une ligne, ellipsis) plutôt que le retour à la ligne multi-lignes ajouté juste avant. En revanche, le champ "Désignation (modifiable)" séparé peut être élargi pour montrer davantage de texte avant d'avoir à défiler dedans.

**Modifications apportées**
- [components/ProduitCombobox.tsx](components/ProduitCombobox.tsx) : bouton déclencheur revenu à `truncate` sur une seule ligne (retour en arrière sur le changement précédent) ; le plafond de largeur du menu déroulant (`max-w-80`) reste inchangé.
- [components/FactureForm.tsx](components/FactureForm.tsx) et [app/(main)/facture/[id]/page.tsx](app/(main)/facture/[id]/page.tsx) : colonne "Désignation" avec un `min-w-[260px]` pour garantir plus de place au champ modifiable.

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit` et `next lint` propres.

**À tester / points d'attention**
- Vérifier que le nom sélectionné dans le combobox est de nouveau tronqué avec "..." sur une seule ligne, et que le champ de désignation modifiable affiche bien davantage de texte avant de nécessiter un défilement horizontal.

## 2026-10-25 (suite 3) — Largeur plafonnée du menu de sélection produit + nom sélectionné sur plusieurs lignes

**Demande / Contexte**
L'utilisateur a précisé qu'il parlait du dialogue de sélection (`ProduitCombobox`) lui-même, pas des colonnes du tableau : le menu déroulant prenait toute la largeur disponible (pas de plafond), et il a demandé à tronquer les noms trop longs dans la liste déroulante, mais à l'inverse, une fois un produit sélectionné, ne plus tronquer son nom dans le bouton — plutôt le laisser revenir à la ligne (comme un texte multi-lignes) pour rester entièrement visible.

**Modifications apportées**
- [components/ProduitCombobox.tsx](components/ProduitCombobox.tsx) :
  - `PopoverContent` : ajout de `max-w-80` en plus de la largeur liée au déclencheur — le menu ne s'étire plus indéfiniment même si la cellule qui le contient est large. Les noms trop longs dans la liste restent tronqués (ellipsis) comme avant, maintenant dans une largeur plafonnée.
  - Bouton déclencheur (nom du produit sélectionné) : remplacement de `truncate` par un retour à la ligne (`whitespace-normal`, `break-words`, hauteur `h-auto`/`min-h-9` au lieu d'une hauteur fixe) — le nom complet reste toujours visible, sur plusieurs lignes si besoin, au lieu d'être coupé par "...".

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit` et `next lint` propres.

**À tester / points d'attention**
- Sélectionner un produit avec un nom très long et vérifier qu'il s'affiche entièrement (sur 2 lignes ou plus si besoin) dans le bouton, sans jamais être coupé par des points de suspension.
- Ouvrir le menu déroulant et vérifier qu'il reste compact (largeur plafonnée) même si la colonne Désignation est large, avec les noms trop longs tronqués dans la liste.

## 2026-10-25 (suite 2) — Plus d'espace pour les lignes de produits dans le formulaire de proforma

**Demande / Contexte**
Depuis l'ajout du sélecteur de produit (combobox + désignation modifiable, empilés verticalement), les lignes du tableau de produits sont devenues plus hautes, et les colonnes Quantité/Prix/Montant, restées étroites, rendaient parfois ces valeurs peu lisibles. L'utilisateur a demandé de resserrer l'espace devenu "trop long" et d'élargir ce qu'il faut pour que ces valeurs restent toujours bien visibles.

**Modifications apportées** (appliqué de façon cohérente dans [components/FactureForm.tsx](components/FactureForm.tsx) — création — et [app/(main)/facture/[id]/page.tsx](app/(main)/facture/[id]/page.tsx) — édition) :
- Cellule Désignation (combobox + champ modifiable) : espacement vertical resserré (`space-y-2` → `space-y-1.5`) pour réduire la hauteur de ligne ajoutée par le nouveau sélecteur.
- Colonne Qté élargie (`w-20` → `w-24`) et centrée.
- Colonne Prix Unitaire élargie (`w-32` → `w-36`).
- Colonne Montant/Total élargie (`w-32` → `w-40`), alignée à droite, `whitespace-nowrap` + `tabular-nums` pour que le montant ne se coupe/retourne jamais à la ligne et que les chiffres restent bien alignés.

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit` et `next lint` propres.

**À tester / points d'attention**
- Vérifier visuellement sur une proforma avec plusieurs lignes de produits que les montants (notamment les gros montants) restent toujours entièrement visibles sans retour à la ligne, en création comme en édition.

## 2026-10-25 (suite) — Redirection vers la facture créée après soumission du formulaire

**Demande / Contexte**
Après la création d'une nouvelle proforma, le formulaire redirigeait vers `/` (puis vers la section par défaut de l'utilisateur, en général la liste des factures) au lieu d'ouvrir directement la facture qui vient d'être créée.

**Modifications apportées**
- [components/FactureForm.tsx](components/FactureForm.tsx) : `onSubmit` récupère désormais la facture créée depuis la réponse de `POST /api/factures` et redirige vers `/facture/{id}` au lieu de `/`.

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit` et `next lint` propres.

**À tester / points d'attention**
- Créer une nouvelle proforma et confirmer l'ouverture directe de sa page de détail après soumission.

## 2026-10-25 — Masquer aussi les produits désactivés par défaut sur la page Statistiques

**Demande / Contexte**
Même demande que sur la liste des produits, appliquée à `/produits/statistiques` : masquer les produits désactivés par défaut du tableau, avec le même interrupteur pour les réafficher.

**Modifications apportées**
- [app/(main)/produits/statistiques/page.tsx](app/(main)/produits/statistiques/page.tsx) : même interrupteur "Afficher les produits désactivés" (+ badge du nombre) que sur `/produits`, filtrant les lignes du tableau. Les 4 cartes KPI en haut (CA total réalisé, quantité vendue, produits actifs/total, produit le plus vendu) restent volontairement basées sur l'ensemble des produits, actifs ou non — le CA historique réalisé par un produit depuis désactivé reste un fait réel qui ne doit pas disparaître des totaux.

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit` et `next lint` propres.

**À tester / points d'attention**
- Désactiver un produit ayant déjà du CA réalisé, confirmer qu'il disparaît du tableau par défaut mais que les cartes KPI (CA total, etc.) continuent de l'inclure ; réafficher via l'interrupteur pour le retrouver dans le tableau.

## 2026-10-24 (suite 12) — Masquer les produits désactivés par défaut sur la liste

**Demande / Contexte**
L'utilisateur a demandé que les produits désactivés soient masqués par défaut sur `/produits`, avec un contrôle séparé pour décider de les afficher ou non — dissocier les deux plutôt que tout montrer en permanence.

**Modifications apportées**
- [app/(main)/produits/page.tsx](app/(main)/produits/page.tsx) : nouvel interrupteur "Afficher les produits désactivés" (avec badge indiquant leur nombre) à côté de la barre de recherche, par défaut désactivé — donc par défaut, seuls les produits actifs apparaissent dans la liste. Le fetch continue de ramener tous les produits (nécessaire pour pouvoir réactiver un produit désactivé), seul le filtrage d'affichage change.

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit` et `next lint` propres.

**À tester / points d'attention**
- Désactiver un produit, confirmer qu'il disparaît immédiatement de la liste ; activer l'interrupteur et confirmer qu'il réapparaît, toujours modifiable/réactivable.

## 2026-10-24 (suite 11) — Refonte UI/UX de la page Statistiques Produits

**Demande / Contexte**
L'utilisateur a demandé de tronquer les colonnes trop larges sur `/produits/statistiques` et de revoir l'UI/UX pour un rendu plus soigné.

**Modifications apportées**
- [app/(main)/produits/statistiques/page.tsx](app/(main)/produits/statistiques/page.tsx) : refonte complète.
  - 4 cartes KPI en haut (réutilisation de `components/StatCard.tsx`, déjà construit pour le tableau de bord) : CA total réalisé, quantité totale vendue, nombre de produits actifs/total, produit le plus vendu.
  - Barre de recherche par nom (filtre côté client).
  - Colonne "Produit" tronquée (`max-w-[220px]` + ellipsis + tooltip natif).
  - Tri par colonne : la flèche change de sens (haut/bas) et se met en évidence sur la colonne triée, au lieu d'une icône neutre fixe.
  - Badges Statut recolorés (vert pour Actif, gris pour Inactif, au lieu du `destructive` rouge générique).
  - État vide avec icône, montants en `tabular-nums` pour un alignement propre des chiffres.

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit` et `next lint` propres.

**À tester / points d'attention**
Aucun point particulier — refonte visuelle, logique de données inchangée.

## 2026-10-24 (suite 10) — Colonne "Nom" tronquée sur la liste des produits

**Demande / Contexte**
Sur `/produits`, certains noms de produits trop longs déformaient le tableau. L'utilisateur a confirmé que les fonctionnalités de modification/statut étaient bien là — le seul souci était la largeur de la colonne "Nom".

**Modifications apportées**
- [app/(main)/produits/page.tsx](app/(main)/produits/page.tsx) : colonne "Nom" plafonnée à `max-w-[280px]` avec troncature (ellipsis) et tooltip natif (`title`) affichant le nom complet au survol.

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit` et `next lint` propres.

**À tester / points d'attention**
Aucun point particulier — ajustement visuel uniquement.

## 2026-10-24 (suite 9) — Gestion des Produits (catalogue, statistiques) + nouveau sélecteur de produit dans les proformas

**Demande / Contexte**
L'utilisateur a demandé une nouvelle section "Produits" (le catalogue utilisé comme lignes de facture — sans rapport avec `ProduitFournisseur`, le catalogue fournisseur déjà existant, non touché) avec deux pages : liste/ajout/modification, et statistiques. Il a aussi demandé un nouvel attribut pour masquer un produit de la sélection dans les proformas, et de remplacer la création de produit à la volée (texte libre + datalist) par un vrai sélecteur parmi les produits existants, avec recherche, et une option "Nouveau produit" explicite si besoin. Ajout également de "Produits" à la gestion des rôles.

En creusant le code existant, deux découvertes importantes : (1) `app/api/produits/route.ts`/`[id]/route.ts` existaient déjà mais n'étaient utilisés que comme simple liste pour un `<datalist>` texte libre, sans validation ; (2) la vraie création à la volée se trouvait dans `app/api/factures/route.ts` (POST, `findUnique` par nom puis `create` si absent) et surtout `app/api/factures/[id]/route.ts` (PUT, un `upsert` par nom qui **écrasait silencieusement le prix d'un produit existant** comme effet de bord de la simple modification d'une ligne de facture sans rapport). Le nouvel attribut `actif` est un simple interrupteur (comme `User.active`), volontairement **sans** le système motif+historique construit pour `Fournisseur.actif` — disproportionné ici.

**Modifications apportées**
- [prisma/schema.prisma](prisma/schema.prisma) + migration `add_actif_to_produit` : `Produit.actif Boolean @default(true)`.
- [app/api/produits/route.ts](app/api/produits/route.ts) : `GET` accepte `?actif=true|false` ; `POST` validé (zod) avec message clair en cas de nom dupliqué (`P2002`).
- [app/api/produits/[id]/route.ts](app/api/produits/[id]/route.ts) : `PUT` validé (+ `actif`) ; `DELETE` renvoie un message clair ("désactivez-le à la place") si le produit est référencé par une facture (`P2003`/`P2014`) au lieu d'un 500 brut.
- [app/api/factures/route.ts](app/api/factures/route.ts) (POST) et [app/api/factures/[id]/route.ts](app/api/factures/[id]/route.ts) (PUT) : suppression complète de la création/`upsert` à la volée — `produitId` est désormais obligatoire pour chaque ligne (400 sinon), corrigeant au passage le bug de prix écrasé par effet de bord.
- [components/ProduitCombobox.tsx](components/ProduitCombobox.tsx) (nouveau) : même architecture que `FournisseurCombobox.tsx` (délégation au parent, pas de Dialog interne), recherche par nom, prix affiché, badge "Inactif" pour une ligne existante référençant un produit désactivé, option "Nouveau produit".
- [components/ProduitModal.tsx](components/ProduitModal.tsx) (nouveau) : créer/modifier un produit (nom, prix, + interrupteur actif en édition — sans confirmation ni motif).
- [components/FactureForm.tsx](components/FactureForm.tsx) et [app/(main)/facture/[id]/page.tsx](app/(main)/facture/[id]/page.tsx) : le champ désignation en texte libre + datalist est remplacé par `ProduitCombobox` (lié à `produitId`) ; la désignation reste un champ texte séparé, librement modifiable, pré-rempli au nom du produit choisi. La page d'édition continue de charger tous les produits (actifs et inactifs) pour que les lignes déjà créées sur un produit désormais désactivé continuent de s'afficher correctement.
- [app/(main)/produits/page.tsx](app/(main)/produits/page.tsx) (nouveau) : liste, recherche, interrupteur actif/inactif direct, modifier/supprimer.
- [app/api/produits/statistiques/route.ts](app/api/produits/statistiques/route.ts) (nouveau) + [app/(main)/produits/statistiques/page.tsx](app/(main)/produits/statistiques/page.tsx) (nouveau) : agrégat par produit (quantité vendue, CA réalisé converti en XOF, nb de factures), même convention de statuts "CA réalisé" (Valider/Payer/Solde) que `topProducts` dans `/api/statistiques`, triable par colonne.
- [lib/permissions.ts](lib/permissions.ts) : nouvelle clé `"produits"` (4 endroits : `PAGE_KEYS`, `PAGE_LABELS`, règles de `resolvePageKeyFromPathname`, `PAGE_DEFAULT_URLS`) — aucun changement nécessaire dans `parametres/roles/page.tsx` (déjà dynamique).
- [components/app-sidebar.tsx](components/app-sidebar.tsx) : nouveau groupe de navigation autonome "Produits" (Liste des produits, Statistiques), gated par `canSeePage("produits", true)`.

**Erreurs rencontrées & solutions**
- `prisma generate` a échoué (`EPERM`, fichier verrouillé) car le serveur de dev (`pnpm dev`) avait le moteur Prisma chargé en mémoire sur Windows — résolu en arrêtant le serveur de dev avant de régénérer le client.
- `pnpm build` a de nouveau rencontré la corruption pnpm habituelle (`MODULE_NOT_FOUND`) — résolue par `pnpm install --force`, build ensuite confirmé réussi avec toutes les nouvelles routes/pages présentes.

**À tester / points d'attention**
- Désactiver un produit existant et confirmer qu'il n'apparaît plus dans le sélecteur d'une nouvelle proforma, mais reste visible/fonctionnel sur une ligne déjà existante qui le référence.
- Créer un produit via "Nouveau produit" en pleine création de proforma, confirmer qu'il est immédiatement sélectionné (prix + désignation pré-remplis).
- Modifier une ligne d'une proforma existante et vérifier dans `/produits` que le prix d'un AUTRE produit n'a pas changé par effet de bord (confirme la correction du bug d'upsert).
- Attribuer/retirer l'accès "Produits" à un rôle dans Paramètres → Rôles, confirmer l'apparition/disparition du groupe dans la barre latérale.
- Vérifier les chiffres de `/produits/statistiques` contre une facture connue.

## 2026-10-24 (suite 8) — Numéro de proforma copiable + client cliquable vers sa fiche

**Demande / Contexte**
L'utilisateur a demandé, sur la liste des proformas, le même pattern "copie au clic" que celui mis en place pour email/contact côté prestataires (appliqué ici au numéro de proforma), et que le nom du client soit cliquable pour renvoyer directement vers sa fiche détail.

**Modifications apportées**
- [app/(main)/facture/page.tsx](app/(main)/facture/page.tsx) : la cellule "Numéro" devient un bouton copiant la valeur dans le presse-papier avec toast de confirmation (icône `Copy` au survol, même pattern que `fournisseur/page.tsx`) ; la cellule "Client" devient un `Link` vers `/client/{id}` (souligné au survol, tooltip "Voir la fiche de {nom}"), avec repli en texte simple si `facture.client` est absent.

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit` et `next lint` propres.

**À tester / points d'attention**
- Vérifier que le clic sur le nom du client navigue bien vers `/client/{id}` et que le clic sur le numéro copie la valeur sans déclencher d'autre action.

## 2026-10-24 (suite 7) — Renommage colonne "Entreprise" + placeholder de recherche

**Demande / Contexte**
L'utilisateur a demandé de renommer la colonne "Entreprise" en "Entreprise / Prestataire" (cohérent avec le champ du formulaire déjà relabellisé "Entreprise ou Nom & Prénom") et de préciser dans le placeholder de la barre de recherche qu'on cherche un fournisseur ou un prestataire.

**Modifications apportées**
- [app/(main)/fournisseur/page.tsx](app/(main)/fournisseur/page.tsx) : en-tête de colonne "Entreprise" → "Entreprise / Prestataire" ; placeholder de recherche → "Rechercher un fournisseur ou prestataire (entreprise, contact, email)...".

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit` et `next lint` propres.

**À tester / points d'attention**
Aucun point particulier — changement textuel uniquement.

## 2026-10-24 (suite 6) — Colonnes Email/Contact compactées + copie au clic sur la liste prestataires

**Demande / Contexte**
L'utilisateur a demandé de réduire/tronquer les colonnes Email et Contact du tableau de liste des prestataires pour que tout reste visible sans scroll horizontal, et de pouvoir copier l'email ou le contact d'un simple clic, avec un toast de confirmation, de façon intuitive.

**Modifications apportées**
- [app/(main)/fournisseur/page.tsx](app/(main)/fournisseur/page.tsx) : colonnes Email (`max-w-[140px]`), Contact (`max-w-[110px]`) et Domaine d'activité (`max-w-[130px]`) tronquées avec ellipsis. Email et Contact sont désormais des boutons cliquables (`e.stopPropagation()` pour ne pas déclencher la navigation de la ligne) qui copient la valeur dans le presse-papier (`navigator.clipboard.writeText`) et affichent un toast "Email copié !"/"Contact copié !" ; une icône `Copy` apparaît au survol pour rendre l'action découvrable, avec un `title` natif en complément.

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit` et `next lint` propres.

**À tester / points d'attention**
- Vérifier visuellement qu'avec les colonnes réduites, le tableau ne nécessite plus de scroll horizontal sur un écran standard.
- Confirmer que le clic sur Email/Contact copie bien la valeur complète (non tronquée) et n'ouvre pas la fiche du prestataire.

## 2026-10-24 (suite 5) — Réordonnancement de l'onglet "Documents"

**Demande / Contexte**
L'utilisateur a demandé à placer l'onglet "Documents" juste à droite de celui des factures (qui affiche l'historique des factures), plutôt qu'en dernière position.

**Modifications apportées**
- [app/(main)/fournisseur/[id]/page.tsx](app/(main)/fournisseur/[id]/page.tsx) : ordre des onglets passé de Factures / Catalogue Produits / Bons de Commande / Documents à Factures / **Documents** / Catalogue Produits / Bons de Commande.

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit` et `next lint` propres.

**À tester / points d'attention**
- Vérifier visuellement le nouvel ordre des onglets sur la fiche prestataire.

## 2026-10-24 (suite 4) — Documents liés au prestataire (CV, pièces administratives, etc.)

**Demande / Contexte**
L'utilisateur veut pouvoir attacher des documents à une fiche prestataire (CV, pièces administratives, IFU, etc.) depuis la page détail, via un dialogue avec un type de document à choisir (préréglages + "Autre" en texte libre) et un fichier à uploader, de tout type (image, PDF, Word). Exigence explicite : le type doit être stocké en base en texte libre, sans enum — seul le frontend restreint les choix. La gestion des contraintes de taille côté serveur m'a été déléguée.

Découverte en cours de route : `lib/compressImage.ts` (compression d'image côté client construite plus tôt dans la session pour un autre flux d'upload) n'existe plus du tout sur le disque — jamais commité, probablement perdu lors d'un changement de branche (le projet est maintenant sur `feature/gestionPrestataire`). Non réutilisé pour cette fonctionnalité ; décision actée : pas de compression (hors scope, et de toute façon inutile pour les PDF/Word que cette fonctionnalité doit aussi accepter), seulement une vérification de taille (10 Mo/fichier) côté client ET côté serveur.

**Modifications apportées**
- [prisma/schema.prisma](prisma/schema.prisma) + migration `add_fournisseur_document` : nouveau modèle `FournisseurDocument` (id, fournisseurId FK cascade, `type` en texte libre, url, fileName, fileType, createdAt, createdById FK nullable vers `User`) ; relations inverses ajoutées sur `Fournisseur` et `User`.
- [lib/documentFournisseurTypes.ts](lib/documentFournisseurTypes.ts) (nouveau) : préréglages de type (CV, Pièce d'identité, Document administratif, IFU, RCCM, Contrat, Diplôme / Attestation) + couleur de badge par type avec repli gris pour un texte "Autre" imprévisible.
- [lib/uploadFournisseurDocument.ts](lib/uploadFournisseurDocument.ts) (nouveau) : `saveFournisseurDocuments()` (écrit dans `public/Upload/FournisseurDocument/<id>/...`, rejette tout fichier > 10 Mo avant d'écrire) + sa propre copie de `describeFsError` (même convention dupliquée que les autres libs d'upload du projet).
- [app/api/fournisseurs/[id]/documents/route.ts](app/api/fournisseurs/[id]/documents/route.ts) (nouveau) : `GET` (liste triée, avec l'auteur), `POST` (type + fichiers du FormData, une ligne par fichier avec le même type).
- [app/api/fournisseurs/[id]/documents/[documentId]/route.ts](app/api/fournisseurs/[id]/documents/[documentId]/route.ts) (nouveau) : `DELETE` avec vérification d'appartenance au prestataire + suppression best-effort du fichier physique (try/catch jamais bloquant — améliore le précédent `ProduitFournisseurPhoto` qui ne supprimait que la ligne DB).
- [components/fournisseurs/FournisseurDocuments.tsx](components/fournisseurs/FournisseurDocuments.tsx) (nouveau) : onglet autonome (fetch propre), liste des documents (badge coloré, nom, auteur/date, `AttachmentPreviewButton` réutilisé tel quel, bouton supprimer) + dialogue d'ajout intégré (Select type + "Autre", input fichier sans restriction de type, vérification de taille à la sélection).
- [app/(main)/fournisseur/[id]/page.tsx](app/(main)/fournisseur/[id]/page.tsx) : nouvel onglet "Documents" (4ᵉ onglet, `grid-cols-3` → `grid-cols-4`), délègue à `FournisseurDocuments`.

**Erreurs rencontrées & solutions**
- `tsc --noEmit` et `next lint` propres dès la première passe.
- `pnpm build` a de nouveau échoué avec la corruption pnpm habituelle (`MODULE_NOT_FOUND` sur `next/dist/...`) — résolue par `pnpm install --force`, build confirmé ensuite (27+ routes, les 2 nouvelles routes `/api/fournisseurs/[id]/documents` et `/api/fournisseurs/[id]/documents/[documentId]` bien présentes, exit code réel 0).

**À tester / points d'attention**
- Ajouter un document avec un type préréglagé puis un autre avec "Autre" + texte libre, vérifier les badges.
- Vérifier l'aperçu pour une image, un PDF, et un document Word (repli + lien "Ouvrir/Télécharger").
- Supprimer un document, tenter d'uploader un fichier > 10 Mo (doit être bloqué côté client avant tout envoi réseau).
- La limite éventuelle d'un proxy (nginx `client_max_body_size`) reste hors de portée de ce code, comme déjà signalé précédemment dans ce journal.

## 2026-10-24 (suite 3) — Affichage amélioré de l'historique de statut (mini-timeline scrollable)

**Demande / Contexte**
L'utilisateur a demandé d'améliorer visuellement la carte « Historique de statut » et de s'assurer qu'elle reste correctement scrollable si la liste devient longue (défensif, UI/UX).

**Modifications apportées**
- [app/(main)/fournisseur/[id]/page.tsx](app/(main)/fournisseur/[id]/page.tsx) : l'en-tête « Historique de statut » (+ badge du nombre d'entrées) est désormais fixe, hors de la zone de défilement (avant il scrollait avec la liste). La liste elle-même est dans une zone `max-h-64 overflow-y-auto` dédiée, présentée comme une mini-timeline : ligne verticale reliant les points de statut, date alignée à droite de chaque entrée, motif et auteur toujours affichés sous le libellé.

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit` et `next lint` propres.

**À tester / points d'attention**
- Vérifier visuellement sur une fiche avec peu d'entrées (0, 1) et, si possible, en créer plusieurs pour confirmer que le défilement se déclenche bien au-delà de la hauteur plafonnée sans casser la mise en page, et que l'en-tête reste visible pendant le scroll.

## 2026-10-24 (suite 2) — Motifs présélectionnés (+ Autre) dans le dialogue de changement de statut

**Demande / Contexte**
L'utilisateur a demandé à remplacer le champ motif en texte libre par une liste de motifs prédéfinis à sélectionner (différente selon qu'on passe actif ou inactif), avec une option « Autre » qui laisse saisir un texte libre — même pattern déjà utilisé ailleurs dans l'app pour « Domaine d'activité ».

**Modifications apportées**
- [components/fournisseurs/PrestataireStatutToggle.tsx](components/fournisseurs/PrestataireStatutToggle.tsx) : le `Textarea` motif libre est remplacé par un `Select` dont les options dépendent du sens du changement — `MOTIF_OPTIONS_ACTIF` (« Nouveau contrat signé », « Reconduction de contrat », « Repris après une interruption ») pour passer actif, `MOTIF_OPTIONS_INACTIF` (« Fin de contrat », « Résiliation de contrat », « Remplacé par un autre prestataire ») pour passer inactif — plus une option « Autre » qui révèle un `Textarea` pour préciser librement. Le motif envoyé à l'API reste optionnel comme avant.

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit` et `next lint` propres.

**À tester / points d'attention**
- Vérifier que les options proposées changent bien selon qu'on bascule vers actif ou inactif, que « Autre » affiche le champ libre, et que le motif choisi (préréglage ou texte libre) apparaît correctement dans l'historique de la fiche.

## 2026-10-24 (suite) — La date du changement met aussi à jour Début/Fin de contrat

**Demande / Contexte**
L'utilisateur a demandé si la date saisie lors d'une bascule actif/inactif se répercutait bien sur les champs « Début de contrat »/« Fin de contrat » de la fiche (pas seulement dans l'historique). Confirmé : oui, en fonction du sens du changement.

**Modifications apportées**
- [app/api/fournisseurs/[id]/route.ts](app/api/fournisseurs/[id]/route.ts) (handler `PATCH`) : quand le statut change réellement, la date saisie est désormais aussi écrite sur `Fournisseur.dateDebutContrat` (si on repasse actif) ou `Fournisseur.dateFinContrat` (si on passe inactif), en plus de la ligne d'historique. L'autre champ (non concerné par ce changement) n'est jamais touché — reste modifiable librement via le formulaire d'édition.

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit` et `next lint` propres.

**À tester / points d'attention**
- Marquer un prestataire inactif avec une date → vérifier que « Fin de contrat » sur sa fiche affiche cette date. Le remarquer actif avec une autre date → vérifier que « Début de contrat » se met à jour, et que « Fin de contrat » n'est pas effacé (comportement actuel : seul le champ du sens concerné est écrit, l'ancien reste affiché tel quel sauf modification manuelle).

## 2026-10-24 — Date obligatoire du changement de statut dans l'historique prestataire

**Demande / Contexte**
Suite à la fonctionnalité actif/inactif, l'utilisateur a ajouté lui-même un champ `dateContrat DateTime?` sur `FournisseurStatutHistorique` (migration `20261022085247_add_date_contrat_to_fournisseur_statut_historique`, déjà appliquée) et a demandé que la boîte de dialogue de bascule actif/inactif propose désormais une date du changement obligatoire (pré-remplie avec la date du jour, modifiable — utile pour saisir un changement survenu quelques jours plus tôt), en plus du motif déjà optionnel, et que cette date soit conservée et affichée dans l'historique.

**Modifications apportées**
- [components/fournisseurs/PrestataireStatutToggle.tsx](components/fournisseurs/PrestataireStatutToggle.tsx) : nouveau champ `<Input type="date" required>` "Date du changement *" (pré-rempli à la date du jour à chaque ouverture du dialogue), placé avant le motif optionnel inchangé ; garde côté client si la date est vide avant l'envoi ; la date est incluse dans le corps du `PATCH`.
- [app/api/fournisseurs/[id]/route.ts](app/api/fournisseurs/[id]/route.ts) (handler `PATCH`) : `dateContrat` lu depuis le body, validé (date requise et valide) uniquement quand le statut change réellement, puis stocké sur la ligne `FournisseurStatutHistorique` créée.
- [app/(main)/fournisseur/[id]/page.tsx](app/(main)/fournisseur/[id]/page.tsx) : `StatutHistoriqueEntry` gagne `dateContrat` ; la carte « Historique de statut » affiche désormais `dateContrat` (date effective choisie par l'utilisateur) avec repli sur `createdAt` pour les lignes créées avant ce changement (où `dateContrat` est `null`).
- `GET /api/fournisseurs/[id]` n'a pas eu besoin d'être modifié : son `include` sans `select` restrictif ramène déjà tous les champs scalaires de `statutHistorique`, dont le nouveau `dateContrat`.

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit` et `next lint` propres.

**À tester / points d'attention**
- Basculer un statut, modifier la date proposée (ex. la veille), confirmer, et vérifier que l'historique affiche bien cette date choisie et non la date/heure système de la validation.
- Confirmer qu'une ancienne ligne d'historique (créée avant ce changement, `dateContrat = null`) s'affiche toujours correctement via le repli sur `createdAt`.
- Confirmer que la validation serveur bloque bien une tentative de bascule sans date valide (défense en profondeur derrière le `required` côté client).

## 2026-10-21 (suite 2) — Statut Actif/Inactif des prestataires, avec historique et dates de contrat

**Demande / Contexte**
L'utilisateur veut distinguer les prestataires avec qui l'entreprise travaille encore (actifs) de ceux avec qui elle ne travaille plus (inactifs), avec un historique clair des changements de statut dans le temps (actif → inactif → actif, etc.), et des dates de début/fin de contrat. Le badge devait reprendre le style « clignotant » déjà utilisé pour les statuts de paiement des proformas/factures fournisseurs. Décisions actées : Actif = badge vert clignotant (relation en cours), Inactif = badge rouge statique (état terminé) — même sémantique que `FactureStatusBadge`/`FactureFournisseurStatusBadge` déjà dans le projet ; chaque changement de statut peut porter un motif optionnel saisi dans une boîte de dialogue ; le contrôle de bascule vit uniquement dans le tableau de liste et la page détail (pas dans le formulaire d'ajout/modification).

Aucun pattern d'historique n'existait déjà dans ce projet (`Invoice.historiqueModifications Json?` est mort, jamais lu/écrit nulle part) — le nouveau modèle suit le pattern établi "un événement = une ligne, FK vers le parent, cascade" déjà utilisé par `ProduitFournisseurPhoto`/`CashJournalAttachment`/`Paiement`.

**Modifications apportées**
- [prisma/schema.prisma](prisma/schema.prisma) + migration `add_fournisseur_statut_historique` : `Fournisseur` gagne `actif Boolean @default(true)`, `dateDebutContrat`/`dateFinContrat DateTime?` ; nouveau modèle `FournisseurStatutHistorique` (id, fournisseurId FK cascade, actif, motif optionnel, createdAt, createdById FK nullable vers `User`) ; relation inverse ajoutée sur `User`. Tous les prestataires existants deviennent `actif = true` automatiquement (opération de métadonnées seule, aucune ligne d'historique rétroactive créée).
- [components/fournisseurs/PrestataireStatutBadge.tsx](components/fournisseurs/PrestataireStatutBadge.tsx) (nouveau) : badge + `PrestataireStatutDot`, repris de `FactureFournisseurStatusBadge.tsx` mais pour un booléen, `animate` valant `actif` par défaut (clignote seulement si actif).
- [components/fournisseurs/PrestataireStatutToggle.tsx](components/fournisseurs/PrestataireStatutToggle.tsx) (nouveau) : `Switch` + `Dialog` avec `Textarea` motif optionnel, titre/placeholder adaptés selon le sens du bascule, `PATCH` vers l'API à la confirmation.
- [app/api/fournisseurs/[id]/route.ts](app/api/fournisseurs/[id]/route.ts) : `GET` inclut désormais `statutHistorique` (ordonné, avec le nom de l'auteur) ; `PUT` gère les deux dates de contrat (pass-through, ne touche jamais `actif`) ; nouveau `PATCH` qui bascule `actif` et ne crée une ligne d'historique que si la valeur change réellement (via `safeCreatedById` pour l'attribution).
- [components/FournisseurModal.tsx](components/FournisseurModal.tsx) : type partagé `Fournisseur` gagne `actif`, `dateDebutContrat`, `dateFinContrat` ; `onSubmit`/`handleSubmit` typés `Omit<Fournisseur, 'id' | 'actif'>` (le formulaire ne gère jamais `actif`).
- [components/FournisseurForm.tsx](components/FournisseurForm.tsx) : deux nouveaux champs date (Début/Fin de contrat) après Contact/Email, avant Adresse.
- [app/(main)/fournisseur/page.tsx](app/(main)/fournisseur/page.tsx) : nouvelle colonne « Statut » (badge + interrupteur) entre Type et Email ; `colSpan` de l'état vide passé à 7.
- [components/FournisseurTableSkeleton.tsx](components/FournisseurTableSkeleton.tsx) : 2 cellules ajoutées pour matcher exactement les 7 colonnes du tableau (corrige au passage une incohérence déjà présente avant ce correctif).
- [app/(main)/fournisseur/[id]/page.tsx](app/(main)/fournisseur/[id]/page.tsx) : badge + interrupteur dans l'en-tête, ligne dates de contrat, carte « Historique de statut » (liste chronologique avec motif et auteur, points statiques même pour l'entrée actuellement « actif »).

**Erreurs rencontrées & solutions**
- `tsc --noEmit` et `next lint` propres (vérifiés séparément du build, avec le vrai code de sortie — pas celui d'un `tail`/pipe qui masquerait un échec).
- `pnpm build` a de nouveau échoué avec `Cannot find module '.../next/dist/client/components/builtin/global-not-found'` (MODULE_NOT_FOUND) — 5ᵉ occurrence de cette corruption du store pnpm dans la session, résolue à nouveau par `pnpm install --force`. Build relancé en arrière-plan, confirmation finale non bloquante sur cette entrée (voir « À tester »).

**À tester / points d'attention**
- Confirmer que le dernier `pnpm build` relancé après réparation aboutit bien (27+ routes, exit code 0).
- Basculer un prestataire en inactif avec un motif depuis la liste → badge rouge/statique immédiat ; ouvrir sa fiche → historique montre « Marqué inactif », date, motif, « par {nom de l'utilisateur connecté} » (pas « par Système »).
- Rebasculer en actif sans motif → badge vert/clignotant, nouvelle ligne d'historique sans motif affiché.
- Modifier les dates de contrat via le formulaire, confirmer la persistance et qu'aucune ligne d'historique n'est créée par cette édition (le formulaire ne touche jamais `actif`).
- Cette corruption pnpm récurrente (5 fois en une session) continue de pointer vers un problème d'environnement sur cette machine (antivirus/EDR scannant `node_modules`, synchronisation de fichiers) — déjà signalé à plusieurs reprises dans ce journal, mérite une investigation côté admin.

## 2026-10-21 (suite) — Renommage oublié : libellé de section dans la gestion des rôles

**Demande / Contexte**
L'utilisateur a demandé s'il fallait aussi intervenir sur la page Paramètres pour la gestion des accès par rôle, suite au renommage Fournisseur → Prestataire. Vérification : [lib/permissions.ts](lib/permissions.ts) définit `PAGE_LABELS.fournisseurs = "Fournisseurs"`, affiché dans [app/(main)/parametres/roles/page.tsx](app/(main)/parametres/roles/page.tsx) (badges de pages autorisées + interrupteurs lors de la création/modification d'un rôle) — un libellé d'affichage oublié par le renommage précédent car situé hors des dossiers `fournisseur/`/`FournisseurXxx` explorés à l'époque.

**Modifications apportées**
- [lib/permissions.ts](lib/permissions.ts) : `PAGE_LABELS.fournisseurs` → `"Prestataires"`. La clé interne `"fournisseurs"` (stockée dans `RolePage`, utilisée par le middleware et les routes API) et l'URL `/fournisseur` restent inchangées — seul le libellé affiché aux admins change.

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit` et `next lint` propres.

**À tester / points d'attention**
- Vérifier sur la page Paramètres → Rôles que le libellé "Prestataires" s'affiche bien à la place de "Fournisseurs", pour les rôles existants comme à la création/modification d'un rôle.

## 2026-10-21 — Refonte Fournisseur → Prestataire : catégorisation, formulaire, renommage d'affichage

**Demande / Contexte**
La page « Fournisseur » mélangeait trois réalités différentes (prestataires internes, prestataires externes, vrais fournisseurs de matériel) dans une seule liste non catégorisée. Le champ `typeFournisseur` existait déjà mais en texte libre avec un mécanisme « 4 préréglages + Autre » quasi identique à celui du champ `domaineActivite` juste au-dessus dans le formulaire — d'où la confusion rapportée (« quand j'enregistre le type ça écrase le domaine, et inversement ») et le ressenti « pas auto-rempli à la modification » (une valeur ne correspondant à aucun préréglage basculait silencieusement le Select sur « Autre », la vraie valeur atterrissant dans un second champ caché). Deux agents d'exploration ont confirmé qu'il n'y avait **aucun bug de code** faisant s'écraser ces deux champs (états, handlers, API et colonnes Prisma totalement indépendants) — la confusion venait de la ressemblance visuelle des deux champs.

Demandé : renommer « Fournisseur » en « Prestataire » à l'affichage partout dans l'app (modèle Prisma, routes API, segment d'URL `/fournisseur`, noms de fichiers/variables **non touchés**) ; transformer `typeFournisseur` en catégorisation fermée à 3 valeurs (Prestataire interne / Prestataire externe / Fournisseur) avec des onglets de navigation en haut de la liste ; sur les pages liées à une fiche précise (détail, bon de commande, email de notification), afficher la vraie catégorie de cette fiche plutôt qu'un mot générique ; simplifier le formulaire (retrait Nom/Prénom, un seul champ « Entreprise ou Nom & Prénom » en haut, email optionnel) ; affiner visuellement le tableau de la liste (badges colorés).

Décision actée en cours de revue de plan : **pas d'enum Prisma, pas de migration sur `typeFournisseur`** — le champ reste du texte libre en base exactement comme avant ; le découpage en 3 catégories se fait uniquement côté front via une fonction `resolveTypeFournisseur()` qui range toute valeur non reconnue (vide, legacy, « Autre ») dans « Prestataire interne » pour l'affichage/filtrage, sans jamais réécrire la base en masse — une fiche ne se « nettoie » que si elle est réenregistrée via le nouveau formulaire. Seule l'email est passé en migration (simple retrait de la contrainte NOT NULL, aucune donnée à retraiter).

**Modifications apportées**
- [prisma/schema.prisma](prisma/schema.prisma) + migration `20261021132355_make_fournisseur_email_optional` : `Fournisseur.email` passe de `String` à `String?` (toujours `@unique` — Postgres autorise plusieurs `NULL` sur une colonne unique). `typeFournisseur` inchangé.
- [lib/typeFournisseur.ts](lib/typeFournisseur.ts) (nouveau) : les 3 valeurs canoniques, couleurs/icônes par catégorie, et `resolveTypeFournisseur()` — le seul point qui décide comment une valeur existante (potentiellement legacy) doit être affichée/filtrée.
- [components/FournisseurForm.tsx](components/FournisseurForm.tsx) : refonte complète — champs Nom/Prénom retirés (colonnes Prisma conservées, juste plus utilisées par ce formulaire) ; un seul champ « Entreprise ou Nom & Prénom » en haut ; nouveau Select « Type de prestataire » à 3 valeurs fixes (plus d'« Autre ») placé à côté de Domaine d'activité (inchangé) au lieu d'empilé dessous — c'est le correctif concret de la confusion visuelle ; email n'est plus obligatoire.
- [components/FournisseurModal.tsx](components/FournisseurModal.tsx) : type `Fournisseur` partagé, `email: string | null` ; toasts et titres renommés en « Prestataire ».
- [components/FournisseurCombobox.tsx](components/FournisseurCombobox.tsx) : type local divergent (qui omettait `typeFournisseur`) remplacé par un re-export du vrai type `FournisseurModal.Fournisseur` ; badge de catégorie ajouté par ligne ; textes renommés.
- [app/api/fournisseurs/route.ts](app/api/fournisseurs/route.ts) et [app/api/fournisseurs/[id]/route.ts](app/api/fournisseurs/[id]/route.ts) : email normalisé en `null` si vide, validation `!email` retirée ; `typeFournisseur` toujours en mode libre côté API (aucun garde-fou supplémentaire).
- [app/(main)/fournisseur/page.tsx](app/(main)/fournisseur/page.tsx) : le Select de filtre par type remplacé par des onglets (Tout / Prestataire interne / Prestataire externe / Fournisseur) basés sur `resolveTypeFournisseur()` ; badge « Type » coloré par catégorie ; email affiché « — » si absent ; renommages (titre, compteur, bouton, état vide, toast, tooltip).
- Renommages d'affichage « Fournisseur » → « Prestataire » (partout, modèle/routes/URL non touchés) : [components/app-sidebar.tsx](components/app-sidebar.tsx), [app/sign-in/[[...sign-in]]/page.tsx](app/sign-in/[[...sign-in]]/page.tsx), [app/(main)/fournisseur/commandes/page.tsx](app/(main)/fournisseur/commandes/page.tsx), [app/(main)/fournisseur/factures/page.tsx](app/(main)/fournisseur/factures/page.tsx), [components/CommandeFournisseurModal.tsx](components/CommandeFournisseurModal.tsx), [components/FactureFournisseurModal.tsx](components/FactureFournisseurModal.tsx), [components/fournisseurs/EditCommandeFournisseurModal.tsx](components/fournisseurs/EditCommandeFournisseurModal.tsx), [app/(main)/fournisseur/[id]/page.tsx](app/(main)/fournisseur/[id]/page.tsx) (+ badge de catégorie dynamique à côté du nom de l'entreprise).
- Affichage dynamique de la vraie catégorie (via `resolveTypeFournisseur()`) : [app/(main)/fournisseur/[id]/commandes/[commandeId]/page.tsx](app/(main)/fournisseur/[id]/commandes/[commandeId]/page.tsx) (titre de carte « Informations {catégorie} », les deux libellés « FOURNISSEUR » du PDF généré, titre de page « Bon de Commande Prestataire ») et [lib/email/commandeFournisseur.ts](lib/email/commandeFournisseur.ts) (libellé de ligne dans l'email de notification admin, bandeau, objet).
- Au passage : les deux boutons « Nouveau fournisseur » inactifs (`onAddNew={() => {}}`) dans `fournisseur/commandes/page.tsx` et `fournisseur/factures/page.tsx` sont maintenant branchés sur une vraie `FournisseurModal`.

**Erreurs rencontrées & solutions**
- `tsc --noEmit` et `next lint` propres dès la première passe malgré l'ampleur des changements (changement de type `email: string | null` propagé correctement partout).
- `pnpm build` a de nouveau échoué avec `Cannot find module '.../next/dist/client/components/builtin/global-not-found'` (MODULE_NOT_FOUND) — 4ᵉ occurrence de cette corruption du store pnpm dans la même session, à chaque fois résolue par `pnpm install --force`. Le `ELIFECYCLE exit code 1` du build était masqué par le code de sortie de la commande de piping (`| tail`) qui, lui, réussit toujours — **pour un build qui échoue, toujours vérifier le message `Build error occurred`/`ELIFECYCLE`, pas seulement le code de sortie du wrapper**. Build confirmé réussi après réparation (27 routes, exit code réel capturé séparément = 0).

**À tester / points d'attention**
- Vérifier sur quelques fiches existantes connues (une « Fournisseur », une « Prestataire externe », une vide/legacy) que les onglets et badges les rangent dans la bonne catégorie à l'écran, sans que la donnée stockée ait changé.
- Créer un prestataire de chaque catégorie en laissant l'email vide ; créer un avec email rempli (contrainte d'unicité toujours active).
- Modifier une fiche avec un type legacy, confirmer qu'elle se pré-sélectionne sur « Prestataire interne », puis qu'un enregistrement sans toucher ce champ écrit bien « Prestataire interne » en base (nettoyage progressif, pas de migration de masse).
- Vérifier le PDF généré d'un bon de commande et l'email de notification admin pour confirmer que la catégorie affichée est la bonne pour chaque fournisseur de test.
- Cette corruption pnpm récurrente (4 fois en une session) mériterait une investigation côté admin de la machine (antivirus/EDR scannant `node_modules`, synchronisation de fichiers) — déjà signalé précédemment dans ce journal.

## 2026-10-20 (suite 4) — Bug : logo de la page de connexion invisible en production

**Demande / Contexte**
En production, le logo de la nouvelle page de connexion ne s'affichait pas, avec en log : `The requested resource isn't a valid image for /LOGO ROSE@300xcoupé.png received text/html; charset=utf-8`.

**Erreurs rencontrées & solutions**
- Écarté : problème de déploiement — `output: "standalone"` copie bien tout `public/` dans l'image Docker ([infra/Dockerfile](infra/Dockerfile) ligne `COPY --from=builder /app/public ./public`, un `COPY` Docker ne fait pas d'expansion shell donc gère les noms spéciaux sans souci), et le fichier était correctement suivi par git. `rplogo.png` (nom simple, utilisé ailleurs via `next/image`) fonctionne, lui, sans problème.
- **Cause réelle** : l'optimiseur d'images intégré de Next.js (route `/_next/image`) refait une requête HTTP interne vers le fichier source avant de l'optimiser ; avec des caractères comme l'espace, `@` et l'accent `é` dans le nom de fichier, cette requête interne est mal réencodée et échoue (404), et Next renvoie sa page d'erreur HTML à la place de l'image — un problème connu de `next/image` avec les noms de fichiers non-ASCII/contenant des espaces.
- **Solution** : renommer le fichier en un nom simple, sans espace ni caractère spécial.

**Modifications apportées**
- `public/LOGO ROSE@300xcoupé.png` renommé en [public/logo-rose.png](public/logo-rose.png) (`git mv`, historique conservé).
- [app/sign-in/[[...sign-in]]/page.tsx](app/sign-in/[[...sign-in]]/page.tsx) : référence mise à jour vers `/logo-rose.png`.

**À tester / points d'attention**
- Confirmer l'affichage du logo en prod après déploiement.
- Les autres fichiers du dossier `public/` avec des noms similaires (espaces/`@`/accents, ex. `RESEAUPUB LOGO MIX COLOR@300xcoupé.png`) ne sont actuellement référencés nulle part via `next/image` — mais s'ils venaient à l'être un jour, les renommer en premier pour éviter le même problème.

## 2026-10-20 (suite 3) — Ajustement du contenu de l'email de notification de paiement

**Demande / Contexte**
Après la première version de la notification « paiement reçu », l'utilisateur a demandé d'afficher plus clairement : le total de la proforma, le total déjà payé (cumulé), le montant payé à l'instant précis (ce paiement), et de remplacer le libellé « Progression du règlement » par « Payé à ...% » ; le « Reste à payer » doit être affiché en rouge pour attirer l'œil.

**Modifications apportées**
- [lib/email/proformaPaiement.ts](lib/email/proformaPaiement.ts) : le tableau récapitulatif affiche maintenant, dans l'ordre, « Total de la proforma », « Total payé » (cumulé = total − reste), « Payé à l'instant » (ce paiement précis), « Payé à X% » (libellé renommé), « Reste à payer » (en rouge `#b91c1c`/`#fef2f2`), puis la marge brute inchangée.

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit` et `next lint` propres.

**À tester / points d'attention**
- Vérifier le rendu de l'email reçu (couleurs, alignement) sur un vrai client mail après le prochain paiement réel.

## 2026-10-20 (suite 2) — Bug : timeout de transaction Prisma (P2028) à l'enregistrement d'un paiement

**Demande / Contexte**
En conditions réelles, l'enregistrement d'un paiement sur une proforma a échoué avec `PrismaClientKnownRequestError P2028 : Transaction already closed... The timeout for this transaction was 5000 ms, however 7427 ms passed`. Même famille de bug que celui déjà corrigé sur [app/api/factures/route.ts](app/api/factures/route.ts) (création de facture) : le `prisma.$transaction()` de la route de paiement n'avait pas de timeout explicite, donc le défaut Prisma de 5000 ms s'appliquait, insuffisant quand la base (Supabase) répond un peu lentement.

**Modifications apportées**
- [app/api/factures/[id]/paiements/route.ts](app/api/factures/[id]/paiements/route.ts) : ajout de `{ timeout: 15000 }` (15 secondes) en second argument du `prisma.$transaction()`, même valeur que sur les routes de création/modification de facture.

**Erreurs rencontrées & solutions**
- `P2028 Transaction already closed` → timeout par défaut (5s) trop court pour cette transaction (plusieurs requêtes séquentielles : lecture/écriture CashJournal, CashRegister, Paiement, Invoice). Résolu en portant le timeout à 15s, comme pour les autres transactions de l'app.

**À tester / points d'attention**
- Refaire un paiement en conditions réelles (celles qui ont déclenché l'erreur) pour confirmer que la transaction va désormais au bout.
- Si ce timeout revient à se produire même à 15s, il faudra regarder du côté de la latence réseau vers Supabase plutôt que d'augmenter encore le timeout (symptôme déjà observé ailleurs dans le projet comme transitoire).

## 2026-10-20 (suite) — Notification Admin (avec confetti 🎊) à chaque paiement reçu sur une proforma

**Demande / Contexte**
L'utilisateur veut que les administrateurs soient notifiés par email dès qu'un paiement client est enregistré sur une proforma, avec un résumé complet : numéro et objet de la proforma, client, produits pris, montant payé, reste à payer, pourcentage réglé et marge brute. Demande explicite : utiliser directement les comptes Admin existants de l'app (table `User`/`Role`), pas une liste d'emails en dur ou une variable d'environnement comme pour les autres notifications (`BUDGET_ADMIN_EMAILS`).

**Modifications apportées**
- [lib/email/proformaPaiement.ts](lib/email/proformaPaiement.ts) (nouveau) : `sendProformaPaiementNotification()`. Les destinataires (`adminRecipients()`) sont déterminés en interrogeant directement `prisma.user.findMany({ where: { active: true, role: { canManageUsers: true } } })` — le vrai mécanisme Admin de l'app (même critère que [lib/authz.ts](lib/authz.ts) `requireCanManageUsers`), pas une liste figée. Email avec en-tête vert « 🎊 Paiement réalisé ! », tableau des produits de la proforma, puis montant payé / reste à payer / % de progression du règlement / marge brute (Σ Paiement(PAIEMENT) − Σ Paiement(DEPENSE) de la proforma, même formule que le tableau de bord).
- [app/api/factures/[id]/paiements/route.ts](app/api/factures/[id]/paiements/route.ts) : la requête initiale de la facture inclut désormais `totalTTC`, `devise` et les `produits` (désignation + quantité). Après la transaction, uniquement pour `type === "PAIEMENT"` (pas pour une `DEPENSE`), recalcul de la marge via `paiement.groupBy` puis appel fire-and-forget (erreur seulement loguée, ne bloque jamais la réponse) à `sendProformaPaiementNotification`.

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit`, `next lint` propres dès la première passe.

**À tester / points d'attention**
- Vérifier qu'au moins un utilisateur actif a un rôle avec `canManageUsers = true` et un email valide en base (sinon `adminRecipients()` renvoie une liste vide et aucun email n'est envoyé, silencieusement).
- Tester un vrai paiement en conditions réelles (SMTP `EMAIL_HOST`/`EMAIL_USER`/`EMAIL_PASS` configurés) pour confirmer la réception et le rendu de l'email.
- Confirmer qu'une `DEPENSE` (dépense rattachée à une proforma) ne déclenche bien aucune notification — seul un paiement client (`PAIEMENT`) le fait.

## 2026-10-20 — Refonte UI/UX de la page de connexion (sign-in)

**Demande / Contexte**
L'utilisateur a fourni le code source de la page de connexion de CampTrack (autre app de l'entreprise) comme référence de style — écran scindé en deux, panneau de marque sombre avec cercles lumineux flous et liste de fonctionnalités, panneau de formulaire épuré — et a demandé de reprendre cette structure pour Proforma, mais avec la charte graphique propre à Proforma (couleur `#ef0b53`, et non le `#d61353` de CampTrack).

**Modifications apportées**
- [app/sign-in/[[...sign-in]]/page.tsx](app/sign-in/[[...sign-in]]/page.tsx) : réécriture complète. Panneau gauche (visible ≥ lg) fond `#0a0a0a` avec 3 cercles dégradés `#ef0b53` en arrière-plan, badge « RP » + nom « Reseaupub », accroche, liste de 4 fonctionnalités clés de l'app (facturation, fournisseurs/BC, budget/trésorerie, tableaux de bord), pied de page. Panneau droit : logo `LOGO ROSE@300xcoupé.png` (choisi car entièrement rose, lisible sur fond clair — `rplogo.png` écarté car son texte noir ne convenait pas), titre « Bienvenue », composant `<SignIn>` de Clerk stylisé via le prop `appearance` (uniquement des clés d'éléments documentées : `rootBox`, `card`, `headerTitle/Subtitle`, `formButtonPrimary`, `formFieldInput/Label`, `footerActionLink`, `dividerLine/Text`, `socialButtonsBlockButton`) pour que les champs et le bouton reprennent la couleur `#ef0b53` et les arrondis de la charte. Le pied de page « Secured by Clerk » de Clerk n'a volontairement pas été masqué (conditions d'utilisation Clerk).

**Erreurs rencontrées & solutions**
- `pnpm build` a échoué avec `Cannot find module '.../next/dist/client/components/builtin/global-not-found'` (MODULE_NOT_FOUND) — même symptôme de corruption du store pnpm que lors d'un précédent build (dossier `node_modules/next` vidé), sans rapport avec le code modifié. Résolu par `pnpm install --force`, puis `pnpm build` a abouti (27 routes, exit code 0). Si ce symptôme réapparaît régulièrement, il peut être utile d'investiguer la cause sur cette machine (antivirus, synchronisation de fichiers, etc. qui viderait le store pnpm).

**À tester / points d'attention**
- `tsc --noEmit`, `next lint` et `pnpm build` tous propres (vérifiés après l'implémentation).
- Vérifier visuellement le rendu sur mobile (le panneau gauche est masqué sous `lg`, un badge + logo compact apparaissent alors en haut du formulaire) et sur différents navigateurs avant mise en ligne.
- Tester le flux de connexion complet (champs, bouton, lien "mot de passe oublié"/inscription selon configuration Clerk) en conditions réelles après déploiement.

## 2026-10-17 (suite) — Refonte complète du Tableau de bord (trésorerie, marge brute, indicateurs de décision)

**Demande / Contexte**
L'ancien tableau de bord (`/dashboard`) était statique (pas de filtres, totaux toutes années confondues peu actionnables). L'utilisateur (chef d'entreprise) voulait un vrai outil de pilotage avec deux vues — « Général » et « Ce mois » — centré sur ce qui aide à la décision : la trésorerie disponible et sa tendance, la marge brute par proforma, le détail des entrées/sorties du mois avec graphiques, et d'autres indicateurs utiles, le tout simple à lire pour un non-technicien. `/statistiques` (page plus riche, déjà existante) reste intouchée à part, décision actée avec l'utilisateur pour éviter la confusion entre les deux pages qui s'appelaient toutes les deux « Tableau de Bord ».

Décisions actées avant l'implémentation :
- Marge brute = uniquement `Paiement(PAIEMENT) − Paiement(DEPENSE)` par proforma (confirmé par de nombreux exemples réels en base : carburant, réparations, location de panneaux, etc., toujours rattachés à une facture). Demandes de Budget et Bons de Commande Fournisseurs volontairement exclus du calcul pour l'instant.
- Suivi des campagnes CampTrack : hors scope de cette itération (aucun endpoint « campagnes en cours » n'existe encore côté CampTrack — à faire plus tard séparément).

**Modifications apportées**
- [app/api/dashboard/route.ts](app/api/dashboard/route.ts) : réécriture complète. Accepte `?view=global|month`. Trésorerie (soldes par caisse + tendance 30 jours) calculée une fois et partagée par les deux vues. Vue Général : évolution de trésorerie 12 mois (reconstruite à rebours depuis le solde réel actuel, pas depuis `CashJournal.solde` qui peut dériver), marge brute par proforma (`invoice.findMany` + `paiement.groupBy`, zéro N+1, conversion de devise via la même table que `/api/statistiques`), et 4 indicateurs supplémentaires (taux de conversion proforma→payée/soldée, top 5 clients débiteurs, délai moyen de règlement, impayés anciens +30j). Vue Ce mois : lignes d'entrée/sortie détaillées du mois (avec exclusion des transferts internes entre caisses visibles, logique reprise exactement de `journal-caisse/page.tsx`), totaux, fluctuation quotidienne, marge brute (paiements proforma) du mois.
- [app/(main)/dashboard/page.tsx](app/(main)/dashboard/page.tsx) : réécriture complète. `Tabs` shadcn (Général/Ce mois), données hissées au niveau page (pas dans les onglets, pour éviter un refetch à chaque clic — Radix démonte le contenu inactif) ; vue Général chargée au montage, vue Ce mois chargée paresseusement au premier clic puis mise en cache.
- [components/StatCard.tsx](components/StatCard.tsx) (nouveau) : carte KPI partagée, avec un nouveau prop `trend` optionnel (flèche + libellé, jamais de % complexe) — factorise les deux implémentations dupliquées qui existaient (`dashboard/page.tsx` et `statistiques/page.tsx`, cette dernière volontairement laissée inchangée).
- [components/dashboard/](components/dashboard/) (nouveau dossier) : `TresorerieSection.tsx`, `CashFlowEvolutionChart.tsx`, `MargeProformaSection.tsx`, `CashJournalLinesCard.tsx`, `MonthlyFluctuationChart.tsx`, `ExtraIndicatorsSection.tsx`.
- [components/DashboardPageSkeleton.tsx](components/DashboardPageSkeleton.tsx) (nouveau).

**Erreurs rencontrées & solutions**
Aucune — `tsc --noEmit` et `next lint` propres dès la première passe.

**À tester / points d'attention**
- Comparer les soldes par caisse affichés avec `/journal-caisse` (doivent être identiques).
- Vérifier que les lignes « Transfert depuis/vers caisse ID X » entre deux caisses visibles n'apparaissent pas dans les totaux Entrées/Sorties du mois, alors qu'elles apparaissent dans le journal brut.
- Comparer la marge brute de 3-5 proformas de la table avec la « Marge nette générée » déjà affichée sur `facture/[id]/page.tsx` pour ces mêmes factures — doivent être égales.
- Vérifier dans les DevTools réseau qu'un seul appel `?view=month` est fait au premier clic sur l'onglet « Ce mois », jamais répété ensuite.
- Le suivi des campagnes CampTrack reste à ajouter dans une itération séparée (nécessite un nouvel endpoint côté CampTrack).

## 2026-10-17 (suite 2) — Vraie cause du crash identifiée : bug upstream React, contourné via le middleware

**Demande / Contexte**
Après la correction du `await` manquant sur `auth.protect()`, le crash « Rendered more hooks than during the previous render » s'est reproduit avec une stack trace complète et non minifiée, montrant que l'erreur se produit **entièrement à l'intérieur du code compilé de Next.js/React** (`Router`, `useMemo`, dans `next_dist_client`/`react-dom` compilé) — aucune frame de code applicatif. Recherche approfondie pour confirmer la cause exacte avant de tenter un nouveau correctif.

**Erreurs rencontrées & solutions**
- **Cause confirmée** : il s'agit d'un bug connu et documenté de **React lui-même** (facebook/react#33580, suivi côté Next.js sous vercel/next.js#63121 — des dizaines de rapports dupliqués), déclenché par le pattern exact utilisé dans [app/page.tsx](app/page.tsx) : un `redirect()` de Next.js appelé dans un Server Component **juste après** un `await currentUser()`/`await auth()`. C'est littéralement l'exemple de reproduction cité dans le rapport du bug upstream (`const session = await auth(); if (session) redirect("/dashboard")`). Le correctif officiel n'est arrivé dans React/Next que bien après la version utilisée ici (Next 15.4.4 / React 19.1.0) — aucun patch n'existait pour cette ligne de version au moment des faits.
- **Solution retenue** : contourner complètement ce chemin de code bogué plutôt que d'attendre un correctif amont. La résolution de la destination post-connexion (`/sign-in` ou la première section autorisée par le rôle) est déplacée du Server Component `app/page.tsx` vers [middleware.ts](middleware.ts), sous forme de **redirection HTTP directe** (`NextResponse.redirect()`) — qui n'implique aucun rendu React côté client pour `/`, donc ne peut pas déclencher ce bug.

**Modifications apportées**
- [middleware.ts](middleware.ts) : `/` retirée de `isPublicRoute` ; nouveau bloc en tout début de middleware qui calcule la destination (`resolveLandingUrl`) et effectue la redirection HTTP directement, avant toute autre logique.
- [app/page.tsx](app/page.tsx) : simplifié au strict minimum (plus de `await` suivi d'un `redirect()`) — ce composant ne devrait normalement plus jamais s'exécuter puisque le middleware intercepte systématiquement `/` en premier ; conservé uniquement comme filet de sécurité volontairement inoffensif.

**À tester / points d'attention**
- Redémarrer complètement le serveur (dev et prod) et tester le flux de connexion plusieurs fois de suite, y compris en visitant directement `/` déjà connecté et déjà déconnecté.
- Si un crash similaire réapparaît ailleurs dans l'app, chercher le même pattern (`redirect()` après un `await` dans un Server Component avec un Suspense/`loading.tsx` dans l'arbre) — c'est la signature de ce même bug upstream, pas nécessairement un nouveau problème.

## 2026-10-17 (suite) — `auth.protect()` appelé sans `await` dans le middleware (vraie cause probable du crash)

**Demande / Contexte**
Après la correction de `app/layout.tsx` (archivage bloquant), l'utilisateur a reproduit le crash en local et fourni les logs complets : une erreur d'hydratation sur `/sign-in` (bénigne, React se régénère tout seul), un crash « Rendered more hooks than during the previous render » survenant **à l'intérieur du code interne de Next.js** (`app-router.tsx`, pas dans le code applicatif), et surtout une vraie erreur serveur non gérée après rafraîchissement : `⨯ unhandledRejection: Error: NEXT_HTTP_ERROR_FALLBACK;404`, provenant de `authHandler.protect()` (Clerk).

**Erreurs rencontrées & solutions**
- **Cause trouvée** : [middleware.ts](middleware.ts) ligne 39 appelait `auth.protect()` (fonction **asynchrone** de Clerk) **sans `await`**, à l'intérieur d'un `try { ... } catch { ... }`. Comme l'appel n'était pas attendu, le `catch` ne pouvait jamais intercepter son rejet (qui survient de façon asynchrone, après que le bloc `try` synchrone se soit déjà terminé sans erreur apparente). Résultat concret : quand un utilisateur non authentifié arrivait sur une route protégée, `auth.protect()` rejetait en interne (Clerk appelle `notFound()` de Next.js par défaut), ce rejet partait en erreur serveur non gérée, et la redirection propre vers `/sign-in` prévue dans le `catch` ne s'exécutait **jamais**. Ça laissait le client recevoir une réponse incohérente, plausiblement à l'origine des mismatchs d'hydratation et du crash du routeur Next.js observés côté navigateur.
- **Solution** : ajout du `await` manquant (`await auth.protect();`).
- Le crash « Rendered more hooks » dans `app-router.tsx` (code interne Next.js, survenu juste après un rebuild Fast Refresh anormalement lent de ~100 secondes) est très probablement un artefact de Turbopack/HMR en développement local, aggravé par l'incohérence causée par le bug ci-dessus — pas un bug dans le code applicatif (audit complet des composants React de l'app n'a révélé aucune violation des règles des hooks).

**Modifications apportées**
- [middleware.ts](middleware.ts) : `auth.protect()` → `await auth.protect()`.

**À tester / points d'attention**
- Redémarrer complètement le serveur de dev (pas juste compter sur le Hot Reload) et retester le flux de connexion plusieurs fois de suite, y compris avec un compte non authentifié arrivant sur une route protégée.
- Redéployer en production et surveiller si le crash signalé initialement se reproduit.

## 2026-10-17 — Archivage automatique bloquant sur chaque page (crash au login en production)

**Demande / Contexte**
L'utilisateur a signalé un crash complet de l'app au chargement (« Application error: a client-side exception has occurred ») lors de la connexion, avec en console une erreur React minifiée #310 (« Rendered more hooks than during the previous render »), puis une seconde erreur `Clerk: Failed to load Clerk (code="failed_to_load_clerk_js_timeout")`. Un rafraîchissement de la page résout systématiquement le problème.

**Erreurs rencontrées & solutions**
- Audit complet de tous les composants React modifiés récemment (ordre des hooks, retours anticipés dans `CommandeStatutControl`, `EditCommandeFournisseurModal`, `FournisseurProduits`, `app/(main)/facture/[id]/page.tsx`, `app/(main)/fournisseur/[id]/commandes/[commandeId]/page.tsx`, `AppSidebar`, etc.) : **aucune violation des règles des hooks trouvée** dans le code applicatif.
- L'erreur React #310 est très probablement une **conséquence** du vrai problème, pas sa cause : le timeout de chargement de Clerk (`failed_to_load_clerk_js_timeout`) laisse l'app dans un état incohérent, ce qui perturbe le rendu des composants dépendant de `useUser()`/`ClerkProvider` (ex: `AppSidebar`).
- **Cause racine identifiée** : [app/layout.tsx](app/layout.tsx) (layout racine, `force-dynamic`, donc exécuté à CHAQUE requête, pour CHAQUE utilisateur, sur CHAQUE page) faisait `await archiveOldInvoices()` — une requête d'écriture en base — avant de rendre quoi que ce soit. Ça bloquait l'envoi du HTML tant que la requête DB n'était pas terminée. Si Supabase répond lentement (déjà observé plusieurs fois durant cette session), ça retarde le chargement de la page entière, ce qui peut suffire à faire dépasser le délai de chargement du script Clerk côté navigateur → timeout → app cassée. Un rafraîchissement réussit généralement car Clerk a déjà mis son script en cache.
- [lib/archive-service.ts](lib/archive-service.ts) : `archiveOldInvoices()` instanciait en plus son propre `new PrismaClient()` séparé du pool partagé de l'app (`lib/prisma.ts`), au lieu de le réutiliser — corrigé.

**Modifications apportées**
- [lib/archive-service.ts](lib/archive-service.ts) : utilise désormais le client Prisma partagé (`lib/prisma.ts`) au lieu d'en créer un nouveau.
- [app/layout.tsx](app/layout.tsx) : `archiveOldInvoices()` n'est plus `await`é (fire-and-forget, ne bloque plus jamais le rendu d'une page) et est limité à une exécution par heure par process serveur (évite de marteler la base à chaque requête).

**À tester / points d'attention**
- Redéployer et surveiller si le crash au login se reproduit. Si ça persiste malgré cette correction, le problème serait alors probablement lié à la connectivité réseau du VPS vers les serveurs de Clerk (DNS, pare-feu, latence) plutôt qu'au code de l'application — à investiguer côté infra si besoin.
- Envisager à terme de sortir complètement l'archivage automatique du cycle de requête HTTP (vrai cron job plutôt qu'un hook dans le layout), `lib/archive-service.ts` a déjà un point d'entrée CLI (`require.main === module`) prévu pour ça.

## 2026-10-11 (suite) — Correction timeout de transaction à la création d'une facture (P2028)

**Demande / Contexte**
L'utilisateur a rencontré une erreur lors de la création d'une facture : `PrismaClientKnownRequestError P2028 — Transaction API error: Transaction not found`, après ~19 secondes d'attente, en échouant sur `tx.produit.findUnique()`.

**Erreurs rencontrées & solutions**
- **Cause** : `POST /api/factures` ouvrait sa transaction Prisma (`prisma.$transaction(async (tx) => {...})`) sans timeout explicite, donc avec la valeur par défaut (5 secondes). La route d'édition (`PATCH /api/factures/[id]`) avait déjà été corrigée avec `{ timeout: 15000 }`, mais la route de création ne l'avait jamais reçu. Avec une réponse Supabase plus lente que d'habitude, la transaction a dépassé les 5 secondes et a été fermée côté serveur pendant que le code essayait encore de l'utiliser.
- **Solution** :
  - [app/api/factures/route.ts](app/api/factures/route.ts) : ajout de `{ timeout: 15000 }` sur la transaction de création (même valeur que la route d'édition).
  - Dans la même transaction, la création des lignes de produits (`InvoiceProduit`) est passée de `Promise.all(produits.map(...))` à une boucle `for` séquentielle — une transaction interactive Prisma est liée à une seule connexion, donc des requêtes « concurrentes » sur `tx` ne s'exécutent pas réellement en parallèle et n'apportaient qu'une latence/charge inutile, augmentant le risque de dépasser le timeout sur les proformas à plusieurs lignes.

**À tester / points d'attention**
- Recréer une facture avec plusieurs produits pour confirmer que l'erreur ne se reproduit plus, y compris en cas de lenteur réseau vers Supabase.

## 2026-10-11 — Remise sur le Total HT des proformas/factures

**Demande / Contexte**
Les proformas n'avaient aucune notion de remise. L'utilisateur veut pouvoir cocher une case « Remise » à la création et à l'édition d'une proforma, puis choisir entre un pourcentage du Total HT ou un montant fixe à déduire. Décision validée : la TVA (18%) se calcule sur le HT **après** remise (pratique standard de facturation), pas sur le HT brut — `Total TTC = (HT − Remise) + TVA`. Retour utilisateur sur l'affichage : la ligne « Remise » doit apparaître **avant** la ligne « Total HT », et la ligne « Total HT » doit montrer le montant original **barré** suivi du montant net, plutôt qu'une simple ligne de déduction après coup.

**Modifications apportées**
- [prisma/schema.prisma](prisma/schema.prisma) : nouvel enum `DiscountType` (`POURCENTAGE`/`MONTANT`) et 4 nouveaux champs sur `Invoice` : `isDiscountEnabled`, `discountType`, `discountValue` (valeur brute saisie), `discountAmount` (montant calculé, toujours stocké comme `tva`/`totalTTC`, jamais recalculé à la lecture). Migration `prisma/migrations/20261011205929_add_remise_invoice/`, aucun backfill nécessaire (défauts `false`/`0` n'affectent pas les factures existantes).
- [lib/constants.ts](lib/constants.ts) : `DISCOUNT_TYPE`/`DISCOUNT_TYPE_OPTIONS` (même pattern que `DEVISE`/`UNITE_DUREE`).
- [app/api/factures/route.ts](app/api/factures/route.ts) (POST) et [app/api/factures/[id]/route.ts](app/api/factures/[id]/route.ts) (`updateFacture`, PATCH/PUT) : calcul `discountAmount` (plafonné au Total HT, ne peut pas rendre le HT net négatif) → TVA calculée sur `totalHT − discountAmount` → `totalTTC`. Côté édition, la condition de recalcul est élargie pour se déclencher aussi quand seuls les champs de remise changent (sans toucher aux produits) ; la cascade `resteAPayer = round(totalTTC − Σpaiements)` déjà existante reste inchangée, elle utilise simplement le nouveau `totalTTC`.
- [components/FactureForm.tsx](components/FactureForm.tsx) : nouveau bloc Switch + Select(type) + Input(valeur) dans la carte Configuration (même pattern que le switch TVA existant) ; carte Récapitulatif mise à jour (Remise avant Total HT, Total HT barré + montant net).
- [app/(main)/facture/[id]/page.tsx](app/(main)/facture/[id]/page.tsx) : mêmes contrôles en mode édition inline (header de la carte « Objet de la Mission »), mêmes calculs réactifs (`currentDiscountAmount`/`currentTotalHTApresRemise`), même affichage dans la carte « Récapitulatif Financier ».
- [lib/pdf.ts](lib/pdf.ts) : nouveau helper `drawStrikethroughText` (pdf-lib n'a pas de style barré natif — dessine le texte puis trace un trait fin dessus) ; ligne « Remise » insérée avant « Total HT », qui affiche désormais le montant original barré suivi du montant net quand une remise est active.
- [app/(main)/facture/page.tsx](app/(main)/facture/page.tsx) : colonne « Remise » ajoutée à l'export Excel, entre Total HT et TVA.

**Erreurs rencontrées & solutions**
Aucune.

**À tester / points d'attention**
- Créer une proforma avec une remise en % et vérifier HT (barré + net)/Remise/TVA/TTC dans le formulaire puis après création.
- Idem avec un montant fixe, et vérifier le plafonnement (remise > HT ne doit pas donner un HT net négatif).
- Éditer une proforma existante pour activer/modifier/désactiver la remise, en particulier si des paiements existent déjà (vérifier que `resteAPayer` se recalcule correctement).
- Télécharger le PDF et vérifier l'affichage barré + montant net sur la ligne Total HT, et la ligne Remise juste au-dessus.
- Vérifier la nouvelle colonne Remise dans l'export Excel.

## 2026-10-11 (suite) — Workflow complet de validation des bons de commande fournisseurs (statut partout + édition en brouillon)

**Demande / Contexte**
L'admin doit pouvoir changer le statut d'un bon de commande fournisseur depuis n'importe quel écran (liste globale, onglet « Bons de Commande » d'un fournisseur, et la page de détail/PDF — qui n'avait jusqu'ici aucun contrôle de statut). Une fois un bon passé à « Validée », les autres utilisateurs (non-admin) doivent avoir accès à un seul bouton : confirmer l'envoi, ce qui fait passer le bon à « Livrée » (fin du processus pour un non-admin). Par ailleurs, tant qu'un bon est en « Brouillon », il doit être possible de le modifier intégralement (lignes/produits, TVA/AIB, proformas associées, date) via un bouton dédié — cette capacité d'édition n'existait pas du tout jusqu'ici (seule la création existait).

**Modifications apportées**
- [lib/commandeFournisseurCalc.ts](lib/commandeFournisseurCalc.ts) (nouveau) : extraction des calculs partagés (taux TVA/AIB, calcul de surface/prix d'une ligne, calcul HT→TVA→TTC→AIB→Net, liste des statuts de proforma associables) — précédemment dupliqués entre la route de création et maintenant aussi la route d'édition ; réutilisé par les deux pour éviter une 4ᵉ divergence de formule comme celles corrigées plus tôt aujourd'hui.
- [app/api/fournisseurs/commandes/[commandeId]/route.ts](app/api/fournisseurs/commandes/[commandeId]/route.ts) :
  - `PATCH` (changement de statut) : nouvelle règle d'autorisation — un admin (`BUDGET_ADMIN_EMAILS`) peut changer le statut librement ; un non-admin ne peut faire **qu'une seule transition** : confirmer l'envoi d'un bon `VALIDEE` → `LIVREE` (403 sinon).
  - `PUT` (nouveau) : modification complète d'un bon de commande — remplace les lignes et les proformas associées, recalcule HT/TVA/AIB/TTC/Net, revalide les proformas (statuts associables). Refusé (403) si le bon n'est plus en `BROUILLON`.
- [components/fournisseurs/CommandeStatutControl.tsx](components/fournisseurs/CommandeStatutControl.tsx) (nouveau) : composant partagé encapsulant la règle d'affichage — admin et statut non verrouillé → menu déroulant complet ; non-admin et statut `VALIDEE` → bouton « Confirmer l'envoi » ; sinon → badge en lecture seule. Réutilisé dans les 3 écrans pour éviter de dupliquer cette logique.
- [components/fournisseurs/EditCommandeFournisseurModal.tsx](components/fournisseurs/EditCommandeFournisseurModal.tsx) (nouveau) : modale d'édition complète d'un bon de commande en brouillon (mêmes champs que la création — lignes/produits, dimensions, TVA/AIB, proformas — fournisseur fixe et non modifiable), soumet en `PUT`.
- [app/(main)/fournisseur/commandes/page.tsx](app/(main)/fournisseur/commandes/page.tsx) et [components/fournisseurs/FournisseurCommandes.tsx](components/fournisseurs/FournisseurCommandes.tsx) : remplacement de l'affichage de statut par `CommandeStatutControl` (le second n'avait jusqu'ici aucun contrôle, juste un badge statique).
- [app/(main)/fournisseur/[id]/commandes/[commandeId]/page.tsx](app/(main)/fournisseur/[id]/commandes/[commandeId]/page.tsx) : ajout du contrôle de statut dans l'en-tête (remplace le badge statique) ; nouveau bouton « Modifier » dans la barre d'actions, visible uniquement si `statut === BROUILLON`, ouvrant `EditCommandeFournisseurModal`.

**Erreurs rencontrées & solutions**
Aucune.

**À tester / points d'attention**
- Tester les 3 écrans avec un compte admin (menu déroulant complet partout) et un compte non-admin (badge partout, sauf bouton « Confirmer l'envoi » quand `VALIDEE`).
- Tester directement l'API : `PATCH` avec un compte non-admin sur une transition autre que VALIDEE→LIVREE doit renvoyer 403 ; `PUT` sur un bon non-BROUILLON doit renvoyer 403.
- Modifier un bon en brouillon (ajouter/retirer des lignes, changer TVA/AIB, changer les proformas associées) et vérifier que les totaux et le PDF reflètent bien les nouvelles valeurs après enregistrement.

---

## 2026-10-11 — Modification des produits fournisseur (fonctionnalité manquante)

**Demande / Contexte**
L'utilisateur a signalé ne pas pouvoir modifier les produits du catalogue d'un fournisseur sur son VPS. Après clarification, ce n'est pas un bug spécifique à la production : la fonctionnalité d'édition n'avait tout simplement jamais été construite pour `ProduitFournisseur` — seules la création et la gestion des photos (ajoutées le 2026-10-06) existaient.

**Modifications apportées**
- [app/api/fournisseurs/produits/[id]/route.ts](app/api/fournisseurs/produits/[id]/route.ts) (nouveau) : `PUT` pour modifier désignation/description/prixUnitaire/typeUnite d'un produit existant (JSON, validation Zod), renvoie le produit avec ses photos.
- [components/fournisseurs/EditProduitDialog.tsx](components/fournisseurs/EditProduitDialog.tsx) (nouveau) : dialogue de modification, mêmes champs que le formulaire de création.
- [components/fournisseurs/FournisseurProduits.tsx](components/fournisseurs/FournisseurProduits.tsx) : ajout d'un bouton crayon en haut à droite de chaque carte produit (indépendant du clic sur la carte qui ouvre la galerie photos) ouvrant `EditProduitDialog`.

**Erreurs rencontrées & solutions**
Aucune.

**À tester / points d'attention**
- Vérifier la modification d'un produit (prix, désignation, unité) et que les photos restent bien affichées après modification.
- Déployer sur le VPS pour que l'utilisateur confirme que le bouton de modification est bien présent.

---

## 2026-10-06 (suite 5) — Validation admin des bons de commande fournisseurs (email + restriction de statut)

**Demande / Contexte**
À la création d'un bon de commande fournisseur, un email doit être envoyé aux admins pour validation, et seuls les profils admin doivent pouvoir changer le statut du bon de commande (actuellement n'importe quel utilisateur ayant accès à la page pouvait changer librement le statut, sans aucune vérification serveur). Décision validée avec l'utilisateur : réutiliser directement la même liste d'admins que pour les Demandes de Budget (`BUDGET_ADMIN_EMAILS`, via `lib/budgetAuth.ts`), pas de nouvelle liste séparée.

**Modifications apportées**
- [lib/email/commandeFournisseur.ts](lib/email/commandeFournisseur.ts) (nouveau) : `sendCommandeFournisseurCreeeNotification(commande)`, calqué exactement sur `lib/email/demandeBudget.ts` (même template HTML, même fonction `adminRecipients()` lisant `BUDGET_ADMIN_EMAILS`, retour silencieux si la liste est vide). Email envoyé aux admins avec le détail du bon de commande (lignes, montant net) et un lien direct vers la page de détail.
- [app/api/fournisseurs/commandes/route.ts](app/api/fournisseurs/commandes/route.ts) : POST — après création, appel fire-and-forget (`.catch(console.error)`) à `sendCommandeFournisseurCreeeNotification`, même pattern que `app/api/demandes-budget/route.ts`. Le `include` de la création ajoute `fournisseur: true` (nécessaire pour l'email).
- [app/api/fournisseurs/commandes/[commandeId]/route.ts](app/api/fournisseurs/commandes/[commandeId]/route.ts) : PATCH (changement de statut) protégé par `requireBudgetAdmin()` en tout début de handler — renvoie 401/403 si l'utilisateur n'est pas authentifié ou n'est pas dans `BUDGET_ADMIN_EMAILS`.
- [app/(main)/fournisseur/commandes/page.tsx](app/(main)/fournisseur/commandes/page.tsx) : récupère le rôle via la route existante `GET /api/demandes-budget/me-role` (réutilisée telle quelle, même liste d'admins) ; le sélecteur de statut n'est affiché que si `isAdmin` est vrai — sinon un badge en lecture seule s'affiche, comme pour les statuts déjà verrouillés (LIVREE/ANNULEE).

**Erreurs rencontrées & solutions**
- `npx prisma generate` était bloqué depuis plusieurs entrées précédentes par une erreur `EPERM` (fichier verrouillé par le serveur `next dev` de l'utilisateur). Résolu : l'utilisateur a arrêté son serveur, la génération a réussi.

**À tester / points d'attention**
- `npx tsc --noEmit` et `npx next lint` relancés avec succès (aucune erreur) sur l'ensemble des changements accumulés aujourd'hui (TVA/AIB, proformas associées, surface /10000, photos produits, et cette validation admin).
- Tester en conditions réelles : créer un bon de commande → vérifier la réception de l'email par les adresses `BUDGET_ADMIN_EMAILS` ; tenter de changer le statut avec un compte non-admin (le sélecteur ne doit pas apparaître, et un appel direct à l'API doit renvoyer 403) ; changer le statut avec un compte admin (doit fonctionner normalement).

## 2026-10-06 (suite 4) — Photos sur les produits fournisseur + affichage en cartes

**Demande / Contexte**
Chaque produit du catalogue d'un fournisseur doit pouvoir avoir une ou plusieurs photos pour l'illustrer, et l'affichage de la liste des produits doit passer d'un tableau à des cartes (cards) pour faciliter la lecture visuelle.

**Modifications apportées**
- [prisma/schema.prisma](prisma/schema.prisma) : nouveau modèle `ProduitFournisseurPhoto` (id, produitFournisseurId, url, fileName, fileType, createdAt — `onDelete: Cascade`), relation `photos` ajoutée sur `ProduitFournisseur`. Migration `prisma/migrations/20261006093552_add_produit_fournisseur_photos/`.
- [lib/uploadProduitFournisseur.ts](lib/uploadProduitFournisseur.ts) (nouveau) : `saveProduitFournisseurPhotos(produitId, files)` écrit les fichiers dans `public/Upload/ProduitFournisseur/<produitId>/...` et retourne les métadonnées à persister — même pattern que `lib/uploadDemandeBudget.ts`/`lib/uploadFactureFournisseur.ts` (y compris `describeFsError`).
- [app/api/fournisseurs/produits/route.ts](app/api/fournisseurs/produits/route.ts) : le `POST` passe de JSON à `multipart/form-data` (`request.formData()`) pour accepter des fichiers `photos` en plus des champs produit existants ; `GET` inclut désormais `photos`.
- [app/api/fournisseurs/produits/[id]/photos/route.ts](app/api/fournisseurs/produits/[id]/photos/route.ts) (nouveau) : `POST` pour ajouter des photos à un produit déjà existant, `DELETE ?photoId=` pour en retirer une (suppression de la ligne en base uniquement, le fichier reste sur disque — comportement identique aux autres pièces jointes du projet, aucune route existante ne nettoie les fichiers physiques).
- [components/fournisseurs/ProduitPhotosDialog.tsx](components/fournisseurs/ProduitPhotosDialog.tsx) (nouveau) : dialogue galerie d'un produit (grille de miniatures, suppression au survol, zone d'ajout de nouvelles photos).
- [components/fournisseurs/FournisseurProduits.tsx](components/fournisseurs/FournisseurProduits.tsx) : remplacement du `<Table>` par une grille de `Card` (image de couverture = première photo ou icône de remplacement, badge « +N photos » si plusieurs, désignation, description tronquée, unité, prix) ; clic sur une carte → ouvre `ProduitPhotosDialog`. Le formulaire de création accepte désormais un sélecteur de photos multiple avec aperçus (miniatures + suppression avant envoi), soumis en `FormData`.

**Erreurs rencontrées & solutions**
- `npx prisma generate` est resté bloqué un moment par une erreur `EPERM` (fichier verrouillé par le serveur `next dev` de l'utilisateur, qui gardait l'ancien client Prisma chargé en mémoire). Résolu après l'arrêt du serveur par l'utilisateur — `tsc --noEmit` et `next lint` ont ensuite été relancés avec succès sur l'ensemble des changements accumulés (voir entrée « suite 5 »).

**À tester / points d'attention**
- Tester la création d'un produit avec plusieurs photos, l'ajout de photos sur un produit existant, la suppression d'une photo, et l'affichage de la grille de cartes avec et sans photo.
- Vérifier en production que `public/Upload/` est bien un volume persistant sur le VPS (point déjà documenté comme non vérifié pour les autres uploads du projet).

---

## 2026-10-06 (suite 3) — Retour définitif à la conversion de surface /10000 (correction d'une erreur sur le bon de commande papier)

**Demande / Contexte**
Après avoir ajouté une colonne d'affichage « Surface (m²) » dans les formulaires de création de BCF (calculée avec la convention /1000 validée dans l'entrée précédente), l'utilisateur a précisé que la conversion correcte est en réalité **/10000** — y compris pour le calcul du prix, pas seulement pour l'affichage. Confirmé explicitement malgré l'avertissement que cela ne reproduirait plus les chiffres du bon de commande papier n°095 (9622,8 / 11355 / 11066) : ce document papier contenait donc lui-même une erreur de calcul de surface, qui ne doit pas être reproduite dans l'application.

**Modifications apportées**
- [app/api/fournisseurs/commandes/route.ts](app/api/fournisseurs/commandes/route.ts), [components/CommandeFournisseurModal.tsx](components/CommandeFournisseurModal.tsx), [components/fournisseurs/NewCommandeForm.tsx](components/fournisseurs/NewCommandeForm.tsx) : conversion de surface repassée à `(largeur_cm × hauteur_cm) / 10000` (conversion géométrique standard cm²→m²) partout — calcul du prix ET colonne d'affichage « Surface (m²) » désormais alignés sur /10000.

**Erreurs rencontrées & solutions**
Aucune — correction directe suite à confirmation explicite de l'utilisateur.

**À tester / points d'attention**
- En réexaminant le bon de commande papier 095 : avec /10000 et la quantité correctement multipliée, HT = (99×54/10000) × 10 × 1800 = 0,5346 × 10 × 1800 = **9622,8** — exactement le même résultat qu'avec /1000 sans multiplier par la quantité. Les deux hypothèses coïncidaient uniquement parce que Qté=10 sur cet exemple précis (10 = le facteur d'écart entre /1000 et /10000). Il n'y avait donc pas d'« erreur de saisie » sur ce bon de commande : la vraie formule a toujours été Surface(/10000) × Qté × PU/m², ce qui confirme que /10000 est la bonne conversion. À vérifier sur un bon de commande avec une quantité différente de 10 pour confirmer definitivement.

---

## 2026-10-06 (suite 2) — Correction du modèle TVA/AIB d'après un bon de commande papier réel

**Demande / Contexte**
L'utilisateur a fourni la photo d'un bon de commande fournisseur papier réel (n°095, MARK ISRO) avec le calcul concret déjà en usage dans l'entreprise. En reconstituant le calcul chiffre par chiffre, trois écarts sont apparus par rapport à ce qui avait été codé dans les deux précédentes entrées du jour :
1. La conversion de surface utilise **/1000** (convention métier, prix au m² calibré dessus), et non /10000 (conversion géométrique stricte cm²→m²) comme cela avait été « corrigé » à tort précédemment.
2. Le taux d'AIB est de **3%**, pas 5%.
3. **L'AIB ne s'ajoute pas au Total TTC.** Le Total TTC = HT + TVA uniquement. L'AIB (calculée sur le HT) se **déduit** du TTC pour obtenir un nouveau montant, le **Montant Net**, qui est la somme réellement versée au fournisseur (l'AIB étant une retenue reversée directement aux impôts par Reseaupub).

Formule confirmée et vérifiée sur l'exemple réel (Surface 99×54cm, Qté 10, PU/m² 1800) : HT = 9622,8 ; TVA 18% = 1732 ; TTC = 11355 ; AIB 3% = 289 ; Montant Net = TTC − AIB = 11066. Un point a été vérifié avec l'utilisateur : sur cet exemple précis, la quantité (10) ne multipliait pas le montant HT — confirmé comme une erreur de saisie sur ce bon de commande particulier, la quantité doit bien multiplier normalement (Surface × Qté × PU/m²), ce qui était déjà le comportement du code.

**Modifications apportées**
- [prisma/schema.prisma](prisma/schema.prisma) : nouveau champ `montantNet` sur `CommandeFournisseur`. Migration `prisma/migrations/20261006083326_add_montant_net_commande_fournisseur/`, avec recalcul des bons de commande déjà créés aujourd'hui (`montantAib` à 3%, `totalTTC` = HT+TVA sans AIB, `montantNet` = TTC−AIB) — aucune donnée historique antérieure à cette feature n'est touchée.
- [app/api/fournisseurs/commandes/route.ts](app/api/fournisseurs/commandes/route.ts) : `TAUX_AIB` passé à 0.03 ; conversion de surface passée à `/1000` ; `totalTTC` ne contient plus l'AIB ; nouveau calcul `montantNet = totalTTC - montantAib`, persisté.
- [components/CommandeFournisseurModal.tsx](components/CommandeFournisseurModal.tsx) et [components/fournisseurs/NewCommandeForm.tsx](components/fournisseurs/NewCommandeForm.tsx) : mêmes corrections (taux, surface, formule) ; récapitulatif restructuré pour refléter l'ordre réel du document papier : Total HT → TVA → Total TTC → AIB (déduite) → **Montant Net** (mis en évidence, c'est la nouvelle ligne finale).
- [app/(main)/fournisseur/[id]/commandes/[commandeId]/page.tsx](app/(main)/fournisseur/[id]/commandes/[commandeId]/page.tsx) : même restructuration dans la page de détail et dans le PDF généré (bloc coloré final renommé « MONTANT NET » au lieu de « TOTAL TTC »).
- [app/(main)/fournisseur/commandes/page.tsx](app/(main)/fournisseur/commandes/page.tsx) et [components/fournisseurs/FournisseurCommandes.tsx](components/fournisseurs/FournisseurCommandes.tsx) : colonne et cartes de synthèse « Total TTC » renommées « Montant Net » (c'est désormais le montant le plus représentatif du réellement dû).

**Erreurs rencontrées & solutions**
- `npx prisma generate` a échoué avec une erreur `EPERM` (fichier `query_engine-windows.dll.node` verrouillé par un processus Node en cours — très probablement le serveur `next dev` de l'utilisateur qui tenait le client Prisma chargé en mémoire). Résolu en demandant à l'utilisateur d'arrêter son serveur de développement avant de relancer la génération.

**À tester / points d'attention**
- Reproduire exactement l'exemple du bon de commande 095 dans l'application (Hauteur 99cm, Largeur 54cm, Qté 10, PU/m² 1800, TVA et AIB activées) et vérifier que l'app affiche bien HT=9622,8 / TVA=1732 / TTC=11355 / AIB=289 / Montant Net=11066.
- Vérifier qu'un bon de commande créé avec les anciennes valeurs (AIB à 5%, TTC incluant l'AIB) a bien été recalculé correctement par la migration.

---

## 2026-10-06 (suite) — Détail TVA/AIB toujours visible + association de proformas aux bons de commande fournisseurs

**Demande / Contexte**
Complément à la feature TVA/AIB du jour : (1) le détail du bon de commande et le PDF doivent afficher en permanence le prix unitaire, le montant avec TVA, l'AIB et le TTC (et non masquer les lignes quand la taxe n'est pas appliquée — un document officiel doit rester lisible et explicite) ; (2) pouvoir associer à un bon de commande fournisseur une ou plusieurs proformas (factures clients) qui sont validées, payées ou soldées.

**Modifications apportées**
- [prisma/schema.prisma](prisma/schema.prisma) : nouveau modèle de jointure `CommandeFournisseurProforma` (many-to-many entre `CommandeFournisseur` et `Invoice`, même pattern que `DemandeBudgetProforma`). Migration `prisma/migrations/20261006080433_add_commande_fournisseur_proforma/`.
- [app/api/fournisseurs/commandes/route.ts](app/api/fournisseurs/commandes/route.ts) : POST accepte désormais `proformaIds` ; vérification serveur que chaque proforma référencée existe et a un statut `Valider`, `Payer` ou `Solde` (sinon 400) avant de créer les liens ; GET et POST incluent `proformas.invoice.client`.
- [app/api/fournisseurs/commandes/[commandeId]/route.ts](app/api/fournisseurs/commandes/[commandeId]/route.ts) : GET inclut désormais `proformas.invoice.client`.
- [components/CommandeFournisseurModal.tsx](components/CommandeFournisseurModal.tsx) et [components/fournisseurs/NewCommandeForm.tsx](components/fournisseurs/NewCommandeForm.tsx) : réutilisation du composant existant `InvoiceMultiCombobox` (déjà utilisé pour les Demandes de Budget) pour associer des proformas, dont la liste proposée est filtrée côté client aux statuts Validée/Payée/Soldée ; le récapitulatif HT/TVA/AIB/TTC n'est plus masqué conditionnellement — il affiche toujours les 4 lignes (avec la mention « non appliquée »/« non appliqué » quand la case correspondante est désactivée).
- [app/(main)/fournisseur/[id]/commandes/[commandeId]/page.tsx](app/(main)/fournisseur/[id]/commandes/[commandeId]/page.tsx) : même passage à un récapitulatif toujours visible (Total HT / Montant avec TVA / AIB / Total TTC) dans la page ET dans le PDF généré ; nouvelle carte « Proforma(s) associée(s) » listant les factures liées (numéro, objet, client, badge de statut via le composant existant `FactureStatusBadge`, lien vers `/facture/[id]`) ; le PDF liste aussi les numéros de proformas associées sous le récapitulatif des totaux.

**Erreurs rencontrées & solutions**
Aucune.

**À tester / points d'attention**
- Vérifier que seules les proformas Validée/Payée/Soldée apparaissent dans le sélecteur, et que l'API refuse bien une tentative d'association à une proforma en Brouillon/Envoyée/Annulée/Archivée (test direct de l'API, le filtrage client ne suffit pas comme garde-fou).
- Vérifier sur un bon de commande existant (créé avant cette mise à jour, donc sans proforma associée) que la nouvelle carte ne s'affiche pas et que rien ne casse.

---

## 2026-10-06 — TVA (18%) + AIB (5%) sur les bons de commande fournisseurs, et correction du calcul de surface (cm → m²)

**Demande / Contexte**
Deux besoins sur les Bons de Commande Fournisseurs : (1) pouvoir spécifier si la TVA (18%) et/ou l'AIB (5%) s'appliquent, avec calcul du TTC ; (2) corriger le calcul de surface des produits au m² — les dimensions sont saisies en centimètres (usage métier imprimerie/bâche), mais le code multipliait directement largeur × hauteur sans convertir, ce qui donnait un total totalement faux (ex: 60 × 120 cm → 7200 au lieu de 0,72 m²).

Règle de calcul validée avec l'utilisateur : la TVA et l'AIB sont chacun activables/désactivables indépendamment par bon de commande (comme l'exonération de TVA existante sur les factures). L'AIB se calcule sur le montant HT (indépendamment de la TVA, pas en cascade) : **TTC = HT + TVA + AIB**.

**Modifications apportées**
- [prisma/schema.prisma](prisma/schema.prisma) : ajout sur `CommandeFournisseur` de `appliquerTva` (Boolean, défaut false), `tva` (montant calculé), `appliquerAib` (Boolean, défaut false), `montantAib` (montant calculé), `totalTTC`. Migration `prisma/migrations/20261005233915_add_tva_aib_commande_fournisseur/` — inclut aussi un backfill (`UPDATE ... SET totalTTC = totalHT`) pour que les bons de commande existants (créés avant cette feature, sans taxe) affichent un TTC cohérent au lieu de 0.
- [app/api/fournisseurs/commandes/route.ts](app/api/fournisseurs/commandes/route.ts) : POST — correction du calcul de surface (`(largeur_cm × hauteur_cm) / 10000` au lieu de `largeur × hauteur` brut) ; calcul et persistance de `tva` (HT × 18% si activé), `montantAib` (HT × 5% si activé) et `totalTTC` (HT + TVA + AIB).
- [components/CommandeFournisseurModal.tsx](components/CommandeFournisseurModal.tsx) et [components/fournisseurs/NewCommandeForm.tsx](components/fournisseurs/NewCommandeForm.tsx) (les deux formulaires de création de BCF, un global et un dans la fiche fournisseur) : même correction du calcul de surface côté aperçu client ; colonne « Dimensions (m) » renommée « Dimensions (cm) » ; deux interrupteurs (`Switch`, même pattern visuel que l'exonération de TVA des factures) « TVA (18%) » et « AIB (5%) » ; récapitulatif détaillé HT / TVA / AIB / Total TTC.
- [app/(main)/fournisseur/[id]/commandes/[commandeId]/page.tsx](app/(main)/fournisseur/[id]/commandes/[commandeId]/page.tsx) : affichage des dimensions en « cm » (au lieu de « m ») ; bloc de total détaillé HT/TVA/AIB/TTC ; PDF du bon de commande mis à jour avec le même récapitulatif (plus uniquement « TOTAL HT », maintenant HT + TVA/AIB conditionnels + TOTAL TTC en évidence).
- [app/(main)/fournisseur/commandes/page.tsx](app/(main)/fournisseur/commandes/page.tsx) et [components/fournisseurs/FournisseurCommandes.tsx](components/fournisseurs/FournisseurCommandes.tsx) : colonne et cartes de synthèse « Total HT » remplacées par « Total TTC » (montant réellement dû).

**Erreurs rencontrées & solutions**
Aucune.

**À tester / points d'attention**
- Créer un bon de commande avec un produit au m² en saisissant des dimensions réalistes en cm (ex: 60 x 120) et vérifier que la surface calculée est bien ≈ 0,72 m² et que le total correspond.
- Tester les 4 combinaisons TVA/AIB (aucune, TVA seule, AIB seule, les deux) et vérifier le TTC affiché dans le formulaire, la page de détail et le PDF généré.
- Les bons de commande créés avant cette mise à jour ont été rétro-complétés avec `totalTTC = totalHT` (pas de TVA/AIB historique) — à vérifier sur un ancien bon de commande que l'affichage reste cohérent.

---

## 2026-10-05 — Type de fournisseur + recherche/filtre sur la liste des fournisseurs

**Demande / Contexte**
Besoin d'un champ « type de fournisseur » (ex. Prestataire, Fournisseur, Prestataire interne, Prestataire externe, Autre) pour pouvoir filtrer les fournisseurs par type. Contrainte explicite : ce champ doit rester modifiable côté client, donc pas d'enum Prisma figé (qui demanderait une migration/redéploiement pour ajouter une valeur) — juste un champ texte optionnel en base. Demande également une recherche rapide et un filtre sur la page liste des fournisseurs.

**Modifications apportées**
- [prisma/schema.prisma](prisma/schema.prisma) : ajout de `typeFournisseur String?` (nullable, texte libre) sur le modèle `Fournisseur`. Migration `prisma/migrations/20261005180535_add_type_fournisseur/`.
- [components/FournisseurModal.tsx](components/FournisseurModal.tsx) : type partagé `Fournisseur` mis à jour avec `typeFournisseur: string | null`.
- [components/FournisseurForm.tsx](components/FournisseurForm.tsx) : nouveau champ « Type de fournisseur » reprenant exactement le même pattern UX que « Domaine d'activité » — `Select` avec suggestions (`Prestataire`, `Fournisseur`, `Prestataire interne`, `Prestataire externe`) + option « Autre » qui révèle un champ texte libre. Garde le champ pleinement éditable sans toucher au code.
- [app/api/fournisseurs/route.ts](app/api/fournisseurs/route.ts) et [app/api/fournisseurs/[id]/route.ts](app/api/fournisseurs/[id]/route.ts) : POST et PUT acceptent et persistent `typeFournisseur` (chaîne vide normalisée en `null`).
- [app/(main)/fournisseur/page.tsx](app/(main)/fournisseur/page.tsx) : ajout d'un champ de recherche rapide (entreprise, nom, prénom, email, contact, domaine d'activité — filtrage client-side), d'un `Select` de filtre par type (options dérivées dynamiquement des types présents dans les données chargées) et d'une colonne « Type » dans le tableau (badge, ou « - » si non renseigné). Compteur « X / Y fournisseur(s) » ajouté dans l'en-tête.

**Erreurs rencontrées & solutions**
- Erreur transitoire de connexion à la base Supabase (TEST) pendant `prisma migrate dev` (« tenant/user ... not found ») → résolu par simple nouvelle tentative, problème déjà connu et auto-résolutif.

**À tester / points d'attention**
- Vérifier en conditions réelles : création/édition d'un fournisseur avec un type suggéré et avec un type personnalisé (« Autre »), puis recherche et filtre par type sur la page liste.
- Le filtre et la recherche sont client-side (tout le jeu de données est chargé en une fois) — à revoir si le nombre de fournisseurs devient très important.

---

## 2026-09-27 (suite) — Mise en avant du motif de rejet (UX)

**Demande / Contexte**
Le motif de rejet d'une demande de budget était affiché tout en bas de la fiche, facile à manquer. Demande de le rendre plus visible : soit en haut, soit dans un dialogue à l'ouverture, avec un accès direct à « Modifier et soumettre à nouveau » depuis là.

**Modifications apportées**
- [app/(main)/budget/demandes/[id]/page.tsx](app/(main)/budget/demandes/[id]/page.tsx) : les deux options ont été combinées.
  - Un dialogue s'ouvre automatiquement à l'arrivée sur une demande `REJETEE` (motif, qui a rejeté et quand, bouton « Fermer » et — pour l'auteur ou le comptable — « Modifier et soumettre à nouveau » directement dedans).
  - L'encart « Demande rejetée » tout en haut de la fiche (juste après l'en-tête) affiche désormais le motif directement, au lieu du texte générique précédent ; visible pour toute personne pouvant consulter la demande (auteur, admin, comptable), le bouton de resoumission restant réservé à l'auteur/comptable.
  - L'ancien encart redondant « Motif du rejet » tout en bas de la page a été supprimé.

**Erreurs rencontrées & solutions**
Aucune.

**À tester / points d'attention**
- Tester dans le navigateur : ouvrir une demande rejetée en tant qu'auteur (le dialogue doit s'ouvrir avec le bouton de resoumission), puis en tant qu'admin qui l'a rejetée (le dialogue doit s'ouvrir sans le bouton, juste le motif).

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
