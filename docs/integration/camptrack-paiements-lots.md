# CampTrack → Finance (Proforma) : paiements des prestataires

*Pour le développeur de CampTrack. Ce document décrit ce que Finance attend, tel que c'est déjà codé dans CampTrack (branche `feature/paiements_groupes`, commit `1cdabe4`) : `lib/integrations/proformaClient.ts` et `docs/INTEGRATION_FINANCE_PAIEMENTS_GROUPES.md`.*

## En bref

- **Rien à changer côté CampTrack** : Finance accepte exactement ce que la branche envoie.
  - Lecture des lignes de budget : `GET /api/integration/budgets/lignes`.
  - Paiement d'un lot : `POST /api/integration/cash-journal/lots-paiement`.
  - Paiement individuel : `POST /api/integration/cash-journal/depenses`, inchangé.
- Le contrôle a été fait avec le JSON exact de `construireLotProforma` (24 contrôles, tous OK).

## 1. Lignes de budget de la campagne

```
GET {PROFORMA_API_URL}/api/integration/budgets/lignes?proformaId=<Campagne.id_proforma>
Authorization: Bearer {PROFORMA_API_KEY}
```

Réponse : `{ proformaId, aBudget, budgets[{ id, numero, statut }], lignes[{ id, budgetId, budgetNumero, designation, categorie, modePaiement, plafond, consomme, reste }] }`.

| Réponse | Écran CampTrack |
|---|---|
| `aBudget: false` | Pas de liste, `ligneBudgetId` n'est pas envoyé |
| `aBudget: true`, `lignes` non vide | Liste **obligatoire**. Les lignes dont le `reste` est inférieur au total du lot sont désactivées |
| `aBudget: true`, `lignes` vide | Budget pas encore validé, **budget signé pas encore joint**, ou budget clôturé : le paiement est bloqué |

## 2. Paiement d'un lot

```
POST {PROFORMA_API_URL}/api/integration/cash-journal/lots-paiement
Authorization: Bearer {PROFORMA_API_KEY}
```

```json
{
  "reference": "LOT-20261116-K7QM",
  "referenceOperateur": "MTN-BULK-883421",
  "proformaId": "<id_proforma>",
  "cashRegisterId": 3,
  "ligneBudgetId": "<si aBudget>",
  "comptableEmail": "<email de l'utilisateur qui valide>",
  "modePaiement": "MOBILE_MONEY",
  "datePaiement": "2026-11-16T17:30:00.000Z",
  "montantTotal": 22500.5,
  "lignes": [
    { "reference": "LOT-20261116-K7QM-001", "beneficiaire": "KOFFI Jean", "numero": "0197123456", "montant": 15000, "libelle": "Installation — campagne Orange Novembre" },
    { "reference": "LOT-20261116-K7QM-002", "beneficiaire": "ADJO Ama", "numero": "0166554433", "montant": 7500.5, "libelle": "Autre — campagne Orange Novembre" }
  ]
}
```

| Champ | Règle côté Finance |
|---|---|
| `reference` | Unique et stable : c'est la clé anti-doublon |
| `proformaId` | Facultatif pour Finance (sans proforma, simple sortie de caisse) ; CampTrack l'envoie toujours |
| `ligneBudgetId` | Si la campagne a un budget. Le reste de la ligne doit couvrir `montantTotal` |
| `comptableEmail` | **Obligatoire**. Refusé si c'est la personne qui a validé le budget ou accordé la ligne (séparation des tâches) |
| `modePaiement` | `MOBILE_MONEY` par défaut. Valeurs : `VIREMENT`, `ESPECES`, `CHEQUE`, `CARTE`, `AUTRE` |
| `montantTotal` | Doit être égal à la somme de `lignes[].montant` |
| `lignes[].numero` | Numéro Mobile Money du bénéficiaire (affiché dans Finance) |

### Ce que Finance enregistre

| Campagne | Résultat |
|---|---|
| Avec budget, `ligneBudgetId` fourni | Sortie de caisse, dépense de budget sur la ligne (plafond contrôlé), dépense sur la proforma, détail du lot |
| Avec budget, sans `ligneBudgetId` | Enregistré et marqué **« à rattacher »**. Le comptable le rattache dans Finance |
| Sans budget | Sortie de caisse et dépense sur la proforma (marge de la campagne) |

Tout est fait en une seule transaction, en tout ou rien. Le lot est considéré comme justifié, puisque les états signés restent dans CampTrack.

### Réponses

| Code | Corps | Traitement CampTrack (déjà codé) |
|---|---|---|
| `201` | `{ lot: { id, reference, cashJournalEntryId, budgetDepenseId, paiementId }, cashJournalEntryId, budgetDepenseId, paiementId, aRattacher }` | Lot marqué payé |
| `200` | `{ deja: true, lot, cashJournalEntryId, budgetDepenseId, paiementId }` | Même `reference` déjà reçue : même traitement, **aucun second paiement** |
| `400` | `{ error }` | Message affiché tel quel |
| `404` | `{ error }` | Caisse ou proforma introuvable |
| `401` | — | Clé invalide (CampTrack la convertit en 502) |

Messages `400` possibles :

- total différent de la somme des lignes ;
- « Budget de la ligne … atteint » ;
- « Vous avez validé ce budget… » ;
- « Le budget DB-… n'est pas ouvert aux dépenses » ;
- « Budget DB-… : Le budget signé n'est pas encore joint… » ;
- « Solde insuffisant dans la caisse … ».

## 3. Paiement individuel (inchangé)

`POST /api/integration/cash-journal/depenses` avec `{ cashRegisterId, montant, libelle, proformaId? }` → `201 { cashJournalEntry, paiement }`. Sur une campagne avec budget, le paiement est enregistré et marqué « à rattacher », car aucune ligne n'est envoyée. **Conseil** : sur une campagne avec budget, passer par un lot d'une personne pour imputer directement la ligne.

## 4. Ancienne route

`POST /api/integration/cash-journal/depenses-groupees` (ancien format : `montant`, `libelle`, `campagne`, `lignes[].numeroMomo`, 409 sur doublon) reste acceptée. Les deux routes partagent la même table des lots : un lot reçu par l'une est reconnu par l'autre. **CampTrack utilise désormais `lots-paiement`.**

## 5. Tester

Ne jamais tester contre la caisse de production. Lancer Finance en local (`pnpm dev -p 3001`) et mettre `PROFORMA_API_URL=http://localhost:3001` dans le `.env` de CampTrack. Puis vérifier :

1. un lot sur une campagne avec budget validé et une ligne choisie : `201`, la dépense apparaît sur la fiche du budget ;
2. le même lot validé une seconde fois : `200`, aucun second paiement ;
3. un lot plus gros que le reste de la ligne : `400`, message affiché ;
4. une campagne sans budget : `201`, sans liste ;
5. une campagne dont le budget n'a pas encore son budget signé : liste vide, paiement bloqué.
