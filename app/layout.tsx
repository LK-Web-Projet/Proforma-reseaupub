import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image"
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
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
  const { userId } = await auth();
  return (
    <ClerkProvider
      afterSignOutUrl="/sign-in"
    >
      <html lang="fr">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50`}
        >
            {userId ? (
              <div className="absolute top-0 right-0 w-content h-auto  shadow-md flex items-center justify-between px-4 bg-transparent rounded-b-md">
                <Image
                  src="/RESEAUPUB LOGO MIX COLOR@300xcoupé.png"
                  alt="Logo"
                  width={100}
                  height={100}
                />
              </div>
            ) : (
              <h1 className="absolute top-0 right-0"></h1>
            )}

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
