"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { HomeIcon, FilePlusIcon, UsersIcon, UserCogIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function SidebarNav() {
  const pathname = usePathname()

  const isActive = (path: string) => {
    return pathname === path
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={isActive("/")}
          tooltip="Liste des factures"
        >
          <Link href="/">
            <HomeIcon />
            <span>Liste des factures</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={isActive("/facture/new")}
          tooltip="Nouvelle facture"
        >
          <Link href="/facture/new">
            <FilePlusIcon />
            <span>Nouvelle facture</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isActive("/client")} tooltip="Clients">
          <Link href="/client">
            <UsersIcon />
            <span>Clients</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={isActive("/gestionnaire")}
          tooltip="Gestionnaires"
        >
          <Link href="/gestionnaire">
            <UserCogIcon />
            <span>Gestionnaires</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
