# Mémo Technique du Projet Proforma-Reseaupub

Ce document sert de mémo technique pour les développeurs travaillant sur le projet Proforma-Reseaupub. Il détaille l'architecture, les composants clés et les conventions du projet.

## 1. Objectif de l'Application

Proforma-Reseaupub est une plateforme de gestion financière conçue pour les besoins internes de l'entreprise. Ses fonctionnalités principales sont :
- **Gestion de Factures Proforma** : Création, édition, et envoi des factures proforma aux clients.
- **Gestion de Trésorerie** : Enregistrement des entrées (recettes) et des sorties (dépenses) de plusieurs caisses.
- **Gestion des Fournisseurs** : Suivi des fournisseurs et de leurs factures.
- **Gestion des Commerciaux (Gestionnaires)** : Association des commerciaux aux factures pour le suivi de leurs performances.
- **Reporting** : Consultation de statistiques et exportation de journaux de caisse.

## 2. Architecture & Technologies

Le projet est une application web full-stack basée sur **Next.js** avec le **App Router**.

- **Framework Frontend/Backend** : [Next.js](https://nextjs.org/) (v13+)
- **Langage** : [TypeScript](https://www.typescriptlang.org/)
- **Base de Données** : [PostgreSQL](https://www.postgresql.org/)
- **ORM** : [Prisma](https://www.prisma.io/)
- **Authentification** : [Clerk](https://clerk.com/)
- **UI Components** : [shadcn/ui](https://ui.shadcn.com/)
- **Styling** : [Tailwind CSS](https://tailwindcss.com/)
- **Validation de Données** : (Probablement Zod, à confirmer dans le code)
- **Gestionnaire de Paquets** : npm

## 3. Base de Données (`prisma/schema.prisma`)

La base de données est le cœur de l'application. Voici une description des modèles principaux :

| Modèle | Description | Relations Clés |
| :--- | :--- | :--- |
| `Client` | Représente un client de l'entreprise. | Un client peut avoir plusieurs `Invoice`. |
| `Invoice` | Représente une facture proforma. Contient tous les détails financiers, le statut, etc. | Liée à un `Client`, plusieurs `Gestionnaire` (via `InvoiceGestionnaire`), et plusieurs `Produit` (via `InvoiceProduit`). |
| `Produit` | Modèle de base pour un produit ou service vendable. | --- |
| `InvoiceProduit` | Table de liaison pour inclure un produit dans une facture avec une quantité, un prix, une durée, etc. | Lie `Invoice` et `Produit`. |
| `Gestionnaire` | Représente un commercial/employé qui gère des factures. | Lié à `Invoice` via la table `InvoiceGestionnaire`. |
| `Paiement` | Enregistre un paiement (total ou partiel) effectué pour une `Invoice`. | Lié à une `Invoice`. Peut être lié à une `CashJournal`. |
| `CashRegister` | Représente une caisse physique ou virtuelle (ex: Caisse principale, Orange Money). | Une caisse a plusieurs `CashJournal`. |
| `CashJournal` | Représente une entrée ou une sortie dans une `CashRegister`. | Liée à une `CashRegister`. Peut être liée à un `Paiement`. |
| `Fournisseur` | Représente un fournisseur de l'entreprise. | Un fournisseur peut avoir plusieurs `FactureFournisseur`. |
| `FactureFournisseur`| Représente une facture émise par un fournisseur. | Liée à un `Fournisseur`. |
| `BonCommande` | Stocke l'URL d'un bon de commande associé à une facture. | Lié à une `Invoice`. |
| `FactureNormaliser`| Stocke l'URL d'une facture normalisée associée à une facture. | Lié à une `Invoice`. |

## 4. Endpoints de l'API (`app/api/`)

Les API Routes de Next.js sont utilisées pour la communication entre le frontend et la base de données.

| Endpoint | Méthodes | Description |
| :--- | :--- | :--- |
| `/api/clients` | `GET`, `POST` | Lister tous les clients, créer un nouveau client. |
| `/api/clients/[id]`| `GET`, `PUT`, `DELETE` | Lire, mettre à jour ou supprimer un client spécifique. |
| `/api/factures` | `GET`, `POST` | Lister toutes les factures, créer une nouvelle facture. |
| `/api/factures/[id]`| `GET`, `PUT`, `DELETE`| Lire, mettre à jour ou supprimer une facture spécifique. |
| `/api/fournisseurs`| `GET`, `POST` | Lister tous les fournisseurs, créer un nouveau fournisseur. |
| `/api/fournisseurs/[id]`| `GET`, `PUT`, `DELETE`| Lire, mettre à jour ou supprimer un fournisseur. |
| `/api/factures-fournisseurs`| `GET`, `POST` | Lister et créer les factures des fournisseurs. |
| `/api/factures-fournisseurs/[id]`| `PUT`, `DELETE` | Mettre à jour et supprimer les factures des fournisseurs. |
| `/api/gestionnaires`| `GET`, `POST` | Lister et créer des gestionnaires. |
| `/api/gestionnaires/[id]`| `GET`, `PUT`, `DELETE`| Gérer un gestionnaire spécifique. |
| `/api/produits` | `GET` | Lister tous les produits. |
| `/api/cash-journal`| `GET`, `POST` | Lister les opérations de caisse, ajouter une nouvelle opération. |
| `/api/cash-journal/recalculate`| `POST` | Recalculer les soldes du journal de caisse pour une caisse donnée. |
| `/api/cash-registers`| `GET`, `POST` | Lister les caisses, ajouter une nouvelle caisse. |
| `/api/statistiques`| `GET` | Récupérer les données pour la page des statistiques. |

## 5. Structure des Pages (`app/(main)/`)

Les pages principales de l'application sont organisées dans le dossier `app/(main)/`.

| Route | Dossier | Description |
| :--- | :--- | :--- |
| `/client` | `/client` | Page principale pour lister les clients. |
| `/client/new` | `/client/new` | Formulaire de création d'un nouveau client. |
| `/client/[id]` | `/client/[id]` | Page de détails d'un client spécifique. |
| `/facture` | `/facture` | Page principale pour lister les factures proforma. |
| `/facture/new` | `/facture/new` | Formulaire de création d'une nouvelle facture. |
| `/facture/[id]` | `/facture/[id]` | Page de détails d'une facture. |
| `/fournisseur` | `/fournisseur` | Page de gestion des fournisseurs. |
| `/fournisseur/[id]/factures`| `/fournisseur/[id]/factures`| Liste les factures pour un fournisseur donné. |
| `/journal-caisse` | `/journal-caisse` | Affiche le journal de caisse avec les entrées et sorties. |
| `/statistiques` | `/statistiques` | Dashboard avec des indicateurs de performance. |
| `/gestionnaire` | `/gestionnaire` | Page de gestion des commerciaux. |

## 6. Authentification avec Clerk

L'authentification est gérée par **Clerk**.
- Le `middleware.ts` à la racine protège les routes de l'application. Seuls les utilisateurs authentifiés peuvent accéder aux pages, à l'exception de la page de connexion.
- La page `app/sign-in` contient l'interface de connexion fournie par Clerk.
- Les informations de l'utilisateur connecté sont accessibles via les hooks de Clerk (`@clerk/nextjs`).

## 7. Scripts Utilitaires (`prisma/scripts/`)

Des scripts sont disponibles pour des tâches de maintenance. Ils sont exécutables avec `npx ts-node <chemin_du_script>`.

| Script | Description |
| :--- | :--- |
| `recalculateResteAPayer.ts` | **(Hypothèse)** Ce script recalcule le champ `resteAPayer` pour toutes les factures en se basant sur leur montant total et les paiements effectués. Utile en cas de désynchronisation des données. |
| `resynccashjour.ts` | **(Hypothèse)** Ce script recalcule le champ `solde` pour chaque opération du `CashJournal` en s'assurant que la séquence est correcte. |

Ce mémo doit être maintenu à jour à mesure que le projet évolue.