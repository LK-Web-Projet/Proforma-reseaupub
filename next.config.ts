import type { NextConfig } from "next";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  output: "standalone",
  // ⚠️ NE PAS ajouter "@clerk/nextjs"/"@clerk/backend" à `serverExternalPackages` : testé et
  // annulé (voir HISTORIQUE.md) — ça force Next.js à charger ce package via un vrai `import()`
  // Node natif (mode ESM strict) au lieu de le bundler, ce qui casse TOUTE l'app (pas
  // seulement instrumentation.ts) car @clerk/nextjs@6.39.5 a des imports internes sans
  // extension de fichier (`from "./client-boundary/controlComponents"`), invalides en ESM
  // Node strict mais tolérés par un bundler normal. Le bootstrap RBAC automatique au
  // démarrage (instrumentation.ts) échoue donc silencieusement en prod (try/catch, ne bloque
  // rien) — la méthode fiable pour synchroniser les rôles reste le script CLI manuel
  // (scripts/seed-admin-users.ts) lancé via un conteneur temporaire sur le réseau du VPS.
  experimental: {
    // Désactive l'utilisation de lightningcss → Next.js utilisera PostCSS/autoprefixer
    optimizeCss: false,
  },
  env: {
    // Source unique de vérité : le champ "version" de package.json.
    // Pour publier une nouvelle version : `npm version patch|minor|major`, ou éditer directement package.json.
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
};

export default nextConfig;
