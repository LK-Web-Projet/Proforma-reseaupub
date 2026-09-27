// app/page.tsx
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { resolveLandingUrl, type AppPublicMetadata } from "@/lib/permissions";

export default async function HomePage() {
  const user = await currentUser();

  if (user) {
    const pagePermissionsEnabled = process.env.ENABLE_PAGE_PERMISSIONS === "true";
    const metadata = user.publicMetadata as AppPublicMetadata | undefined;
    const target = pagePermissionsEnabled ? resolveLandingUrl(metadata?.pages) : "/facture";
    redirect(target);
  }

  // Pas connecté → redirige vers /sign-in
  redirect("/sign-in");
}
