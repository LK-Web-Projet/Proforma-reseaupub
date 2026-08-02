import type { NextConfig } from "next";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  output: "standalone",
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
