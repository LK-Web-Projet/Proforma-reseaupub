# API d'intégration (serveur-à-serveur)

Ce document liste toutes les routes publiques `/api/integration/*` exposées par cette app (Finance/Proforma) pour être consommées par une autre app interne (ex: l'app Campagnes/camptrack). Ce ne sont **pas** des routes destinées à un navigateur : elles ne passent pas par l'authentification Clerk, elles sont protégées par une clé API partagée.

À chaque ajout d'une nouvelle route `/api/integration/*`, ajouter une nouvelle section à ce document (même format : titre, date, description, requête, réponse, erreurs, exemple `curl`).

---

## Authentification

Toutes les routes ci-dessous exigent le header :

```
Authorization: Bearer <INTEGRATION_API_KEY>
```

- La valeur de `INTEGRATION_API_KEY` est définie dans le `.env` de **cette** app et doit être copiée **à l'identique** dans le `.env` de l'app appelante.
- Sans le header, ou avec une mauvaise clé → `401 Unauthorized`, corps `{ "error": "Non autorisé." }`.
- Si `INTEGRATION_API_KEY` n'est pas configurée côté serveur (variable absente) → `500`, corps `{ "error": "Intégration non configurée." }` (à surveiller côté déploiement, pas une erreur de l'app appelante).
- Ces routes sont exemptées de l'authentification Clerk au niveau de `middleware.ts` (`/api/integration(.*)` est dans `isPublicRoute`) — la sécurité repose entièrement sur cette clé, donc ne jamais l'exposer côté navigateur/frontend public.

**Base URL** : l'URL de déploiement de cette app (ex: `https://proforma.reseaupub.com` en production, `http://localhost:3000` en local), suivie du chemin de la route.

---

## 1. `GET /api/integration/proformas` — 19 juillet 2026

Liste les proformas. Par défaut, ne renvoie que celles au statut `Valider` (utile pour l'app Campagnes qui associe des campagnes à des proformas déjà validées).

**Query params**
| Param | Requis | Description |
|---|---|---|
| `statut` | non | Un des statuts `StatusFacture` (`Brouillon`, `Envoyer`, `Valider`, `Payer`, `Solde`, `Annuler`, `Archiver`). Défaut : `Valider`. Une valeur invalide retombe silencieusement sur `Valider`. |

**Réponse `200`** — tableau d'objets :
```json
[
  {
    "id": "uuid",
    "numero": "RP-PRO-26/08-0001",
    "objet": "Campagne d'affichage...",
    "statut": "Valider",
    "dateCreation": "2026-08-01T10:00:00.000Z",
    "devise": "XOF",
    "totalHT": 5000000,
    "tva": 900000,
    "totalTTC": 5900000,
    "resteAPayer": 5900000,
    "client": { "id": "uuid", "nom": "...", "email": "...", "telephone": "...", "adresse": "..." },
    "gestionnaires": [{ "id": "uuid", "nom": "...", "prenom": "...", "email": "..." }],
    "produits": [{ "designation": "...", "quantite": 2, "prixUnitaire": 1000000, "duree": 30, "uniteDuree": "jour", "montantTotal": 2000000, "includeduree": true }]
  }
]
```

**Erreurs** : `401` (clé invalide), `500` (erreur serveur).

```bash
curl -H "Authorization: Bearer $INTEGRATION_API_KEY" \
  "https://proforma.reseaupub.com/api/integration/proformas?statut=Valider"
```

---

## 2. `GET /api/integration/proformas/:id` — 19 juillet 2026

Détail d'une proforma précise (même structure que ci-dessus, un seul objet au lieu d'un tableau).

**Réponse** : `200` avec l'objet proforma, ou `404` `{ "error": "Proforma non trouvée" }` si l'id n'existe pas.

```bash
curl -H "Authorization: Bearer $INTEGRATION_API_KEY" \
  "https://proforma.reseaupub.com/api/integration/proformas/<id>"
```

---

## 3. `GET /api/integration/clients` — 19 juillet 2026

