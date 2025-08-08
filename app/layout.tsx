import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image"
import "./globals.css";
import {
  ClerkProvider,
  SignInButton,
  SignedOut,
} from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

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
    <ClerkProvider>
      <html lang="fr">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 relative`}
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
            <div className="flex justify-end items-center p-4 gap-4 ">
              <SignedOut>
                <SignInButton />
              </SignedOut>
            </div>
          )}

          <div>
            <main>{children}</main>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
