# Guide des dépenses sur Proforma

*Comment la procédure de paiement RESEAUPUB s'applique dans la plateforme. Ce guide s'adresse à la DG, au comptable, à la caisse, aux chefs de projet et aux demandeurs.*

---

## Le principe en une phrase

**Tout argent qui sort passe par une seule opération.** Qu'elle soit saisie depuis le budget, depuis la proforma ou depuis Camptrack, elle met à jour en une fois :

- le journal de caisse ;
- la ligne de budget ;
- la proforma, donc la marge de la campagne ;
- le bon de commande et la facture du prestataire.

Rien n'est à ressaisir ailleurs.

```
Budget (lignes accordées)
   └── Bon de commande (rattaché à une ligne, signé par la DG)
         └── Facture du prestataire (rattachée au bon)
               └── Dépense : avance ou solde
                     ├── sort de la caisse choisie (solde contrôlé)
                     ├── est imputée à la proforma de la campagne
                     ├── consomme la ligne de budget (plafond contrôlé)
                     └── met à jour le bon (payé / reste) et la facture (« payée »)
```

---

## 1. Qui fait quoi

Les droits sont réglés dans **Paramètres → Rôles**. Aucun nom n'est inscrit dans le code : il suffit de cocher les cases du rôle.

| Acteur | Droit à cocher sur son rôle | Ce qu'il fait dans Proforma |
|---|---|---|
| Directrice générale | Valider les budgets mensuels et au-dessus du plafond | Valide les budgets, signe les bons de commande, approuve les dépassements, annule une dépense |
| Assistant(e) de direction | Valider les budgets (hors mensuels) | Valide les budgets ponctuels, de campagne et pour tiers jusqu'au plafond délégué |
| Comptable | Enregistrer les dépenses de budget | Enregistre les dépenses (avances, soldes, dépenses courantes), joint les justificatifs, rattache les paiements Camptrack |
| Caisse | Saisir au journal de caisse (hors budget) | Saisie directe au journal : dépenses des campagnes sans budget, apports, transferts |
| Chef de projet / demandeur | Aucun droit particulier | Prépare le budget, corrige les lignes renvoyées, joint le budget signé |

**Séparation des tâches** : la personne qui a validé un budget, ou accordé une ligne, ne peut pas en enregistrer les dépenses. Personne ne valide sa propre demande.

---

## 2. Le budget de campagne

1. **Le chef de projet crée le budget** (*Budget → Faire une demande*), type « Campagne », en le liant à la proforma du client. Pour chaque ligne, il indique la désignation, la catégorie, le **moyen de paiement prévu** (espèces, Mobile Money, chèque, virement, carte) et le montant. Le total par moyen de paiement s'affiche.
2. La **DG (ou le valideur) décide d'abord sur la plateforme**, ligne par ligne : **Accorder**, **Ajuster** (un montant plus bas, avec un motif) ou **Demander une correction**. Le bouton *Tout valider* accorde d'un coup toutes les lignes en attente. Le demandeur corrige ou retire les lignes renvoyées.
3. Dès qu'une ligne est accordée, **le demandeur reçoit une notification** « Budget signé à joindre ». Sur la fiche du budget, la section **Budget signé à joindre** s'affiche **en rouge**.
4. Le demandeur **imprime** le budget (bouton *Imprimer*), le fait **signer par la DG**, puis **joint le scan signé** (*Joindre le budget signé*).
5. Le statut du budget :

   | Situation | Statut | Dépenses |
   |---|---|---|
   | Toutes les lignes décidées **et** scan signé joint | **Validé** | Possibles sur les lignes accordées |
   | Scan signé joint, mais des lignes encore en attente ou à corriger | Validation partielle | Possibles sur les lignes déjà accordées |
   | Scan signé manquant | Validation partielle | **Aucune** dépense possible |

6. Si une ligne ne suffit plus, le comptable ou le demandeur fait une **demande de dépassement**, que la DG approuve. Sans cette approbation, aucune dépense ne peut dépasser le plafond.

**Quels budgets doivent être signés ?** Par défaut, les budgets de **campagne** et les budgets **mensuels**. L'administrateur peut en ajouter ou en retirer dans **Paramètres → Rôles**, carte « Budget signé exigé ». Pour les types non cochés, le budget passe « Validé » dès que toutes les lignes sont décidées. Un budget déjà validé n'est jamais bloqué après coup.

---

## 3. Le bon de commande

