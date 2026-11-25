// Page: app/(main)/layout.tsx
import type { Metadata } from "next";


export const metadata: Metadata = {
  title: "Facturation Proforma",
  description:
    "Système de facturation proforma avec Next.js, Prisma, Shadcn UI",
};


import { SidebarProvider } from "../../components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { PositionedSidebarTrigger } from "@/components/positioned-sidebar-trigger";
import { DroitsProvider } from "@/components/DroitsProvider";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <DroitsProvider>
    <SidebarProvider>
      <AppSidebar />
      <PositionedSidebarTrigger />
      {/* min-w-0 : la zone de contenu peut rétrécir à côté du menu (sinon un tableau large fait défiler
          toute la page) ; pas de w-full, qui s'ajoutait à la marge gauche et faisait déborder la page. */}
      <main className="min-w-0 h-full flex-1 p-8 md:p-4 lg:p-4 lg:ml-6">
        {children}
      </main>
      <Toaster />
    </SidebarProvider>
    </DroitsProvider>
  );
}
