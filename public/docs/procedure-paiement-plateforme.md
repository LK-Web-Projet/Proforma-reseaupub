# Guide des dépenses sur Proforma

*Comment la procédure de paiement RESEAUPUB s'applique dans la plateforme. Ce guide s'adresse à la DG, au comptable, à l'accueil, à la caisse, aux chefs de projet et aux demandeurs.*

---

## Le principe en une phrase

**Tout argent qui sort passe par le budget, en une seule opération.** D'où qu'elle soit saisie (proforma, fiche budget, facture, bon de commande ou Camptrack), elle met à jour en une fois :

- le journal de caisse ;
- la ligne de budget ;
- la proforma, donc la marge de la campagne ;
- le bon de commande et la facture du prestataire.

Rien n'est à ressaisir ailleurs, et rien n'est compté deux fois : la caisse ne voit qu'**une écriture** par sortie, que la proforma et le budget affichent chacun de leur côté.

```flux
titre: Le parcours d'une dépense de campagne
Commercial | **Proforma client** validée | bleu
Chef de projet | **Budget** de la campagne, lié à la proforma | violet
DG | Accorde les lignes et **signe le budget** | rose
Chef de projet | **Bon de commande** sur une ligne accordée | orange
Fournisseur | Livre, puis envoie sa **facture** | cyan
Comptable | **Appliquer le paiement** | vert
```

```choix
titre: Une sortie d'argent = une seule opération, qui met tout à jour
question: « Appliquer le paiement », « Dépense » ou lot Camptrack
Caisse | **Une écriture** dans le journal, solde contrôlé | vert
Budget | La **ligne est consommée**, plafond contrôlé | violet
Proforma | La dépense entre dans la **marge** de la campagne | bleu
Bon et facture | Facture **payée**, bon **payé** s'il ne reste rien | orange
```

> Les petites dépenses hors bon (réparations, imprévus…) suivent le même principe : elles sont saisies directement sur une ligne du budget.

---

## Qui saisit quoi, et où

**La règle tient en une phrase : un budget lié à une proforma se saisit sur la proforma ; tous les autres sur la fiche budget. Les factures se paient depuis la liste des factures.**

```choix
titre: J'ai une dépense à enregistrer : où aller ?
question: De quoi s'agit-il ?
Petite dépense | **Proforma → Dépense** si le budget est lié à une proforma ; sinon **fiche budget → Dépense** | bleu
Avance fournisseur | **Fiche du bon de commande → Verser une avance** | orange
Facture à payer | **Prestataires → Liste Factures → Appliquer le paiement** | vert
Prestataires terrain | **Camptrack**, avec la ligne de budget du lot | violet
```

| Dépense | Où la saisir | Qui |
|---|---|---|
| Petite dépense d'une campagne (budget **lié à une proforma**) | **Proforma** → *Dépense* → choix de la ligne | Comptable, ou accueil (espèces, plafonné) |
| Petite dépense d'un budget **sans proforma** (mensuel, ponctuel…) : **le cas par défaut** | **Fiche budget** → *Dépense* sur la ligne | Comptable, ou accueil (espèces, plafonné) |
| Avance à un fournisseur | **Fiche du bon de commande** → *Verser une avance* | Comptable |
| Facture d'un **Fournisseur** (rattachée à son bon de commande) | **Prestataires → Liste Factures** → *Appliquer le paiement* | Comptable |
| Facture d'un **prestataire interne ou externe** (sans bon) : par exemple la paie, sur le budget mensuel de la comptabilité | **Prestataires → Liste Factures** → *Appliquer le paiement* | Comptable |
| Prestataires terrain (lots) | **Camptrack** (avec la ligne de budget) | Comptable Camptrack |
| Campagne **sans budget** (ancien fonctionnement) | Proforma → *Dépense* | Droit caisse |
| Apports, transferts, création de caisse | Journal de caisse | Droit caisse |

Sur la fiche d'un budget lié à une proforma, le bouton s'appelle **« Saisir sur la proforma »** : il ouvre la proforma avec la ligne déjà choisie.

---

## 1. Qui fait quoi

Les droits sont réglés dans **Paramètres → Rôles**. Aucun nom n'est inscrit dans le code : il suffit de cocher les cases du rôle.

