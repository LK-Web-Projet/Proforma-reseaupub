import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Désactive l'utilisation de lightningcss → Next.js utilisera PostCSS/autoprefixer
    optimizeCss: false,
  },
};

export default nextConfig;
