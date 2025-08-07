"use client"

import {
  SignedIn,
  UserButton,
} from "@clerk/nextjs";
import { SidebarNav } from "./SidebarNav"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar"

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="text-xl font-bold text-primary">Proforma</div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarNav />
      </SidebarContent>
      <SidebarFooter>
        <SignedIn>
          <UserButton />
        </SignedIn>
        <div className="text-xs text-gray-400">
          &copy; {new Date().getFullYear()} Proforma
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
