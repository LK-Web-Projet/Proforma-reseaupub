"use client";

import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function PositionedSidebarTrigger() {
  const { state, isMobile } = useSidebar();

  // On mobile, the sidebar is a sheet/overlay, so the button can stay fixed at top-left.
  if (isMobile) {
    return <SidebarTrigger className="fixed top-4 left-4 z-20" />;
  }

  return (
    <SidebarTrigger
      className={cn(
        "fixed top-4 z-20 transition-all duration-300 ease-in-out",
        "transform -translate-x-1/2", // Center the button on the edge
        state === "expanded"
          ? "left-[calc(var(--sidebar-width)-20px)]"
          : "left-[calc(var(--sidebar-width-icon)-20px)]"
      )}
    />
  );
}