Recherche des clients existants dans cette app (pour éviter que l'app Campagnes crée des doublons).

**Query params**
| Param | Requis | Description |
|---|---|---|
| `search` | non | Filtre sur `nom` ou `email` (insensible à la casse). Sans ce param, renvoie les 50 premiers clients par ordre alphabétique. |

**Réponse `200`** — tableau de clients (`id`, `nom`, `email`, `telephone`, `adresse`, max 50 résultats).

```bash
curl -H "Authorization: Bearer $INTEGRATION_API_KEY" \
  "https://proforma.reseaupub.com/api/integration/clients?search=dupont"
```

---

## 4. `POST /api/integration/clients/find-or-create` — 19 juillet 2026

Récupère un client existant (matché sur le champ `nom`, unique en base) ou le crée s'il n'existe pas encore. **Toujours stocker l'`id` retourné** côté app appelante — c'est la référence canonique du client, pas de duplication de données.

**Corps JSON**
```json
{
  "nom": "Société XYZ",        // requis
  "email": "contact@xyz.com",  // optionnel
  "telephone": "+229 ...",     // optionnel
  "adresse": "..."             // optionnel
}
```

**Réponse `200`** : l'objet client (créé ou existant, mis à jour avec les champs fournis).
**Erreurs** : `400` si `nom` manquant ou email invalide (corps `{ "error": <détail zod> }`).

```bash
curl -X POST -H "Authorization: Bearer $INTEGRATION_API_KEY" -H "Content-Type: application/json" \
  -d '{"nom":"Société XYZ","email":"contact@xyz.com"}' \
  "https://proforma.reseaupub.com/api/integration/clients/find-or-create"
```

---

## 5. `GET /api/integration/cash-journal/registers` — 4 août 2026

Liste les caisses **visibles** (`view: true`) du journal de caisse, pour peupler un sélecteur côté app appelante avant d'enregistrer une dépense.

**Réponse `200`** :
```json
[
  { "id": 1, "name": "Caisse principale" },
  { "id": 2, "name": "Caisse événementiel" }
]
```

```bash
curl -H "Authorization: Bearer $INTEGRATION_API_KEY" \
  "https://proforma.reseaupub.com/api/integration/cash-journal/registers"
```

---

vf## 6. `POST /api/integration/cash-journal/depenses` — 4 août 2026 (champ `proformaId` ajouté le 18 août 2026)

Enregistre une **dépense** dans la caisse choisie par l'utilisateur côté app appelante. Le type d'opération est fixé à `DEPENSE` côté serveur — impossible de créer une `RECETTE` ou un `TRANSFERT` via cet endpoint.

Cet endpoint est **intelligent** : il n'y a rien à choisir côté app appelante entre "dépense simple" et "dépense liée à une proforma" — envoyez `proformaId` si vous l'avez (ex: `Campagne.id_proforma`), omettez-le sinon. Le comportement s'adapte automatiquement côté serveur (voir "Corps JSON" et "Réponse" ci-dessous).

**Corps JSON**
```json
{
  "cashRegisterId": 1,                           // requis, id numérique (voir endpoint #5)
  "montant": 25000,                              // requis, nombre positif (pas une chaîne)
  "libelle": "Achat fournitures campagne X",     // requis
  "date_operation": "2026-08-04T09:30:00.000Z",  // optionnel, ISO 8601 — défaut: maintenant
  "proformaId": "uuid-de-la-proforma"            // optionnel — voir ci-dessous
}
```

**Comportement selon `proformaId`**
- **Absent** → dépense de caisse simple : une entrée `CashJournal` (type `DEPENSE`), `CashRegister.balance` mis à jour.
- **Fourni et correspond à une proforma existante** → la dépense est enregistrée comme un `Paiement` (type `DEPENSE`) **rattaché à cette facture**, avec **une seule** écriture `CashJournal` liée (`Paiement.cashJournalEntryId`) — pas de double comptage sur la caisse. Le libellé enregistré est enrichi automatiquement avec le numéro de la proforma, le nom du client et l'objet, et ce **même libellé enrichi est utilisé à la fois pour `CashJournal.libelle` et `Paiement.reference`** — le texte affiché est donc identique entre le journal de caisse et l'historique des paiements de la facture. La dépense apparaît alors dans l'historique des paiements de la facture, côté app Finance/Proforma. **Attention** : si le solde de la caisse est insuffisant pour couvrir le montant, la requête est bloquée (`400`) — contrairement au cas "caisse simple" ci-dessus qui n'a pas cette vérification.
- **Fourni mais ne correspond à aucune facture** (donnée obsolète côté campagnes) → repli silencieux sur le comportement "dépense de caisse simple", sans erreur renvoyée.

**Réponse `201`**
- Sans lien facture : `{ "cashJournalEntry": { "id": ..., "montant": ..., "solde": ..., "date_operation": ..., "cashRegisterId": ..., ... } }`.
- Avec lien facture : `{ "paiement": { "id": ..., "invoiceId": ..., "montant": ..., "type": "DEPENSE", ... }, "cashJournalEntry": { ... } }`.

**Erreurs**
- `400` — corps invalide (`cashRegisterId` non numérique, `montant` négatif/nul, `libelle` vide, `date_operation` mal formatée), ou solde de caisse insuffisant quand `proformaId` est fourni et valide (message explicite avec le nom de la caisse et le solde actuel).
- `404` — `{ "error": "Caisse introuvable ou indisponible." }` si `cashRegisterId` n'existe pas ou correspond à une caisse masquée (`view: false`).
- `401` — clé API absente/invalide.
- `500` — erreur serveur inattendue.

```bash
# Dépense simple (pas de lien facture)
curl -X POST -H "Authorization: Bearer $INTEGRATION_API_KEY" -H "Content-Type: application/json" \
  -d '{"cashRegisterId":1,"montant":25000,"libelle":"Achat fournitures campagne X"}' \
  "https://proforma.reseaupub.com/api/integration/cash-journal/depenses"

# Dépense liée à une proforma (campagne avec id_proforma renseigné)
curl -X POST -H "Authorization: Bearer $INTEGRATION_API_KEY" -H "Content-Type: application/json" \
  -d '{"cashRegisterId":1,"montant":25000,"libelle":"Achat fournitures campagne X","proformaId":"<id de la proforma>"}' \
  "https://proforma.reseaupub.com/api/integration/cash-journal/depenses"
```

### Checklist côté app appelante (campagnes) pour que ça marche du premier coup

1. Définir dans le `.env` de l'app campagnes : la même `INTEGRATION_API_KEY` que celle de cette app, et l'URL de base de cette app (ex: `PROFORMA_API_URL=https://proforma.reseaupub.com`).
2. Au chargement du formulaire de dépense : appeler `GET /api/integration/cash-journal/registers` pour peupler le sélecteur de caisse (ne pas coder les caisses en dur — si une caisse est renommée/masquée ici, la liste doit rester à jour côté campagnes).
3. À la soumission : `POST /api/integration/cash-journal/depenses` avec le header `Authorization: Bearer <clé>`, le header `Content-Type: application/json`, et le corps JSON ci-dessus — `montant` doit être un **nombre** JSON (`25000`, pas `"25000"`), sinon `400`.
4. Si la campagne concernée a un `id_proforma` renseigné, l'envoyer tel quel dans `proformaId` — pas besoin de vérifier côté campagnes que la proforma existe encore, le serveur gère le repli automatiquement.
5. Gérer les codes retour : `201` = succès (la réponse contient `cashJournalEntry`, et `paiement` en plus si `proformaId` a matché une facture) ; `400` = souci de saisie **ou** solde de caisse insuffisant (afficher le message d'erreur à l'utilisateur) ; `404` = caisse invalide ; `401` = problème de configuration de la clé côté campagnes (à corriger côté déploiement, pas un souci utilisateur) ; `500` = réessayer / alerter.
