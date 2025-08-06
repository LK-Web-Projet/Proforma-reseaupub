"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"

export function Header() {
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-white px-6 md:hidden">
      <SidebarTrigger />
      <div className="text-lg font-bold">Proforma</div>
    </header>
  )
}
