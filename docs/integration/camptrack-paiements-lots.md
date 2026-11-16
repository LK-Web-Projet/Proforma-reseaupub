# CampTrack → Finance (Proforma) : paiements groupés et budgets

*Pour le développeur de CampTrack. Ce document fait suite à ton contrat `docs/INTEGRATION_FINANCE_PAIEMENTS_GROUPES.md` (branche `feature/paiements_groupes`).*

## En bref

- **La route est prête côté Finance** : `POST /api/integration/cash-journal/depenses-groupees` accepte **ton JSON tel quel**, avec les mêmes contrôles et les mêmes codes de réponse (201, 400, 404, 409), et la réponse que tu attends (`cashJournalEntry.id`, `lignes`). Ta branche peut donc être testée et fusionnée sans rien changer.
- **Ce qui est nouveau côté Finance** : chaque dépense d'une campagne qui a un **budget** doit être imputée à une **ligne de ce budget**. Le plafond de la ligne, le solde de la caisse et la séparation des tâches sont contrôlés.
- **Ce qu'il te reste à faire** : ajouter **3 champs** au JSON, **1 appel de lecture**, et **1 liste déroulante** dans l'écran de paiement du lot. Le détail est ci-dessous.

## Ce que Finance fait de ton lot

| Situation de la campagne | Ce que Finance enregistre |
|---|---|
| Pas de `proformaId` | Une sortie de caisse pour le total, et le détail des lignes |
| Proforma **sans budget** | La sortie de caisse, imputée à la proforma (marge de la campagne), et le détail |
| Proforma **avec budget**, `ligneBudgetId` fourni | La sortie de caisse, la dépense de budget sur cette ligne (plafond contrôlé), l'imputation à la proforma, et le détail |
| Proforma **avec budget**, sans `ligneBudgetId` (transition) | Enregistré quand même et marqué **« à rattacher »**. Le comptable devra le rattacher à une ligne à la main dans Finance |

Dans tous les cas :

- tout est fait dans une seule transaction, en tout ou rien ;
- le lot est considéré comme justifié, puisque les états signés et l'historique des transferts restent dans CampTrack ;
- le détail des prestataires est visible dans Finance, sur l'écriture du journal de caisse et sur la dépense du budget.

Le modèle `CashJournalLigne` suggéré dans ton document n'a pas été repris tel quel. Finance conserve les lignes du lot dans sa propre table (`LotPaiement`), ce qui ne change rien pour toi.

## Ce que tu as à faire

### 1. Lire les lignes de budget de la campagne (nouvel appel)

Avant d'afficher l'écran de paiement d'un lot :

```
GET {PROFORMA_API_URL}/api/integration/budgets/lignes?proformaId=<id_proforma de la campagne>
Authorization: Bearer {PROFORMA_API_KEY}
```

```json
{
  "proformaId": "clx9…",
  "aBudget": true,
  "budgets": [{ "id": "…", "numero": "DB-2026-0012", "statut": "EN_COURS" }],
  "lignes": [
    {
      "id": "c3f1…",
      "budgetId": "…",
      "budgetNumero": "DB-2026-0012",
      "designation": "Prestataires terrain",
      "categorie": "PERSONNEL",
      "modePaiement": "MOBILE_MONEY",
      "plafond": 800000,
      "consomme": 350000,
      "reste": 450000
    }
  ]
}
```

- `aBudget: false` : la campagne n'a pas de budget. Ne pas afficher la liste et ne rien envoyer de plus (comportement actuel).
- `aBudget: true` avec `lignes` non vide : la liste est **obligatoire**.
- `aBudget: true` avec `lignes` vide : le budget n'est pas encore validé ou il est clôturé. Afficher « Le budget de cette campagne n'est pas ouvert aux dépenses » et **bloquer le paiement**.

Si la campagne n'a pas de proforma, cet appel est inutile.

### 2. Ajouter 3 champs au JSON de `createCashJournalDepenseGroupee`

Tout le reste du JSON est inchangé.

```json
{
  "...": "tous les champs actuels",
  "ligneBudgetId": "c3f1…",
  "comptableEmail": "comptable@reseaupub.com",
  "modePaiement": "MOBILE_MONEY"
}
```

