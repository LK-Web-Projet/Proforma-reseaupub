# Camptrack → Proforma : paiement des prestataires par lots

*Pour le développeur de Camptrack. Ce document décrit ce que Proforma attend désormais pour enregistrer le paiement des prestataires terrain, et comment faire la transition sans rien casser.*

## Pourquoi

Dans Proforma, toute sortie d'argent d'une campagne qui a un budget doit maintenant être imputée à une **ligne de ce budget**. Le plafond de la ligne, le solde de la caisse et la séparation des tâches y sont contrôlés. Les prestataires étant payés **par lots** (un état de paiement MoMo ou un virement groupé par campagne), Camptrack doit envoyer **le résumé du lot** en un seul appel, avec la ligne de budget choisie par le comptable.

## Ce qui ne change pas (transition)

L'appel actuel reste accepté, avec **le même contrat et la même réponse** :

```
POST /api/integration/cash-journal/depenses
Authorization: Bearer <PROFORMA_API_KEY>
{ "cashRegisterId": 2, "montant": 15000, "libelle": "Paiement prestataire …", "proformaId": "<uuid>" }
→ 201 { "cashJournalEntry": {...}, "paiement": {...} }
```

Si la campagne a un budget, Proforma enregistre le paiement comme avant, mais le marque **« à rattacher »**. Le comptable le rattache ensuite à une ligne depuis la fiche du budget. Tout continue de fonctionner, mais ces paiements demandent une action manuelle dans Proforma : il faut passer au nouvel appel dès que possible.

## Nouveaux appels

Les deux appels utilisent la même clé que l'existant : `Authorization: Bearer <PROFORMA_API_KEY>` (côté Proforma : `INTEGRATION_API_KEY`).

### 1. Lignes de budget d'une campagne

```
GET /api/integration/budgets/lignes?proformaId=<id_proforma de la campagne>
```

Réponse `200` :

```json
{
  "proformaId": "…",
  "aBudget": true,
  "budgets": [{ "id": "…", "numero": "DB-2026-0012", "statut": "EN_COURS" }],
  "lignes": [
    {
      "id": "…", "budgetId": "…", "budgetNumero": "DB-2026-0012",
      "designation": "Hôtesses", "categorie": "PERSONNEL", "modePaiement": "MOBILE_MONEY",
      "plafond": 800000, "consomme": 350000, "reste": 450000
    }
  ]
}
```

- `aBudget = false` : la campagne n'a pas de budget, aucune ligne n'est à choisir.
- `aBudget = true` avec `lignes` vide : le budget n'est pas encore validé, ou il est clôturé. **Aucun paiement n'est possible** : afficher le message et ne pas envoyer le lot.

### 2. Enregistrer un lot

```
POST /api/integration/cash-journal/lots-paiement
```

```json
{
  "reference": "LOT-2026-11-16-BIIC-001",
  "referenceOperateur": "MTN-BULK-883421",
  "proformaId": "<id_proforma>",
  "cashRegisterId": 3,
  "ligneBudgetId": "<id de la ligne choisie>",
  "comptableEmail": "comptable@reseaupub.com",
  "modePaiement": "MOBILE_MONEY",
  "datePaiement": "2026-11-16T17:30:00Z",
  "montantTotal": 350000,
  "lignes": [
    { "reference": "LOT-…-001", "beneficiaire": "KOFFI Jean", "numero": "0197000000", "montant": 25000, "libelle": "DSA 5 jours" },
    { "reference": "LOT-…-002", "beneficiaire": "…", "numero": "…", "montant": 25000 }
  ]
}
```

| Champ | Règle |
|---|---|
| `reference` | **Unique et stable par lot.** Elle sert de clé anti-doublon : il faut renvoyer la même en cas de nouvel essai |
| `proformaId` | La proforma de la campagne (`Campagne.id_proforma`) |
| `ligneBudgetId` | **Obligatoire si `aBudget = true`**, absent sinon |
| `comptableEmail` | Email de la personne qui valide le paiement dans Camptrack. Proforma applique la séparation des tâches : cette personne ne doit pas avoir validé le budget |
| `modePaiement` | `MOBILE_MONEY`, `VIREMENT`, `ESPECES`, `CHEQUE`, `CARTE` ou `AUTRE` |
| `montantTotal` | Doit égaler la somme des `lignes[].montant`, à 0,01 près |

**Réponses**

| Code | Signification |
|---|---|
| `201` | Lot enregistré : `{ lot, cashJournalEntryId, budgetDepenseId, paiementId }`. Une sortie de caisse pour le total, une dépense de budget (si budget), une dépense sur la proforma |
| `200` | `{ deja: true, lot }` : cette `reference` a déjà été enregistrée, aucun second paiement. **À traiter comme un succès** |
| `400` | Refus métier, le message est en français et doit être affiché tel quel. Messages possibles : total incohérent ; ligne obligatoire (« Cette campagne a un budget… ») ; plafond atteint (« Budget de la ligne … atteint : il reste … ») ; caisse insuffisante (« Solde insuffisant dans la caisse … ») ; budget non validé ou clôturé ; séparation des tâches |
| `401` | Clé d'intégration absente ou invalide |
| `404` | Proforma introuvable |

## Écran à prévoir dans Camptrack

Au moment d'enregistrer le paiement d'un lot (une campagne, un état de paiement) :

1. **Résumé du lot**, en lecture seule : campagne, proforma, nombre de bénéficiaires, total, moyen de paiement, référence opérateur (MTN ou banque) et date.
2. **Ligne de budget** : liste issue de l'appel n°1, avec le reste de chaque ligne. Elle est **obligatoire si `aBudget`**. Les lignes dont le reste est inférieur au total du lot sont désactivées.
3. **Caisse** : comme aujourd'hui, avec la liste `GET /api/integration/cash-journal/registers`.
4. **Valider** : appel n°2. En cas de `400`, afficher le message et ne rien enregistrer côté Camptrack. En cas de `201` ou `200`, marquer le lot payé et conserver `cashJournalEntryId`.

Recommandations :

- Générer la `reference` **avant** le premier appel et la conserver avec le lot, par exemple `LOT-<date>-<campagne>-<n°>`.
- Après un délai d'attente ou une erreur réseau, **réessayer avec la même `reference`** : Proforma ne paiera pas deux fois.
- Envoyer un lot **par campagne** (par proforma), jamais un lot global.