| Acteur | Droit à cocher sur son rôle | Ce qu'il fait dans Proforma |
|---|---|---|
| Directrice générale | Valider les budgets mensuels, de campagne et au-dessus du plafond | Valide les budgets (seule pour les mensuels, les campagnes et au-dessus du plafond), signe les bons de commande, approuve les dépassements, annule une dépense |
| Assistant(e) de direction | Valider les budgets (hors mensuels et campagne) | Valide les budgets ponctuels et pour tiers jusqu'au plafond délégué |
| Comptable | Enregistrer les dépenses de budget | Applique le paiement des factures, verse les avances, enregistre les dépenses, rattache les paiements Camptrack |
| Accueil | Saisir les petites dépenses (espèces, plafonnées) | Réparations, imprévus… sur une ligne de budget, **en espèces**, jusqu'au maximum réglé dans Paramètres → Rôles (50 000 F par défaut). Ne paie ni bon de commande ni facture |
| Caisse | Saisir au journal de caisse (hors budget) | Saisie directe au journal : dépenses des campagnes sans budget, apports, transferts |
| Chef de projet / demandeur | Aucun droit particulier | Prépare le budget, corrige les lignes renvoyées, joint le budget signé, crée les bons de commande |

```choix
titre: Qui valide un budget ?
question: Quel est le type du budget, et son montant ?
Mensuel ou campagne | **La DG** (administrateur), quel que soit le montant | rose
Au-dessus du plafond délégué | **La DG** (administrateur), quel que soit le type | violet
Ponctuel ou tiers, sous le plafond | **L'assistant(e) de direction** (ou la DG) | cyan
```

> ⚠️ **Séparation des tâches** : la personne qui a validé un budget, ou accordé une ligne, ne peut pas en enregistrer les dépenses. Personne ne valide sa propre demande.

### Rôles et droits : page, puis actions

Dans **Paramètres → Rôles**, chaque rôle s'ouvre sur une grille, avec une carte par rubrique (Proforma, Clients, Commerciaux, Prestataires, Produits, Finance, Budget, Paramètres) :

1. **Accès à la page** : sans lui, la rubrique n'apparaît pas dans le menu et toutes ses actions sont grisées.
2. **Les actions** permises sur cette page, une case chacune : créer, modifier, changer le statut, valider, annuler, supprimer, exporter, joindre des pièces…

Une action non cochée disparaît de l'écran, et le serveur la refuse avec un message du type « Votre rôle n'a pas le droit : … ».

À retenir :

- **Proformas visibles** : « Toutes », ou « Seulement les siennes ». Les siennes sont les proformas créées par la personne, ou dont elle est le commercial (même adresse e-mail que son compte). Un nouveau rôle ne voit que les siennes.
- **Statut d'une proforma** : *Validée* demande le droit « Valider », et *Annulée* le droit « Annuler ». Les autres statuts demandent le droit « Changer le statut ». *Payée* et *Soldée* restent automatiques : ils suivent les encaissements.
- **Annuler plutôt que supprimer** : ce qui a un historique s'annule (proforma) ou se désactive (prestataire, commercial). On ne supprime que ce qui vient d'être créé : une proforma en brouillon sans encaissement, budget ni bon de commande, ou un client sans proforma. **Un prestataire ne se supprime jamais.**
- **Commerciaux** : un commercial désactivé n'est plus proposé sur les nouvelles proformas. Ses proformas existantes ne changent pas.
- **Exports** : chaque export (Excel, PDF) a son droit. Le PDF d'un budget à faire signer reste toujours imprimable.
- Les cases du circuit budget et de la caisse, décrites dans le tableau ci-dessus, figurent aussi dans cette grille.

---

## 2. Le budget de campagne

```flux
titre: Du budget demandé au budget ouvert aux dépenses
Chef de projet | Crée le budget, lié à **la** proforma du client, avec ses lignes | violet
DG | Décide **ligne par ligne** : accorder, ajuster ou faire corriger | rose
Chef de projet | **Imprime** le budget, le fait **signer** par la DG | orange
Chef de projet | **Joint le scan signé** sur la fiche du budget | bleu
Plateforme | Budget **validé** : dépenses possibles sur les lignes accordées | vert
```

