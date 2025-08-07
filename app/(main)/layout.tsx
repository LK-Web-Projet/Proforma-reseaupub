import type { Metadata } from "next";

import { ClerkProvider } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Facturation Proforma",
  description:
    "Système de facturation proforma avec Next.js, Prisma, Shadcn UI",
};
import { SidebarProvider } from "../../components/ui/sidebar";
import { AppSidebar } from "../../components/AppSidebar";
import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
        <main  className="bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
          <SidebarProvider>
            <div className="flex min-h-screen">
              <AppSidebar />
              <div className="flex flex-1 flex-col">
                <main className="flex-1 p-8">{children}</main>
              </div>
            </div>
        </SidebarProvider>
          <Toaster />
        
        </main>
    </ClerkProvider>
  );
}
