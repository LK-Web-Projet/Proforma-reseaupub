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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <PositionedSidebarTrigger />
      <main className="w-full h-full flex-1 p-8 md:p-4 lg:p-4 lg:ml-6">
        {children}
      </main>
      <Toaster />
    </SidebarProvider>
  );
}