| Champ | Quand | Règle |
|---|---|---|
| `ligneBudgetId` | Si `aBudget: true` | L'`id` de la ligne choisie dans la liste. Le reste de la ligne doit couvrir le `montant` du lot |
| `comptableEmail` | **Obligatoire dès que `ligneBudgetId` est envoyé** | Email de la personne qui valide le paiement dans CampTrack. Finance refuse si c'est la personne qui a validé le budget (séparation des tâches) |
| `modePaiement` | Facultatif | `MOBILE_MONEY` (par défaut), `VIREMENT`, `ESPECES`, `CHEQUE`, `CARTE` ou `AUTRE` |
| `datePaiement` | Facultatif | Date ISO du paiement. Par défaut, le moment de l'appel |

Dans `lib/integrations/proformaClient.ts`, il suffit d'ajouter ces champs, facultatifs, à `DepenseGroupeePayload`, et une fonction `getLignesBudget(proformaId)` pour l'appel n°1.

### 3. Écran de paiement du lot

Au moment de marquer le lot « payé » :

1. Le **résumé du lot**, comme aujourd'hui : campagne, proforma, nombre de prestataires, total, référence opérateur.
2. Une **liste « Ligne de budget »**, affichée seulement si `aBudget: true` et alors obligatoire. Chaque option montre `budgetNumero — designation — reste : X F`. Les lignes dont le `reste` est inférieur au total du lot sont **désactivées**.
3. La **caisse**, comme aujourd'hui.
4. **Valider** envoie le JSON avec les 3 champs.

### 4. Messages d'erreur à afficher tels quels

Les messages sont déjà renvoyés dans `{ "error": "…" }`, avec ton format habituel. Les nouveaux cas, tous en `400` :

| Message (début) | Cause |
|---|---|
| « Budget de la ligne … atteint : il reste … » | Le lot dépasse le reste de la ligne |
| « Le budget DB-… n'est pas ouvert aux dépenses… » | Le budget n'est pas validé, ou il est clôturé |
| « Vous avez validé ce budget… » / « Vous avez accordé cette ligne… » | `comptableEmail` est celui de la personne qui a validé |
| « comptableEmail est requis avec ligneBudgetId… » | Le champ est manquant |
| « Cette proforma n'est pas liée à ce budget. » | La ligne choisie appartient au budget d'une autre campagne |

Les cas déjà prévus dans ton document ne changent pas : total incohérent et solde insuffisant (`400`), caisse introuvable (`404`), lot déjà enregistré (`409`).

## Réponse (inchangée, avec deux champs en plus)

```json
{
  "cashJournalEntry": { "id": 1542, "montant": 22500.5, "solde": 180000 },
  "lignes": [{ "numero": 1, "id": "LOT-20261103-K7QM-001" }, { "numero": 2, "id": "LOT-20261103-K7QM-002" }],
  "budgetDepenseId": "…",
  "aRattacher": false
}
```

- `lignes[].id` est la **référence de la ligne** que tu as envoyée (une chaîne).
- `budgetDepenseId` vaut `null` sans budget, ou pendant la transition.
- `aRattacher: true` signifie que le lot a été reçu sans ligne de budget sur une campagne qui en a un : Finance attend un rattachement manuel. Tu peux l'afficher comme un avertissement.

## L'appel unitaire existant

`POST /api/integration/cash-journal/depenses`, pour un paiement à une seule personne, reste accepté **sans aucun changement**. Sur une campagne avec budget, le paiement est marqué « à rattacher » côté Finance. À terme, privilégier le lot, même pour une seule personne.

## Tester

Comme indiqué dans ton document : **jamais contre la caisse de production**. Lance Finance en local (`pnpm dev -p 3001`), mets `PROFORMA_API_URL=http://localhost:3001` dans le `.env` de CampTrack, puis vérifie :

1. Ton JSON actuel, sans les 3 champs, sur une campagne avec budget : `201` avec `aRattacher: true`.
2. Le même lot renvoyé : `409`.
3. Avec `ligneBudgetId` et `comptableEmail` : `201`, et la dépense apparaît sur la fiche du budget dans Finance.
4. Un lot plus gros que le reste de la ligne : `400`, avec le message affiché.
5. Une campagne sans budget : `201`, sans liste affichée.
