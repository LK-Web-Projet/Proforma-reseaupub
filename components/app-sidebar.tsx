"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Home,
  Plus,
  Search,
  Settings,
  UserPlus,
  UserRoundPlus,
} from "lucide-react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
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
    title: "Search",
    url: "#",
    icon: Search,
  },
  {
    title: "Settings",
    url: "#",
    icon: Settings,
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

export function AppSidebar() {
  const pathname = usePathname();
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in"); // Redirige si l'utilisateur n'est pas connecté
    }
  }, [isLoaded, isSignedIn , router]);
  if (!isLoaded) {
    return null; // Affiche un chargement ou rien pendant le chargement des données utilisateur
  }
  if (!isSignedIn) {
    return null; // Ne pas afficher la sidebar si l'utilisateur n'est pas connecté
  }
  return (
    <Sidebar>
      <SidebarHeader className="flex flex-col items-start justify-between ">
        <div className="relative"></div>
        <h1 className="text-lg font-bold">Proforma</h1>
        <p className="text-sm text-gray-500">Gestion de factures proforma</p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Facture</SidebarGroupLabel>
          <SidebarGroupContent>
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
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Client</SidebarGroupLabel>
          <SidebarGroupContent>
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
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Commercial</SidebarGroupLabel>
          <SidebarGroupContent>
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
          </SidebarGroupContent>
        </SidebarGroup>
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
        <div className="p-4 text-sm text-gray-500">
          © 2023 Proforma. All rights reserved.
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
