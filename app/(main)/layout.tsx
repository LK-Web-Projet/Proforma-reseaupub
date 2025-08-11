import type { Metadata } from "next";


export const metadata: Metadata = {
  title: "Facturation Proforma",
  description:
    "Système de facturation proforma avec Next.js, Prisma, Shadcn UI",
};


import { SidebarProvider, SidebarTrigger } from "../../components/ui/sidebar";
import { AppSidebar,  } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarTrigger />
      <main className="w-full h-full flex-1 p-4">
        {children}
      </main>
      <Toaster />
    </SidebarProvider>
  );
}