1. **Le chef de projet crée le budget** (*Budget → Faire une demande*), type « Campagne », en le liant à **la** proforma du client (un budget n'a qu'**une seule** proforma). Pour chaque ligne, il indique la désignation, le **département** concerné (liste gérée dans *Prestataires → Départements* ; le total par département s'affiche sous le total du budget), la catégorie, le **moyen de paiement prévu** (espèces, Mobile Money, chèque, virement, carte) et le montant. Le total par moyen de paiement s'affiche. Chaque ligne peut aussi recevoir, au choix, un **délai** (sa propre date limite : chaque service a ses échéances) et un **détail** (quantités, prix unitaires, fournisseur pressenti… via l'icône carnet de la ligne). Sur la fiche du budget, un clic sur la désignation d'une ligne ouvre sa fenêtre **Détail** ; un badge signale un délai proche (3 jours ou moins) ou dépassé.
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

```flux
titre: La vie d'un bon de commande
Chef de projet | Crée le bon, avec **une** proforma et une **ligne accordée** | orange
Plateforme | Bon **validé d'office** (il tient dans le reste de la ligne) | vert
DG | **Signe** le bon imprimé ; le scan est joint sur la fiche | rose
Fournisseur | Exécute : **BAT**, livraison, **bordereau signé** | cyan
Fournisseur | Envoie sa **facture** (même montant que le bon) | violet
Comptable | **Appliquer le paiement** : bon **payé** | vert
```

1. Le bon est créé dans **Prestataires → Bons de commande**, avec **une seule proforma**. Le champ **« Ligne de budget »** propose :
   - **proforma liée à un budget** : **uniquement les lignes accordées de ce budget**, avec ce qui reste à engager sur chacune ;
   - **pas de proforma** (achat interne) ou **proforma sans budget** : les lignes des budgets sans proforma (mensuel, ponctuel…).

   La ligne est **facultative à la création** (choix « Plus tard ») : sans ligne, le bon reste en brouillon. On la choisit ensuite sur la **fiche du bon** (*Rattacher à une ligne de budget*), qui ne montre, elle aussi, que les lignes du budget de la proforma du bon. Une ligne d'un autre budget est toujours refusée.
2. **Ligne accordée = bon validé d'office.** Si la ligne est accordée et que le bon tient dans ce qui reste à engager sur elle (plafond − déjà dépensé − autres bons en cours), il passe **« Validé »** tout de suite. Une notification part : « Le bon de commande X a été émis pour l'exécution de l'activité liée à la proforma Y » (demandeur du budget, comptables, direction). Au-delà du reste, le bon est refusé : réduire le bon ou demander un dépassement.
3. **Scan du bon signé** : on l'imprime, la DG le signe, on **joint le scan** sur la fiche du bon. Tant qu'il manque :
   - la partie « Scan du bon de commande signé à joindre » est **en rouge** sur la fiche ;
   - une **pastille rouge « Scan signé manquant »** s'affiche dans la liste des bons ;
   - un rappel est envoyé au demandeur et à la direction ;
   - **aucun paiement** (avance ou solde) n'est possible.
4. Un bon sans ligne de budget (campagne sans budget) suit l'ancien circuit : la DG le valide une fois le scan joint.
5. La fiche du bon affiche la **liasse**, le **payé et le reste par ligne de produit**, les avances et le solde.

### La liasse du bon de commande

Chaque pièce a sa ligne sur la fiche du bon. **Tant qu'une pièce attendue manque, sa ligne est en rouge, avec un bouton « À joindre » qui clignote.**

```flux
titre: Les pièces de la liasse, dans l'ordre où elles arrivent
Avant le budget | **Proforma fournisseur** (à fournir) | cyan
Émission | **Bon de commande signé** par la DG (requis) | rouge
Exécution | **BAT signé** (facultatif) | gris
Livraison | **Bordereau signé** ou attestation de service fait (requis) | orange
Fin | **Facture** du prestataire (requise) | violet
```

| Pièce | Statut | Quand |
|---|---|---|
| Bon de commande signé (DG) | **Requise** : aucun paiement sans elle | Dès l'émission du bon |
| Proforma fournisseur | À fournir (en rouge si absente), **ne bloque pas le paiement** | Obtenue avant le budget : jointe au budget à sa création, ou au bon ensuite |
| BAT signé | Facultatif | Si un bon à tirer a été validé |
| Bordereau de livraison signé **ou** attestation de service fait | **Requise pour le solde** | À la livraison / fin de la prestation |
| Facture du prestataire | **Requise pour le solde** | Enregistrée sur le bon (« Enregistrer la facture ») : elle apparaît dans la liasse et dans la liste des factures |
| Autre document | Facultatif, à préciser (ex. PV de réception, photos de la pose) | Au besoin |

**Proforma fournisseur jointe au budget** : à la création du budget (ou plus tard, « Ajouter des documents »), choisir le type « Proforma fournisseur (devis) » et **indiquer le fournisseur** : son nom est ajouté au nom du fichier. Sur la fiche du bon, la ligne « Proforma fournisseur » liste les proformas du budget : cliquer **« Utiliser pour ce bon »** sur celle du fournisseur du bon. Si aucune ne correspond (ou si le bon n'est pas encore rattaché à un budget), joindre directement la proforma au bon.

> Le rapport n'est plus demandé ; les rapports déjà joints restent visibles dans « Autres documents ».

**Statuts du bon** : Brouillon → Validé → Livré → **Payé**. Le statut Payé est **automatique** : il est posé quand le reste du bon tombe à zéro. Une annulation rétablit le statut précédent.

---

## 4. Payer un prestataire

### La facture du fournisseur

- La facture d'un **Fournisseur** est toujours rattachée à **son bon de commande**, et son **montant doit être celui du bon** (montant net). Un bon n'a qu'une facture : pour la remplacer, annuler d'abord l'ancienne.
- La facture d'un **prestataire interne ou externe** n'a pas de bon : elle est rattachée **directement à une ligne de budget** (par exemple le budget mensuel de la comptabilité pour la paie des employés). La ligne peut être choisie à l'enregistrement ou au moment de payer.

### Appliquer le paiement (comptable)

```choix
titre: Quelle facture, rattachée à quoi ?
question: Qui est le prestataire ?
Fournisseur | Facture rattachée à **son bon de commande**, même montant que le bon | orange
Prestataire interne ou externe | Pas de bon : facture rattachée **directement à une ligne de budget** (ex. paie sur le budget mensuel) | violet
```

```flux
titre: Appliquer le paiement, en un clic
Comptable | Ouvre la **liste des factures**, bouton *Appliquer le paiement* | vert
Comptable | Choisit la **caisse**, le moyen, la date ; joint la **preuve de paiement** | cyan
Plateforme | Contrôle : **scan du bon**, liasse, budget ouvert, solde de caisse | ambre
Plateforme | Caisse, budget, proforma mis à jour ; **facture et bon payés** | vert
```

Dans **Prestataires → Liste Factures**, chaque facture « en attente » a un bouton **Appliquer le paiement** (aussi sur la fiche du prestataire et sur la fiche du bon). La fenêtre indique la facture, le bon, la ligne de budget et **le montant à payer**, fixé au reste (facture − avances déjà versées). On choisit :

- la caisse, le moyen de paiement, la date et la référence ;
- la ligne de budget, s'il s'agit d'une facture de prestataire interne ou externe sans ligne ;
- **la preuve de paiement, obligatoire** (reçu Mobile Money, ordre de virement, décharge espèces).

En un clic : sortie de caisse, ligne de budget consommée, dépense sur la proforma de la campagne, facture **« payée »**, et bon **« payé »** s'il ne reste rien. Si quelque chose bloque (scan du bon manquant, liasse incomplète, budget pas ouvert), la fenêtre l'indique en rouge.

**Liasse** : par défaut, le solde d'un bon exige aussi le bordereau de livraison signé (ou l'attestation de service fait) et la facture avec sa pièce. La proforma fournisseur et le BAT ne bloquent jamais le paiement. Ce réglage se change dans **Paramètres → Rôles** (« Exiger la liasse complète pour payer un bon de commande »). Le scan du bon signé reste toujours exigé.

### Délais de paiement et retards

Une facture « en attente » doit être payée dans un délai qui dépend du type du prestataire, compté **à partir de la date de la facture** :

| Type de prestataire | Délai de paiement |
|---|---|
| Fournisseur | **30 jours** |
| Prestataire interne | **7 jours** |
| Prestataire externe | **3 jours** |

```flux
titre: Quand le délai est dépassé
Plateforme | Sous la date : **échéance**, en orange 2 jours avant | ambre
Plateforme | Délai dépassé : **ligne rouge** qui clignote, bouton rouge *En retard · n j — Payer* | rouge
Plateforme | Le matin (jours ouvrés) : **notification** aux comptables et à la direction, une fois par facture | orange
Comptable | Clique le bouton rouge : *Appliquer le paiement* ; la ligne redevient normale | vert
```

- **Liste des factures** : la carte rouge « En retard de paiement » donne le nombre et le montant, toutes périodes confondues ; un clic n'affiche que les factures en retard.
- **Liste des prestataires** : un bandeau rouge résume les retards ; la ligne du prestataire est rouge, avec une pastille clignotante « n en retard · n j » qui ouvre ses factures en retard.
- **Fiche du prestataire** : bandeau rouge et lignes rouges dans l'historique des factures.

Les trois délais se changent dans **Paramètres → Rôles** (« Délais de paiement des prestataires »). Après un changement, les factures encore en retard sont de nouveau notifiées le lendemain matin. Le canal de la notification (email, application ou les deux) se règle dans **Paramètres → Notifications** (« Facture prestataire en retard de paiement »).

### L'avance

Sur la fiche du bon, **Verser une avance** (comptable) : montant libre jusqu'au reste du bon, même fenêtre, preuve de paiement obligatoire. L'avance reste **« non justifiée »** tant que la liasse n'est pas complète. Le solde, payé ensuite depuis la facture, déduit les avances.

> ⚠️ **Annuler une dépense** est réservé à la DG. L'annulation passe une contre-écriture dans la caisse et la proforma. La facture redevient à payer et le bon retrouve son statut précédent. Une dépense n'est jamais supprimée.

---

## 5. Les petites dépenses (hors bon de commande)

La fenêtre *Dépense* (proforma ou fiche budget) ne sert plus qu'aux **dépenses hors bon** : réparations, imprévus, carburant, petites fournitures…

```choix
titre: Où saisir une petite dépense ?
question: Le budget est-il lié à une proforma ?
Oui (campagne) | Sur la **proforma** : bouton *Dépense*, puis choix de la ligne | bleu
Non (mensuel, ponctuel…) | Sur la **fiche budget** : bouton *Dépense* sur la ligne | violet
Pas de budget du tout | Sur la proforma, directement en caisse (droit *Saisir au journal de caisse*) | gris
```

```choix
titre: Qui peut la saisir ?
question: Montant et moyen de paiement
Accueil | En **espèces**, jusqu'à **50 000 F** (réglable) | cyan
Comptable | Tout montant, tout moyen de paiement | vert
```

- **Budget lié à une proforma** (campagne) : sur la **proforma**, bouton *Dépense*, puis choix de la ligne de budget.
- **Budget sans proforma** (mensuel, ponctuel…) : sur la **fiche budget**, bouton *Dépense* sur la ligne.
- **Accueil** (droit « petites dépenses ») : en **espèces**, jusqu'au maximum réglé (50 000 F par défaut). Au-delà, ou pour un bon de commande ou une facture, c'est le comptable.
- Justificatif : un fichier, ou la case « Dépense sans justificatif » avec un motif.
- **Campagne sans budget** : la dépense sort directement de la caisse et est imputée à la proforma (droit *Saisir au journal de caisse*). À terme, toute campagne aura un budget.

Si le budget existe mais n'est pas encore validé, si son budget signé manque, ou s'il est clôturé, la dépense est refusée.

### La proforma centralise la campagne

- Chaque dépense de la proforma affiche son **origine** : *Budget DB-… · ligne*, *Avance / Solde BC-…*, *Facture …*, *CampTrack · lot …*, ou *Hors budget*.
- La carte **Rentabilité de la campagne** donne : chiffre d'affaires HT, encaissé, budget accordé, dépensé (par le budget, hors budget, CampTrack à rattacher), reste sur le budget, **marge prévue** (CA − budget) et **marge réelle** (CA − dépensé).
- **Dépenses antérieures au budget** : si une proforma avait déjà des dépenses avant que son budget existe, elles apparaissent sur la fiche budget dans le bandeau orange « dépenses hors budget à rattacher ». Le comptable clique sur *Rattacher* et choisit la ligne : la caisse n'est pas touchée une seconde fois.

---

## 6. Paiement des prestataires terrain (Camptrack)

Les prestataires sont payés **par lots**, un lot par campagne : un état de paiement MoMo ou un virement groupé. Camptrack envoie à Proforma le **résumé du lot** : référence, nombre de bénéficiaires, total et détail.

```choix
titre: Un lot Camptrack arrive dans Proforma
question: La campagne a-t-elle un budget ?
Oui | Dépense sur la **ligne de budget** choisie dans Camptrack (plafond et caisse contrôlés) | violet
Non | Dépense directe sur la **proforma** de la campagne | bleu
Ligne pas encore envoyée | Marqué **« à rattacher »** : le comptable choisit la ligne sur la fiche budget | ambre
```

- **La campagne a un budget** : le comptable choisit dans Camptrack la **ligne de budget** du lot. Le plafond et la caisse sont contrôlés. Le lot devient une dépense de budget, et son détail s'ouvre depuis la fiche budget (*Lot … — N bénéficiaire(s)*).
- **La campagne n'a pas de budget** : le lot devient une dépense sur la proforma.
- Un lot envoyé deux fois, par exemple après une coupure réseau, **n'est jamais payé deux fois**.
- Les paiements Camptrack sont **justifiés dans Camptrack**, qui conserve les états signés et l'historique MTN. Ils n'apparaissent pas dans les justificatifs manquants.

- Le détail de chaque lot (prestataire, numéro MoMo, type, montant) se consulte aussi depuis l'écriture du **journal de caisse**.

**Période de transition** : tant que Camptrack n'envoie pas la ligne de budget, ses paiements, un par un ou par lot, arrivent comme avant. Sur une campagne avec budget, ils sont marqués **« à rattacher »** : un bandeau orange s'affiche sur la fiche budget, et ils figurent dans l'état du soir. Le comptable clique sur *Rattacher* et choisit la ligne. La caisse n'est pas touchée une seconde fois.

---

## 7. Dépenses courantes et caisse

- La saisie directe au journal de caisse (dépense, recette, transfert, création de caisse) demande le droit **Saisir au journal de caisse**. Les autres rôles consultent le journal sans pouvoir y écrire.
> **Aucune sortie ne dépasse le solde** de la caisse : saisie manuelle, transfert, budget, proforma et Camptrack sont tous contrôlés.

---

## 8. Justificatifs

```flux
titre: Le justificatif d'une dépense
Jour J | Dépense enregistrée : **Justificatif reçu ? Non** | bleu
24 h ouvrées | Délai pour joindre le justificatif (lundi au vendredi) | ambre
Au-delà | La dépense passe **en rouge** et figure dans l'état du soir | rouge
Ajout | *Ajouter le justificatif* : **Oui**, fichier protégé | vert
```

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
| « Le montant de la facture … doit être celui du bon de commande » | Vérifier la facture : elle doit correspondre au montant net du bon |
| « Ce bon de commande … dépasse ce qui reste à engager sur la ligne » | Réduire le bon, ou demander un dépassement sur la ligne |
| « La ligne … n'appartient pas au budget de la proforma de ce bon » | Choisir une ligne du budget de la proforma du bon, ou changer de proforma |
| « Joignez la preuve de paiement » | Joindre le reçu Mobile Money, l'ordre de virement ou la décharge |
| « Montant au-dessus du maximum des petites dépenses » | Faire enregistrer la dépense par le comptable |
| « Solde impossible : la liasse … est incomplète » | Joindre les pièces manquantes indiquées : bordereau signé ou attestation, facture |
| « Vous avez validé ce budget … séparation des tâches » | Une autre personne enregistre la dépense |
| « Le budget … n'est pas ouvert aux dépenses » | Faire valider le budget, ou en créer un nouveau s'il est clôturé |
| « Le budget signé n'est pas encore joint » | Le demandeur imprime le budget, le fait signer par la DG et joint le scan sur la fiche du budget |

## Départements

- Les départements se gèrent dans **Prestataires → Départements** : nom (toujours en MAJUSCULES), code court, description, contact, code comptable, couleur, montant mensuel indicatif. Un département ne se supprime pas : on le **désactive** (il n'est plus proposé sur les nouvelles lignes).
- **Chaque ligne de budget** est rattachée à un département ; le budget entier n'a plus de département. La fiche du budget et son PDF affichent le **total par département**.
- Les **prestataires internes et externes** peuvent être rattachés à un département avec un **poste** : responsable de département (un seul par département), équipe, stagiaire professionnel, stagiaire académique, prestataire ponctuel. Les **fournisseurs** ne le sont jamais. Chaque changement (département ou poste) est conservé dans l'historique, avec sa date, son motif et son auteur.
- La **fiche d'un département** montre son responsable, ses prestataires, ses dépenses des 6 derniers mois (comparées au montant mensuel indicatif) et ses lignes de budget en cours.
- Droits (Paramètres → Rôles, page Prestataires) : créer, modifier, activer / désactiver un département ; rattacher un prestataire à un département.
