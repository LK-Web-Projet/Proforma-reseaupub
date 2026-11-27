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
- **Page Budget** : elle se coche comme les autres (avant, tout le monde y avait accès). Sans elle, la rubrique Budget disparaît du menu, on ne peut ni faire une demande de budget ni ouvrir les budgets, et le PDF d'un budget n'est plus téléchargeable. Les cases *Valider les budgets*, *Valider au niveau direction*, *Dépenser / payer* et *Petites dépenses* restent valables depuis la proforma et les prestataires. Lors de la mise à jour, tous les rôles existants ont reçu la page : l'administrateur la retire aux rôles qui ne doivent plus la voir ; un nouveau rôle ne l'a pas.

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

1. **Le chef de projet crée le budget** (*Budget → Faire une demande*), type « Campagne », en le liant à **la** proforma du client (un budget n'a qu'**une seule** proforma). Pour chaque ligne, il indique la désignation, le **département** concerné (liste gérée dans *Prestataires → Départements* ; le total par département s'affiche sous le total du budget), la catégorie, le **moyen de paiement prévu** (liste gérée dans *Finance → Moyens de paiement*) et le montant. Le total par moyen de paiement s'affiche. Chaque ligne peut aussi recevoir, au choix, un **délai** (sa propre date limite : chaque service a ses échéances) et un **détail** (quantités, prix unitaires, fournisseur pressenti… via l'icône carnet de la ligne). Sur la fiche du budget, un clic sur la désignation d'une ligne ouvre sa fenêtre **Détail** ; un badge signale un délai proche (3 jours ou moins) ou dépassé.
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

1. Le bon est créé dans **Prestataires → Bons de commande**. Le formulaire demande d'abord : **« Ce bon de commande est-il pour une campagne ? »**. **Un bon est toujours rattaché** : il n'y a plus de bon lié à rien.
   - **Campagne** : la **proforma** est obligatoire (une seule, validée, payée ou soldée).
     - La proforma a un **budget validé** : la **ligne de ce budget** qui finance le bon est obligatoire (seules ses lignes accordées sont proposées, avec ce qui reste à engager).
     - La proforma a un budget **pas encore validé** : le bon ne peut pas être émis ; attendre la validation du budget.
     - La proforma **n'a pas de budget** : pas de ligne ; le bon reste en brouillon et la **direction le valide directement** depuis sa fiche.
   - **Hors campagne** : choisir un **budget validé** qui n'est pas un budget de campagne et qui n'est lié à aucune proforma (mensuel, ponctuel…), puis **sa ligne**.

   Erreur de rattachement : tant que le bon est **en brouillon** (et sans paiement), on le corrige par **Modifier**, ou sur la fiche par **Changer le rattachement** : la fenêtre repose la question « campagne ou hors campagne », puis proforma (et ligne de son budget) ou budget puis ligne. Il suit alors le bon circuit. Une ligne d'un autre budget est toujours refusée.
2. **Ligne accordée = bon validé d'office.** Si la ligne est accordée et que le bon tient dans ce qui reste à engager sur elle (plafond − déjà dépensé − autres bons en cours), il passe **« Validé »** tout de suite. Une notification part : « Le bon de commande X a été émis pour l'exécution de l'activité liée à la proforma Y » (demandeur du budget, comptables, direction). Au-delà du reste, le bon est refusé : réduire le bon ou demander un dépassement.
3. **Scan du bon signé** : on l'imprime, la DG le signe, on **joint le scan** sur la fiche du bon. Tant qu'il manque :
   - la partie « Scan du bon de commande signé à joindre » est **en rouge** sur la fiche ;
   - une **pastille rouge « Scan signé manquant »** s'affiche dans la liste des bons ;
   - un rappel est envoyé au demandeur et à la direction ;
   - **aucun paiement** (avance ou solde) n'est possible.
4. **Campagne sans budget** : la direction **valide directement** le bon depuis sa fiche (statut « Validée »), sans attendre le scan signé. Le scan reste exigé avant tout paiement (avance ou solde, payés depuis la proforma), et le rappel de le joindre est envoyé.
   **Anciens bons** : un brouillon lié à rien porte la pastille **« À rattacher »** dans la liste ; sur sa fiche, le bouton **« Rattacher à un budget »** ouvre la même fenêtre (campagne ou hors campagne…). Il ne peut pas être validé avant ; les autres anciens brouillons (proforma avec budget mais sans ligne…) sont validés par la DG une fois le scan signé joint. Les bons déjà validés, livrés ou payés ne changent pas.
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
- La facture d'un **prestataire interne ou externe** n'a pas de bon : à l'enregistrement, on choisit **la ligne de budget** qui la paie (par exemple le budget mensuel de la comptabilité pour la paie des employés). La ligne est **facultative** pour l'instant : sans ligne, la facture se paiera par la caisse seule. Le budget ne se choisit **plus jamais au moment de payer**.

### Appliquer le paiement (comptable)

```choix
titre: Quelle facture, rattachée à quoi ?
question: Qui est le prestataire ?
Fournisseur | Facture rattachée à **son bon de commande**, même montant que le bon | orange
Prestataire interne ou externe | Pas de bon : ligne de budget choisie à l'enregistrement (facultative) | violet
```

```flux
titre: Appliquer le paiement, en un clic
Comptable | Ouvre la **liste des factures**, bouton *Appliquer le paiement* | vert
Comptable | Choisit la **caisse**, le moyen, la date ; joint la **preuve de paiement** | cyan
Plateforme | Contrôle : **scan du bon**, liasse, budget ouvert, solde de caisse | ambre
Plateforme | Caisse, budget, proforma mis à jour ; **facture et bon payés** | vert
```

Dans **Prestataires → Liste Factures**, chaque facture « en attente » a un bouton **Appliquer le paiement** (aussi sur la fiche du prestataire et sur la fiche du bon). La fenêtre indique la facture, le bon, **le montant à payer**, fixé au reste (facture − avances déjà versées), et **ce que fera le paiement**. On choisit seulement :

- le moyen de paiement, puis la caisse (seules les caisses liées à ce moyen sont proposées, voir « Moyens de paiement »), la date et la référence ;
- **la preuve de paiement, obligatoire** (reçu Mobile Money, ordre de virement, décharge espèces).

Le budget n'est **jamais choisi ici** : il découle du rattachement de la facture.

| La facture est rattachée à… | Ce que fait le paiement |
|---|---|
| un bon de commande avec sa ligne de budget, ou directement une ligne de budget | sortie de caisse, **retrait sur la ligne**, dépense sur la **proforma** du budget s'il en a une, facture « payée » (et bon « payé » au solde) |
| un bon d'une **campagne sans budget** | sortie de caisse, **dépense sur la proforma**, facture et bon « payés » |
| **rien** (pas de ligne : facture sans bon ni ligne, ancienne facture de fournisseur sans bon, ancien bon sans rattachement) | **sortie de la caisse choisie seulement** et facture « payée » ; rien n'est retiré d'un budget |

Avec un bon de commande, ses contrôles restent toujours : bon validé, **scan signé** joint, liasse complète pour le solde. Si quelque chose bloque, la fenêtre l'indique en rouge. Une facture payée par la caisse seule garde son écriture de caisse (preuves jointes à l'écriture) : son statut ne se change plus à la main.

**Liasse** : par défaut, le solde d'un bon exige aussi le bordereau de livraison signé (ou l'attestation de service fait) et la facture avec sa pièce. La proforma fournisseur et le BAT ne bloquent jamais le paiement. Ce réglage se change dans **Paramètres → Rôles** (« Exiger la liasse complète pour payer un bon de commande »). Le scan du bon signé reste toujours exigé.

