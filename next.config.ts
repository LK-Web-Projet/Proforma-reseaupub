import type { NextConfig } from "next";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  output: "standalone",
  // @clerk/nextjs est utilisé dans instrumentation.ts (via lib/bootstrapAdminUsers.ts) — le
  // tracing du build standalone ne le détecte pas correctement derrière un import dynamique,
  // ce qui provoquait "Cannot find module '@clerk/nextjs/server'" au runtime. En le déclarant
  // ici, Next.js le traite comme une dépendance externe classique (require normal) au lieu
  // d'essayer de le tracer/bundler, et copie tout le paquet tel quel dans le build standalone.
  serverExternalPackages: ["@clerk/nextjs", "@clerk/backend"],
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
