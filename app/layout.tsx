import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { archiveOldInvoices } from "@/lib/archive-service";

import Providers from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Facturation Proforma",
  description:
    "Système de facturation proforma avec Next.js, Prisma, Shadcn UI",
};

// L'archivage automatique ne doit JAMAIS bloquer le rendu d'une page : ce layout racine
// s'exécute sur CHAQUE requête (force-dynamic), donc un `await` ici ajoute la latence d'une
// requête DB à chaque chargement de page pour chaque utilisateur — si la base est lente
// (déjà observé avec Supabase), ça retarde le HTML et peut faire échouer le chargement du
// script Clerk côté client (timeout). On le lance en fire-and-forget, et on le limite à une
// fois par heure par process serveur pour ne pas marteler la base à chaque requête.
let lastArchiveRun = 0;
const ARCHIVE_INTERVAL_MS = 60 * 60 * 1000; // 1 heure

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const now = Date.now();
  if (now - lastArchiveRun > ARCHIVE_INTERVAL_MS) {
    lastArchiveRun = now;
    archiveOldInvoices().catch((error) => {
      console.error("Échec de l'archivage automatique au démarrage:", error);
    });
  }

  return (
    <ClerkProvider afterSignOutUrl="/sign-in">
      <html lang="fr">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50`}
        >
          <div>
            <Providers>
              <main>{children}</main>
            </Providers>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