### Facture réglée hors plateforme, et changer le statut d'une facture

Le statut d'une facture se change depuis le **menu de statut** (clic sur le statut, dans la liste des factures ou sur la fiche du prestataire). Chaque changement fait à la main est gardé dans l'**historique** de la facture (icône horloge à côté du statut) : ancien et nouveau statut, date, auteur, moyen de paiement, preuve, motif.

- **Payée (réglée hors plateforme)** : pour une facture déjà réglée en dehors de la plateforme et liée à **aucun bon de commande ni ligne de budget**. Il faut le droit *Marquer une facture payée sans paiement* (au départ : l'administration ; à ouvrir à d'autres rôles dans Paramètres → Rôles). On indique **le moyen de paiement, la date et la preuve** (obligatoires) et, au besoin, une référence. Aucune sortie de caisse : la facture est seulement notée payée, avec la mention « hors plateforme ».
- Une facture liée à un bon de commande ou à une ligne de budget passe payée **uniquement** par *Appliquer le paiement*. Une facture liée à rien peut aussi passer par *Appliquer le paiement* : l'argent sort alors de la caisse choisie.
- **Annuler** une facture en attente : droit *Annuler une facture*.
- **Changer librement** (payée → annulée, annulée → payée, retour en attente) : droit *Changer librement le statut* (administrateur). Une facture réglée par une **dépense de budget** reste protégée : il faut d'abord annuler la dépense (l'argent revient dans la caisse).

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
- **Rapports** : *Dashboard → Rapports → Suivi budgétaire*, par service, catégorie et moyen de paiement, avec export Excel ; *Dashboard → Rapports → Dépenses par département* (voir « Départements »).

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

