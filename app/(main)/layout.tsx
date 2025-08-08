import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Facturation Proforma",
  description:
    "Système de facturation proforma avec Next.js, Prisma, Shadcn UI",
};


import { SidebarProvider } from "../../components/ui/sidebar";
import { AppSidebar } from "../../components/AppSidebar";
import { Toaster } from "@/components/ui/sonner";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  
  return (  
     
          <SidebarProvider>
              <AppSidebar />
                <main>{children}</main>
          <Toaster />
        </SidebarProvider>
        
 );
}
