# Projet Proforma ReseauPub

Ce projet est une application web conçue pour la gestion des factures proforma, des clients et des gestionnaires pour ReseauPub.

## Sommaire

- [Projet Proforma ReseauPub](#projet-proforma-reseaupub)
  - [Sommaire](#sommaire)
  - [Technologies Utilisées](#technologies-utilisées)
  - [Initialisation du Projet](#initialisation-du-projet)
  - [Lancement du Serveur de Développement](#lancement-du-serveur-de-développement)
  - [Structure du Projet](#structure-du-projet)
  - [Gestion des Branches](#gestion-des-branches)
  - [Qualité du Code](#qualité-du-code)

## Technologies Utilisées

- **Framework**: [Next.js](https://nextjs.org/)
- **Langage**: [TypeScript](https://www.typescriptlang.org/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Base de données**: PostgreSQL (via Supabase)
- **Style**: [Tailwind CSS](https://tailwindcss.com/)
- **Composants UI**: [shadcn/ui](https://ui.shadcn.com/)
- **Linting**: [ESLint](https://eslint.org/)

## Initialisation du Projet

Pour mettre en place l'environnement de développement local, suivez ces étapes :

1.  **Cloner le dépôt**
    ```bash
    git clone [(https://github.com/LK-Web-Projet/Proforma-reseaupub.git)]
    cd Proforma-reseaupub
    ```

2.  **Installer les dépendances**
    Assurez-vous d'avoir Node.js (version 20.x ou supérieure) et npm installés.
    ```bash
    npm install
    ```

3.  **Configurer les variables d'environnement**
    Créez un fichier `.env.local` à la racine du projet en copiant le contenu de `.env.example` (s'il existe). Remplissez les variables nécessaires, notamment `DATABASE_URL`.
    ```bash
    # .env.local
    DATABASE_URL="postgresql://user:password@host:port/database"
    ```

4.  **Appliquer les migrations de la base de données**
    Cette commande synchronisera le schéma de votre base de données avec les modèles Prisma.
    ```bash
    npx prisma migrate dev
    ```

## Lancement du Serveur de Développement

Une fois l'initialisation terminée, vous pouvez lancer le serveur de développement :

```bash
npm run dev
```

L'application sera alors accessible à l'adresse [http://localhost:3000](http://localhost:3000).

## Structure du Projet

-   `/app`: Contient les pages et les routes de l'application (App Router de Next.js).
-   `/app/api`: Contient les routes de l'API backend.
-   `/components`: Contient les composants React réutilisables.
-   `/lib`: Contient les fonctions utilitaires, la configuration de Prisma, etc.
-   `/prisma`: Contient le schéma de la base de données (`schema.prisma`) et les fichiers de migration.
-   `/public`: Contient les fichiers statiques (images, logos).

## Gestion des Branches

Pour assurer une bonne organisation et éviter les conflits, veuillez suivre cette stratégie de branches :

-   **`main`**: Cette branche contient le code stable et prêt pour la production. Personne ne doit pousser directement sur `main`.
-   **`develop`**: C'est la branche de développement principale. Toutes les nouvelles fonctionnalités doivent être fusionnées ici avant de passer sur `main`.
-   **`feature/...`**: Pour chaque nouvelle fonctionnalité, créez une branche à partir de `develop`.
    -   Exemple : `feature/gestion-clients` ou `feature/export-pdf`
-   **`security/...`**: Pour chaque test de securité lier a l'app, créez une branche à partir de `develop`.
    -   Exemple : `security//scan/api-payments` ou `security/fix/`

**Flux de travail :**
1.  Assurez-vous que votre branche `develop` est à jour : `git pull origin develop`.
2.  Créez votre branche de fonctionnalité : `git checkout -b feature/nom-de-la-feature`.
3.  Travaillez sur votre fonctionnalité et faites des commits réguliers.
4.  Une fois terminé, ouvrez une *Pull Request* (PR) de votre branche `feature/...` vers `develop`.
5.  Après la revue et l'approbation, la PR sera fusionnée.

## Qualité du Code

Pour maintenir une base de code propre et cohérente, nous utilisons ESLint. Avant de soumettre votre code, veuillez lancer la commande suivante pour vérifier et corriger les erreurs de style :

```bash
npm run lint
```