## Budget collectif (plusieurs départements)

Un budget **mensuel** est toujours collectif ; un budget de **campagne** peut l'être (case « Budget collectif » du formulaire). Les autres budgets restent individuels et sont soumis dès leur création, comme avant.

```flux
titre: La vie d'un budget collectif
Comptable (mensuel) ou chef de projet (campagne) | Ouvre le budget **en préparation** et invite les départements | violet
Chaque département | Saisit **ses** lignes avant la date limite ; ne voit que les siennes et leur total | cyan
Comptable | Vérifie tout : **demande une correction** ou **retire** une ligne (avec un motif) | ambre
Comptable | **Soumet à la direction** : la validation ligne par ligne commence | vert
```

- **Ouvrir** : *Budget → Faire une demande*.
  - **Mensuel** : seul le comptable l'ouvre (droit *Préparer et soumettre les budgets collectifs*). Il n'y a **qu'un budget mensuel par mois**, et tous les départements actifs sont invités par défaut ; le comptable retire ceux qui ne sont pas concernés. S'il est déjà ouvert, le formulaire propose « Ajouter mes lignes à ce budget ».
  - **Campagne collective** : le chef de projet choisit la proforma et les départements invités. Il est le responsable du budget.
  - Une **date limite de saisie** est facultative : un rappel part la veille ; après elle, seuls le responsable et le comptable peuvent encore saisir (une ligne renvoyée en correction se corrige toujours).
- **Saisir** : sur la fiche du budget, encadré « Budget collectif en préparation », chaque département a son **tableau de lignes**, comme un budget ponctuel : on écrit directement dans les champs (désignation, catégorie, moyen de paiement, montant, délai, détail), **+ Ajouter une ligne** ajoute une rangée, et les **totaux se recalculent pendant la saisie** (département, total général, par moyen de paiement). Rien n'est envoyé tant qu'on n'a pas cliqué **Enregistrer** (tout ou rien) ; **Annuler** revient aux lignes enregistrées. Uniquement pour ses départements (*Paramètres → Utilisateurs*, colonne « Départements »), tant que le budget est en préparation.
- **Justifier les prix** : le **trombone** d'une ligne enregistrée permet de joindre (ou retirer) un devis du fournisseur, une facture ou une autre pièce — jamais obligatoire. Le document est rattaché à la ligne : il est vu par ceux qui voient la ligne (son département, le comptable, le responsable), avec le nom de qui l'a joint. Supprimer la ligne pendant la préparation retire aussi ses documents.
- **Qui voit quoi** :
  - le droit **Voir toutes les lignes de tous les départements** voit tout (au départ : ceux qui valident ou paient) ;
  - le responsable du budget et le comptable voient tout le budget ;
  - les autres voient **les lignes de leurs départements**, leur total et ce qui les concerne (décisions, dépenses, dépassements, commentaires).
