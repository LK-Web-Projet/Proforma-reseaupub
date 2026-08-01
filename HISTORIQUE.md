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
