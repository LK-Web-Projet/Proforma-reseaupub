"use client";
import { useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
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
    const { user, isLoaded, isSignedIn } = useUser();
    const router = useRouter();

    useEffect(() => {
      if (isLoaded && !isSignedIn) {
        router.push("/sign-in"); // Redirige si l'utilisateur n'est pas connecté
      }
    }, [isLoaded, isSignedIn]);

  return (
    <Sidebar className="p-4 ">
      <SidebarHeader>
        <div className="text-xl font-bold text-primary">Proforma</div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarNav />
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2">
          <SignedIn>
            <UserButton />
          </SignedIn>
          <SignedIn>
            <div className="flex flex-col gap-1">
              <div className="font-semibold">{user?.username}</div>
              <div className="text-xs text-gray-400">{user?.emailAddresses[0].emailAddress}</div>
            </div>
          </SignedIn>
        </div>
        <div className="text-xs text-gray-400">
          &copy; {new Date().getFullYear()} Proforma
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