- **Vérifier et soumettre** (comptable) : *Correction* (le département corrige sa ligne) ou *Retirer* (avec un motif) ; il ne modifie pas lui-même la ligne d'un département. Puis **Soumettre à la direction**. Sur une campagne, le responsable peut signaler **« Prêt à soumettre »** au comptable.
- **Département oublié** : tant qu'aucune ligne n'est décidée par la direction, le comptable peut **Rouvrir la préparation** ; ensuite, le département fait un budget ponctuel.
- Le responsable (ou le comptable, ou l'administrateur) peut **transférer la responsabilité** du budget à un autre compte.

## Départements

- Les départements se gèrent dans **Prestataires → Départements** : nom (toujours en MAJUSCULES), code court, description, contact, code comptable, couleur, montant mensuel indicatif. Un département ne se supprime pas : on le **désactive** (il n'est plus proposé sur les nouvelles lignes).
- **Chaque ligne de budget** est rattachée à un département ; le budget entier n'a plus de département. La fiche du budget et son PDF affichent le **total par département**.
- Les **prestataires internes et externes** peuvent être rattachés à un département avec un **poste** : responsable de département (un seul par département), équipe, stagiaire professionnel, stagiaire académique, prestataire ponctuel. Les **fournisseurs** ne le sont jamais. Chaque changement (département ou poste) est conservé dans l'historique, avec sa date, son motif et son auteur.
- La **fiche d'un département** montre son responsable, ses prestataires, ses dépenses des 6 derniers mois (comparées au montant mensuel indicatif) et ses lignes de budget en cours.
- Droits (Paramètres → Rôles, page Prestataires) : créer, modifier, activer / désactiver un département ; rattacher un prestataire à un département.
- **Rapport « Dépenses par département »** (*Dashboard → Rapports*, réservé aux rôles du circuit budget) : qui dépense le plus chaque mois.
  - Une dépense compte dans le **mois où l'argent est réellement sorti** (sa date), sur le département de sa ligne de budget, même si le budget appartient à un autre mois. Les dépenses annulées ne comptent pas.
  - Pour le mois choisi : classement des départements, part de chacun, comparaison avec le mois précédent, **prévu** des budgets de ce mois, **montant mensuel indicatif** du département (signalé s'il est dépassé), répartition par catégorie.
  - Sur la période : graphique et tableau mois par mois. **Sorties hors budget** : sorties de caisse rattachées à aucune ligne de budget (hors transferts entre caisses), qu'aucun département ne porte.
  - Export Excel (droit « Exporter les rapports ») : classement, par mois, par catégorie, détail des dépenses.
  - Résumé sur le **tableau de bord**, onglet « Ce mois » : les 5 départements qui dépensent le plus.

## Moyens de paiement

- Les moyens de paiement se gèrent dans **Finance → Moyens de paiement** : nom, description, ordre d'affichage et **caisses liées**. Au départ, la liste contient les 6 moyens d'origine (Espèces, Mobile Money, Chèque, Virement bancaire, Carte bancaire, Autre) ; on peut en ajouter d'autres (Wave, Orange Money…). Un moyen ne se supprime pas : on le **désactive** (il n'est plus proposé, mais reste affiché sur les anciennes opérations).
- Une caisse peut servir à plusieurs moyens (ex. : une banque pour le virement, le chèque et la carte) et un moyen à plusieurs caisses (ex. : le virement avec plusieurs banques).
- **Au moment de payer** (encaissement ou dépense sur la proforma, dépense sur une ligne de budget, paiement d'une facture de prestataire, avance sur un bon de commande), on choisit d'abord le moyen : **seules les caisses visibles liées à ce moyen** sont proposées. Une caisse masquée n'est jamais proposée.
- ⚠️ **Un moyen sans caisse liée ne permet aucun paiement.** Après la mise en place, il faut donc lier les caisses de chaque moyen avant de payer. Le serveur fait le même contrôle : on ne peut pas le contourner.
- Les espèces ne vont plus d'office dans la « Caisse Comptable » : il suffit de lier le moyen « Espèces » à cette caisse pour obtenir le même résultat.
- Les paiements envoyés par **Camptrack** ne sont pas soumis à cette règle : Camptrack choisit lui-même sa caisse.
- Droits (Paramètres → Rôles, page Finance) : créer, modifier (y compris les caisses liées), activer / désactiver un moyen de paiement.

## Pièces de la proforma, relances clients et historique

- **Une seule liste de pièces** sur la fiche de la proforma : bon de commande du client, **facture normalisée**, **attestation de bonne fin d'exécution**, autre document. On peut joindre plusieurs pièces de la même sorte (ex. une facture d'acompte puis une facture de solde). Ajouter ou retirer une pièce demande le droit *Joindre ou retirer des pièces* ; un retrait est noté dans l'historique (le fichier est conservé).
- **Ajouter une pièce ne change jamais le statut** de la proforma : seuls les encaissements (Payée, Soldée) et les décisions des utilisateurs le font avancer.
- **Facture normalisée** : on indique sa date d'émission, sa **date d'envoi au client** et le **délai de relance** (30 jours proposés, réglables dans Paramètres → Rôles, modifiable pour chaque facture), et au besoin son numéro et son montant. **Échéance = date d'envoi + délai.** Sans date d'envoi, pas de relance : la renseigner dès que la facture part.
- **Alertes rouges** (fiche et liste des proformas, avec filtres) :
  - *Facture normalisée manquante* : proforma validée, en cours de paiement ou soldée — ou recette déjà encaissée — sans facture normalisée. Juste après un encaissement, la plateforme propose de la joindre tout de suite.
  - *Paiement à réclamer* : l'échéance d'une facture envoyée est atteinte et la proforma n'est pas soldée (orange 2 jours avant). Les comptables et la direction sont prévenus **une fois**, le matin (jours ouvrés).
- **Dossier complet** : facture normalisée + attestation de bonne fin + proforma soldée. La fiche affiche « Dossier complet » ou ce qui manque ; l'archivage reste manuel.
- **Historique de la proforma** : toutes les actions la concernant (création, modifications, statuts, encaissements, dépenses — y compris celles du budget et de Camptrack —, annulations, pièces, justificatifs, e-mails, budget lié, relances), avec leur auteur. Pour les proformas existantes, l'historique a été reconstitué à partir des données (marqué « repris de l'existant »).