1. Le bon est créé dans **Prestataires → Bons de commande**. Sur sa fiche, on le **rattache à la ligne de budget** qui le finance (*Rattacher à une ligne de budget*).
2. On l'imprime, la **DG le signe**, puis on **joint le BC signé**. Seule la DG peut ensuite le passer à « Validée », et seulement une fois le scan joint.
3. La fiche du bon affiche :
   - la **liasse** : BC signé, bordereau de livraison ou attestation de service fait, facture, rapport ;
   - le **payé et le reste par ligne de produit** ;
   - les avances et le solde.
4. Quand le prestataire envoie sa **facture**, on l'enregistre sur la fiche du bon (*Enregistrer la facture*). Pour un **Fournisseur**, la facture est toujours rattachée à un bon de commande.

**Statuts du bon** : Brouillon → Validée (signé par la DG) → Livrée → **Payée**. Le statut Payée est **automatique** : il est posé quand le reste du bon tombe à zéro. Une annulation rétablit le statut précédent.

---

## 4. Payer un prestataire : avance, puis solde

Le paiement se saisit depuis la **fiche budget**, bouton *Dépense* sur la ligne, ou depuis la **fiche proforma**, bouton *Dépense* puis choix de la ligne. Dans la fenêtre :

- **Paiement** : « Dépense simple », « Avance — BC… » ou « Solde — BC… ».
- **Ligne de produit du bon** : une ligne précise, ou « tout le bon ». Dans ce cas, le montant est réparti au prorata de ce qui reste sur chaque ligne.
- **Caisse** : la caisse d'où sort l'argent. Son solde est contrôlé, et la dépense est refusée s'il ne la couvre pas.
- **Justificatif** : un fichier, ou bien la case « Dépense sans justificatif » avec un motif.

| Étape | Condition | Ce qui se passe automatiquement |
|---|---|---|
| **Avance** | Bon validé et signé | Sortie de caisse, imputation à la proforma et à la ligne de budget. L'avance reste **en rouge « non justifiée »** tant que la liasse n'est pas complète |
| **Livraison** | — | Joindre le bordereau ou l'attestation de service fait, puis le rapport |
| **Solde** | Liasse complète, facture du bon choisie | Sortie de caisse, facture **« payée »**, et bon **« Payé »** si plus rien ne reste |

**Annuler une dépense** est réservé à la DG. L'annulation passe une contre-écriture dans la caisse et la proforma. La facture redevient à payer et le bon retrouve son statut précédent. Une dépense n'est jamais supprimée.

### Prestataires internes et externes : la facture sur une ligne de budget

Le **type** du prestataire (fiche prestataire) décide du circuit de sa facture :

| Type | Bon de commande | Comment la facture est payée |
|---|---|---|
| **Fournisseur** | **Obligatoire** | Par le solde du bon de commande (point 4 ci-dessus) |
| **Prestataire interne** (ex. employés) | Facultatif | Par une dépense sur une **ligne de budget**, par exemple le budget mensuel de la comptabilité pour la paie |
| **Prestataire externe** | Facultatif | Par le solde d'un bon de commande, ou par une dépense sur une ligne de budget |

- À l'enregistrement de la facture (*Prestataires → Liste Factures*), on peut la rattacher à une **ligne de budget**, ou laisser ce choix pour le moment du paiement.
- Pour payer, on ouvre la fiche budget, on clique sur *Dépense* sur la ligne, puis dans **Paiement** on choisit **« Facture … — prestataire »**. Le montant proposé est ce qui reste à régler.
- Le paiement peut être **partiel**, sous forme d'acomptes. La facture passe **« payée »** une fois entièrement réglée. Une dépense annulée la remet « à payer ».

---

## 5. Dépenser depuis la proforma

Sur la fiche proforma, le bouton **Dépense** s'adapte à la campagne :

- **La campagne a un budget** : on choisit la **ligne de budget** (avec son reste), puis la même fenêtre qu'au point 4 s'ouvre. C'est la même opération, et elle apparaît des deux côtés. Il faut le droit *Enregistrer les dépenses de budget*.
- **La campagne n'a pas de budget** : la dépense sort directement de la caisse et est imputée à la proforma. On peut choisir un bon de commande lié à la proforma, et sa ligne de produit. Il faut le droit *Saisir au journal de caisse*.

Si le budget existe mais n'est pas encore validé, ou s'il est clôturé, la dépense est refusée. Cela évite de contourner la validation.

---

## 6. Paiement des prestataires terrain (Camptrack)

Les prestataires sont payés **par lots**, un lot par campagne : un état de paiement MoMo ou un virement groupé. Camptrack envoie à Proforma le **résumé du lot** : référence, nombre de bénéficiaires, total et détail.

