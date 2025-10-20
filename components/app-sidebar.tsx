"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Calendar,
  Home,
  Plus,
  UserPlus,
  UserRoundPlus,
  BarChart,
  ChevronRight,
  FileText,
  Users,
  Briefcase,
  Landmark,
  Wallet,
  FileDown,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";

// Menu facture.
const facture = [
  {
    title: "Home",
    url: "/facture",
    icon: Home,
  },
  {
    title: "Nouvelle Facture",
    url: "/facture/new",
    icon: Plus,
  },
  {
    title: "Statistiques",
    url: "/statistiques",
    icon: BarChart,
  },
];

// Menu client.
const client = [
  {
    title: "Clients",
    url: "/client",
    icon: Calendar,
  },
  {
    title: "Nouveau Client",
    url: "/client/new",
    icon: UserPlus,
  },
];
const Commercial = [
  {
    title: "Commerciale",
    url: "/gestionnaire",
    icon: Calendar,
  },
  {
    title: "Nouveau Commercial",
    url: "/gestionnaire/new",
    icon: UserRoundPlus,
  },
];

const fournisseur = [
  {
    title: "Liste Fournisseurs",
    url: "/fournisseur",
    icon: Users,
  },
  {
    title: "Liste Factures",
    url: "/fournisseur/factures",
    icon: FileText,
  },
  {
    title: "Ajouter Facture",
    url: "/fournisseur/factures/new",
    icon: Plus,
  },
];

const finance = [
  {
    title: "Journal de Caisse",
    url: "/journal-caisse",
    icon: Wallet,
  },
  {
    title: "Export journal de Caisse",
    url: "/journal-caisse/export",
    icon: FileDown,
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const [isFactureOpen, setIsFactureOpen] = useState(true);
  const [isClientOpen, setIsClientOpen] = useState(false);
  const [isCommercialOpen, setIsCommercialOpen] = useState(false);
  const [isFournisseurOpen, setIsFournisseurOpen] = useState(false);
  const [isFinanceOpen, setIsFinanceOpen] = useState(false);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in"); // Redirige si l'utilisateur n'est pas connecté
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || !isSignedIn) {
    return null;
  }

  return (
    <Sidebar className="w-64 bg-white border-r border-gray-200 flex flex-col justify-between p-2">
      <SidebarHeader className="flex flex-col items-start justify-between mb-4 gap-2">
        <div className="relative"></div>
        <h1 className="text-lg font-bold">Finance reseaupub</h1>
        <p className="text-sm text-gray-500">
          Gestion de factures proforma & Finance
        </p>
      </SidebarHeader>
      <SidebarContent>
        <Collapsible
          open={isFactureOpen}
          onOpenChange={setIsFactureOpen}
          defaultOpen
        >
          <CollapsibleTrigger asChild>
            <SidebarMenuButton>
              <FileText className="w-5 h-5" />
              <span className="font-bold">Proforma</span>
              <ChevronRight
                className={cn(
                  "ml-auto w-4 h-4 font-bold transition-transform",
                  isFactureOpen && "rotate-90"
                )}
              />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenu className="space-y-1 pl-2">
              {facture.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link
                      key={item.title}
                      href={item.url}
                      className={cn(
                        "block rounded px-3 py-2 hover:bg-pink-600 hover:text-pink-600",
                        pathname === item.url
                          ? "bg-gray-900 text-white"
                          : "text-gray-600"
                      )}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </CollapsibleContent>
        </Collapsible>
        <Collapsible open={isClientOpen} onOpenChange={setIsClientOpen}>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton>
              <Users className="w-5 h-5" />
              <span className="font-bold">Client</span>
              <ChevronRight
                className={cn(
                  "ml-auto w-4 h-4 transition-transform",
                  isClientOpen && "rotate-90"
                )}
              />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenu className="space-y-1 pl-2">
              {client.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link
                      key={item.title}
                      href={item.url}
                      className={cn(
                        "block rounded px-3 py-2 hover:bg-pink-600 hover:text-pink-600",
                        pathname === item.url
                          ? "bg-gray-900 text-white"
                          : "text-gray-600"
                      )}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </CollapsibleContent>
        </Collapsible>
        <Collapsible open={isFournisseurOpen} onOpenChange={setIsFournisseurOpen}>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton>
              <Building2 className="w-5 h-5" />
              <span className="font-bold">Fournisseurs</span>
              <ChevronRight
                className={cn(
                  "ml-auto w-4 h-4 transition-transform",
                  isFournisseurOpen && "rotate-90"
                )}
              />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenu className="space-y-1 pl-2">
              {fournisseur.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link
                      key={item.title}
                      href={item.url}
                      className={cn(
                        "block rounded px-3 py-2 hover:bg-pink-600 hover:text-pink-600",
                        pathname === item.url
                          ? "bg-gray-900 text-white"
                          : "text-gray-600"
                      )}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </CollapsibleContent>
        </Collapsible>
        <Collapsible open={isCommercialOpen} onOpenChange={setIsCommercialOpen}>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton>
              <Briefcase className="w-5 h-5" />
              <span className="font-bold">Commercial</span>
              <ChevronRight
                className={cn(
                  "ml-auto w-4 h-4 transition-transform",
                  isCommercialOpen && "rotate-90"
                )}
              />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenu className="space-y-1 pl-2">
              {Commercial.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link
                      key={item.title}
                      href={item.url}
                      className={cn(
                        "block rounded px-3 py-2 hover:bg-pink-600 hover:text-pink-600",
                        pathname === item.url
                          ? "bg-gray-900 text-white"
                          : "text-gray-600"
                      )}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </CollapsibleContent>
        </Collapsible>
        <Collapsible open={isFinanceOpen} onOpenChange={setIsFinanceOpen}>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton>
              <Landmark className="w-5 h-5" />
              <span className="font-bold">Finance</span>
              <ChevronRight
                className={cn(
                  "ml-auto w-4 h-4 transition-transform",
                  isFinanceOpen && "rotate-90"
                )}
              />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenu className="space-y-1 pl-2">
              {finance.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link
                      key={item.title}
                      href={item.url}
                      className={cn(
                        "block rounded px-3 py-2 hover:bg-pink-600 hover:text-pink-600",
                        pathname === item.url
                          ? "bg-gray-900 text-white"
                          : "text-gray-600"
                      )}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </CollapsibleContent>
        </Collapsible>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex facture-center gap-2 pl-4">
          <SignedIn>
            <UserButton />
          </SignedIn>
          <SignedIn>
            <div className="flex flex-col gap-1 ">
              <div className="font-semibold">{user?.username}</div>
              <div className="text-xs text-gray-400">
                {user?.emailAddresses[0].emailAddress}
              </div>
            </div>
          </SignedIn>
        </div>
        <div className="border-t border-gray-200 pt-4 text-xs text-gray-500">
          <span>
            V-Beta © 2025 Proforma. All rights reserved. By Bryan Lk - lk.corp
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}