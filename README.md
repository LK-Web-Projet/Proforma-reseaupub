# Proforma-Reseaupub

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white) ![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white) ![Clerk](https://img.shields.io/badge/Clerk-6C47FF?style=for-the-badge&logo=clerk&logoColor=white) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

Plateforme interne de gestion financière pour la création de factures proforma, le suivi de la trésorerie et la gestion des fournisseurs.

Pour une documentation technique détaillée sur l'architecture, les modèles de données et les API, veuillez consulter le fichier **[MEMO.md](./MEMO.md)**.

---

## 🚀 Démarrage Rapide

Suivez ces étapes pour configurer et lancer le projet en environnement de développement.

### 1. Prérequis

- [Node.js](https://nodejs.org/en/) (version 20.x ou supérieure)
- [npm](https://www.npmjs.com/) (généralement inclus avec Node.js)
- [Git](https://git-scm.com/)
- [Docker](https://www.docker.com/) (recommandé pour la base de données)

### 2. Installation

1.  **Clonez le dépôt :**
    ```bash
    git clone <URL_DU_DEPOT>
    cd Proforma-reseaupub
    ```

2.  **Installez les dépendances :**
    ```bash
    npm install
    ```

3.  **Configurez les variables d'environnement :**

    Créez un fichier `.env.local` à la racine du projet en copiant `.env.example` (s'il existe) ou en partant de zéro. Remplissez les variables requises :

    ```env
    # Base de données (Prisma)
    # Exemple avec une base de données locale via Docker
    DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"
    DIRECT_URL="postgresql://user:password@localhost:5432/mydb?schema=public"

    # Authentification (Clerk)
    # Récupérez ces clés depuis votre dashboard Clerk
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
    CLERK_SECRET_KEY=sk_test_...

    NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
    NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
    ```

4.  **Mettez en place la base de données :**

    Lancez une instance PostgreSQL (par exemple avec Docker). Appliquez ensuite les migrations Prisma pour créer le schéma de la base de données.

    ```bash
    npx prisma migrate dev
    ```

5.  **Peuplez la base de données (seeding) :**

    Exécutez le script de seeding pour insérer les données initiales.

    ```bash
    npm run db:seed
    ```

### 3. Lancer l'Application

Une fois l'installation terminée, lancez le serveur de développement :

```bash
npm run dev
```

L'application sera accessible à l'adresse [http://localhost:3000](http://localhost:3000).

## 🛠️ Scripts Disponibles

- `npm run dev`: Lance le serveur de développement avec Turbopack.
- `npm run build`: Compile l'application pour la production.
- `npm run start`: Démarre un serveur de production.
- `npm run lint`: Lance le linter ESLint pour vérifier la qualité du code.
- `npm run db:seed`: Exécute le script de seeding de la base de données.