- **La campagne a un budget** : le comptable choisit dans Camptrack la **ligne de budget** du lot. Le plafond et la caisse sont contrôlés. Le lot devient une dépense de budget, et son détail s'ouvre depuis la fiche budget (*Lot … — N bénéficiaire(s)*).
- **La campagne n'a pas de budget** : le lot devient une dépense sur la proforma.
- Un lot envoyé deux fois, par exemple après une coupure réseau, **n'est jamais payé deux fois**.
- Les paiements Camptrack sont **justifiés dans Camptrack**, qui conserve les états signés et l'historique MTN. Ils n'apparaissent pas dans les justificatifs manquants.

- Le détail de chaque lot (prestataire, numéro MoMo, type, montant) se consulte aussi depuis l'écriture du **journal de caisse**.

**Période de transition** : tant que Camptrack n'envoie pas la ligne de budget, ses paiements, un par un ou par lot, arrivent comme avant. Sur une campagne avec budget, ils sont marqués **« à rattacher »** : un bandeau orange s'affiche sur la fiche budget, et ils figurent dans l'état du soir. Le comptable clique sur *Rattacher* et choisit la ligne. La caisse n'est pas touchée une seconde fois.

---

## 7. Dépenses courantes et caisse

- La saisie directe au journal de caisse (dépense, recette, transfert, création de caisse) demande le droit **Saisir au journal de caisse**. Les autres rôles consultent le journal sans pouvoir y écrire.
- **Aucune sortie ne dépasse le solde** de la caisse : saisie manuelle, transfert, budget, proforma et Camptrack sont tous contrôlés.

---

## 8. Justificatifs

- Chaque dépense affiche une colonne **« Justificatif reçu : Oui / Non »**.
- Le justificatif est attendu sous **24 h ouvrées** (du lundi au vendredi). Passé ce délai, la dépense passe **en rouge**.
- On ajoute un justificatif après coup avec le bouton *Ajouter le justificatif* sur la dépense.
- Les pièces sont nommées automatiquement `date_campagne_document_montant`, par exemple `2026-11-12_BIIC-DB-2026-0012_Preuve-paiement_350000F.pdf`. Il faut être connecté pour les ouvrir.

---

## 9. Ce que la DG reçoit, et les outils

- **État du soir** (à 19 h, du lundi au vendredi), il contient :
  - pour chaque campagne : le prévu, le payé **par moyen de paiement**, le payé du jour et le reste ;
  - les justificatifs manquants, ceux en retard d'abord ;
  - les avances non justifiées ;
  - les paiements Camptrack à rattacher.
- **Notifications** : la cloche en haut de la barre latérale. Dans **Paramètres → Notifications**, l'admin choisit pour chaque événement : email, application ou les deux.
- **Recherche** : un numéro, un client, un prestataire, un nom de fichier ou un montant permet de retrouver budgets, pièces, bons de commande, factures, écritures de caisse et proformas. Chacun ne voit que ce que ses droits permettent.
- **Rapports** : *Dashboard → Rapports → Suivi budgétaire*, par service, catégorie et moyen de paiement, avec export Excel.

---

## 10. Messages courants

| Message | Ce qu'il faut faire |
|---|---|
| « Cette campagne a un budget : la dépense doit être enregistrée sur une de ses lignes » | Passer par la ligne de budget (fiche budget, ou *Dépense* sur la proforma puis choix de la ligne) |
| « Budget de la ligne … atteint » | Demander un dépassement, que la DG approuve |
| « Solde insuffisant dans la caisse … » | Choisir une autre caisse, ou approvisionner celle-ci |
| « Ce prestataire est un fournisseur : choisissez le bon de commande… » | Les factures d'un Fournisseur passent par un bon de commande. Vérifier le type du prestataire, ou créer le bon |
| « Joignez d'abord le scan du bon de commande signé » | Faire signer le BC par la DG et joindre le scan sur la fiche du bon |
| « Solde impossible : la liasse … est incomplète » | Joindre les pièces manquantes indiquées : bordereau ou attestation, facture, rapport |
| « Vous avez validé ce budget … séparation des tâches » | Une autre personne enregistre la dépense |
| « Le budget … n'est pas ouvert aux dépenses » | Faire valider le budget, ou en créer un nouveau s'il est clôturé |
| « Le budget signé n'est pas encore joint » | Le demandeur imprime le budget, le fait signer par la DG et joint le scan sur la fiche du budget |
