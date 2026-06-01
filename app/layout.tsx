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

export const metadata: Metadata = {
  title: "Facturation Proforma",
  description:
    "Système de facturation proforma avec Next.js, Prisma, Shadcn UI",
};


export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Exécuter l'archivage automatique au chargement (Server Side)
  // Comme c'est un Server Component, cela s'exécute côté serveur.
  // L'archivage est idempotent, donc pas de soucis de répétition.
  try {
    await archiveOldInvoices();
  } catch (error) {
    console.error("Échec de l'archivage automatique au démarrage:", error);
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
