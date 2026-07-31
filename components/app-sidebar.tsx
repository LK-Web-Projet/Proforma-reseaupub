"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import Link, { useLinkStatus } from "next/link";
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
  Settings,
  Loader2,
  type LucideIcon,
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

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
}

// Affiche l'icône du lien, remplacée par un loader pendant la navigation vers ce lien.
// useLinkStatus() ne fonctionne que dans un descendant du <Link> correspondant.
function NavLinkIcon({ icon: Icon }: { icon: LucideIcon }) {
  const { pending } = useLinkStatus();
  if (pending) {
    return <Loader2 className="w-4 h-4 shrink-0 animate-spin" />;
  }
  return <Icon className="w-4 h-4 shrink-0" />;
}

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const isActive = pathname === item.url;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <Link
          href={item.url}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
            isActive
              ? "bg-primary/10 text-primary font-medium"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          )}
        >
          <NavLinkIcon icon={item.icon} />
          <span className="truncate">{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { user, isLoaded, isSignedIn } = useUser();
  const role = user?.organizationMemberships?.[0]?.role ?? "no-role";

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
      <SidebarHeader className="mb-2 gap-1">
        <div className="flex items-center gap-2 px-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-sm">
            RP
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold truncate">Finance reseaupub</h1>
            <p className="text-xs text-gray-500 truncate">
              Proforma &amp; Finance
            </p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-1">
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
                <NavLink key={item.title} item={item} />
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
                <NavLink key={item.title} item={item} />
              ))}
            </SidebarMenu>
          </CollapsibleContent>
        </Collapsible>
        {role === "org:admin" && (
          <Collapsible
            open={isFournisseurOpen}
            onOpenChange={setIsFournisseurOpen}
          >
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
                  <NavLink key={item.title} item={item} />
                ))}
              </SidebarMenu>
            </CollapsibleContent>
          </Collapsible>
        )}
        {role === "org:admin" && (
          <Collapsible
            open={isCommercialOpen}
            onOpenChange={setIsCommercialOpen}
          >
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
                  <NavLink key={item.title} item={item} />
                ))}
              </SidebarMenu>
            </CollapsibleContent>
          </Collapsible>
        )}
        {role === "org:admin" && (
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
                  <NavLink key={item.title} item={item} />
                ))}
              </SidebarMenu>
            </CollapsibleContent>
          </Collapsible>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <NavLink item={{ title: "Paramètres", url: "/parametres", icon: Settings }} />
        </SidebarMenu>
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