"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useRouter } from "next-nprogress-bar";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/lib/version";
import { usePathname } from "next/navigation";
import Link, { useLinkStatus } from "next/link";
import {
  Building2,
  Calendar,
  Home,
  Plus,
  UserRoundPlus,
  BarChart,
  ChevronRight,
  FileText,
  Users,
  Briefcase,
  Landmark,
  Wallet,
  FileDown,
  CreditCard,
  Settings,
  Loader2,
  ClipboardList,
  Package,
  PiggyBank,
  FilePlus,
  Eye,
  Search,
  BookOpen,
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
import type { AppPublicMetadata, PageKey } from "@/lib/permissions";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useDroits } from "@/components/DroitsProvider";

// Menu facture.
const dashboard = [
  {
    title: "Tableau de bors",
    url: "/dashboard",
    icon: BarChart,
  },
  {
    title: "Rapports",
    url: "/dashboard/rapports",
    icon: ClipboardList,
  },
];

const facture = [
  {
    title: "Facture proforma",
    url: "/facture",
    icon: Home,
  },
  {
    title: "Nouvelle Facture",
    url: "/facture/new",
    icon: Plus,
    droit: "proforma.creer",
  },
];

// Menu client.
const client = [
  {
    title: "Clients",
    url: "/client",
    icon: Calendar,
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
    droit: "commercial.creer",
  },
];

const fournisseur = [
  {
    title: "Liste Prestataires",
    url: "/fournisseur",
    icon: Users,
  },
  {
    title: "Liste Factures",
    url: "/fournisseur/factures",
    icon: FileText,
  },
  {
    title: "Bons de Commande",
    url: "/fournisseur/commandes",
    icon: ClipboardList,
  },
  {
    title: "Départements",
    url: "/fournisseur/departements",
    icon: Building2,
  },
];

const produitsNav = [
  {
    title: "Liste des produits",
    url: "/produits",
    icon: Package,
  },
  {
    title: "Statistiques",
    url: "/produits/statistiques",
    icon: BarChart,
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
    droit: "finance.exporter",
  },
  {
    title: "Moyens de paiement",
    url: "/journal-caisse/moyens-paiement",
    icon: CreditCard,
  },
];

