import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

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

import { Toaster } from "@/components/ui/toaster";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50`}
      >
        <div className="min-h-screen flex">
          {/* Barre latérale verticale */}
          <aside className="w-60 bg-white border-r flex flex-col py-8 px-4 gap-8 shadow-sm">
            <div className="text-xl font-bold text-primary mb-8">Proforma</div>
            <nav className="flex flex-col gap-4">
              <Link
                href="/"
                className="rounded px-3 py-2 hover:bg-gray-100 font-medium text-gray-700"
              >
                Liste des factures
              </Link>
              <Link
                href="/facture/new"
                className="rounded px-3 py-2 hover:bg-gray-100 font-medium text-gray-700"
              >
                Nouvelle facture
              </Link>
            </nav>
            <div className="mt-auto text-xs text-gray-400">
              &copy; {new Date().getFullYear()} Proforma
            </div>
          </aside>
          <main className="flex-1 p-8">{children}</main>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