// Section Budget — page cochée par rôle depuis le 2026-11-25 (Paramètres > Rôles). Avec la page,
// on fait des demandes et on voit les siennes ; la visibilité de toutes les demandes dépend des
// droits budget du rôle (voir lib/budgetAuth.ts).
const budget = [
  {
    title: "Faire une demande",
    url: "/budget/nouvelle-demande",
    icon: FilePlus,
  },
  {
    title: "Voir les demandes",
    url: "/budget/demandes",
    icon: Eye,
  },
];

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Droit d'action exigé pour afficher le lien (ex. créer). */
  droit?: string;
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
  const { peut } = useDroits();
  if (item.droit && !peut(item.droit)) return null;
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

  // Nouveau système de rôles/permissions par page (voir lib/authz.ts, lib/permissions.ts).
  // Tant qu'un compte n'a pas encore été synchronisé (metadata.pages absent — compte créé
  // avant le déploiement de ce système et script de bootstrap pas encore lancé), on reproduit
  // l'ancien comportement (sections admin visibles seulement si org:admin Clerk) pour ne rien
  // casser visuellement pendant la transition.
  const metadata = user?.publicMetadata as AppPublicMetadata | undefined;
  const hasSyncedPermissions = Array.isArray(metadata?.pages);
  const allowedPages = metadata?.pages ?? [];
  const canSeePage = (key: PageKey, legacyAdminOnly: boolean) =>
    hasSyncedPermissions ? allowedPages.includes(key) : legacyAdminOnly ? role === "org:admin" : true;

  // Budget : lu en base (droits à jour) dès qu'ils sont chargés — le metadata de connexion peut
  // ne pas encore contenir cette page, ajoutée par une mise à jour de la base.
  const { droits } = useDroits();
  const voitBudget = droits ? droits.pages.includes("budget") : canSeePage("budget", false);

  const router = useRouter();
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isFactureOpen, setIsFactureOpen] = useState(true);
  const [isClientOpen, setIsClientOpen] = useState(false);
  const [isCommercialOpen, setIsCommercialOpen] = useState(false);
  const [isFournisseurOpen, setIsFournisseurOpen] = useState(false);
  const [isProduitsOpen, setIsProduitsOpen] = useState(false);
  const [isFinanceOpen, setIsFinanceOpen] = useState(false);
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);

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
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold truncate">Finance reseaupub</h1>
            <p className="text-xs text-gray-500 truncate">
              Proforma &amp; Finance
            </p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-2">
        {/* Recherche (documents classés, résultats filtrés selon les droits), puis la cloche des
            notifications à droite, au bout de la ligne. */}
        <div className="flex items-center gap-1 pt-0.5">
          <SidebarMenu className="min-w-0 flex-1">
            <NavLink item={{ title: "Recherche", url: "/recherche", icon: Search }} />
          </SidebarMenu>
          <NotificationBell />
        </div>
        {canSeePage("dashboard", true) && (
        <Collapsible open={isDashboardOpen} onOpenChange={setIsDashboardOpen}>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton>
              <BarChart className="w-5 h-5" />
              <span className="font-bold">Dashboard</span>
              <ChevronRight
                className={cn(
                  "ml-auto w-4 h-4 transition-transform",
                  isDashboardOpen && "rotate-90"
                )}
              />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenu className="space-y-1 pl-2">
              {dashboard.map((item) => (
                <NavLink key={item.title} item={item} />
              ))}
            </SidebarMenu>
          </CollapsibleContent>
        </Collapsible>
        )}
        {canSeePage("proforma", false) && (
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
        )}
        {canSeePage("client", false) && (
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
        )}
        {canSeePage("fournisseurs", true) && (
          <Collapsible
            open={isFournisseurOpen}
            onOpenChange={setIsFournisseurOpen}
          >
            <CollapsibleTrigger asChild>
              <SidebarMenuButton>
                <Building2 className="w-5 h-5" />
                <span className="font-bold">Prestataires</span>
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
        {canSeePage("produits", true) && (
          <Collapsible
            open={isProduitsOpen}
            onOpenChange={setIsProduitsOpen}
          >
            <CollapsibleTrigger asChild>
              <SidebarMenuButton>
                <Package className="w-5 h-5" />
                <span className="font-bold">Produits</span>
                <ChevronRight
                  className={cn(
                    "ml-auto w-4 h-4 transition-transform",
                    isProduitsOpen && "rotate-90"
                  )}
                />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenu className="space-y-1 pl-2">
                {produitsNav.map((item) => (
                  <NavLink key={item.title} item={item} />
                ))}
              </SidebarMenu>
            </CollapsibleContent>
          </Collapsible>
        )}
        {canSeePage("commercial", true) && (
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
        {canSeePage("finance", true) && (
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
        {voitBudget && (
        <Collapsible open={isBudgetOpen} onOpenChange={setIsBudgetOpen}>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton>
              <PiggyBank className="w-5 h-5" />
              <span className="font-bold">Budget</span>
              <ChevronRight
                className={cn(
                  "ml-auto w-4 h-4 transition-transform",
                  isBudgetOpen && "rotate-90"
                )}
              />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenu className="space-y-1 pl-2">
              {budget.map((item) => (
                <NavLink key={item.title} item={item} />
              ))}
            </SidebarMenu>
          </CollapsibleContent>
        </Collapsible>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <NavLink item={{ title: "Aide", url: "/aide", icon: BookOpen }} />
        </SidebarMenu>
        {canSeePage("parametres", false) && (
          <SidebarMenu>
            <NavLink item={{ title: "Paramètres", url: "/parametres", icon: Settings }} />
          </SidebarMenu>
        )}
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
            V-{APP_VERSION} © {new Date().getFullYear()} Proforma. All rights reserved. By Bryan Lk - lk.corp
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}