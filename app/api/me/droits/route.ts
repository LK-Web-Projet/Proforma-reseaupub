import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDroits, syncUserMetadata, type AppPublicMetadata } from "@/lib/authz";

// GET /api/me/droits — droits de l'utilisateur connecté, pour masquer les boutons à l'écran
// (components/DroitsProvider.tsx). La sécurité reste vérifiée par chaque route (requirePermission).
export async function GET() {
  const droits = await getDroits();
  if (droits instanceof NextResponse) return droits;
  const { pages, permissions, flags } = droits;
  // Pages du compte de connexion en retard sur la base (ex. page « Budget » ajoutée par une mise à
  // jour de la base) : on les resynchronise, sinon le contrôle des pages bloquerait l'accès.
  try {
    const { sessionClaims } = await auth();
    const pagesConnexion = (sessionClaims?.metadata as AppPublicMetadata | undefined)?.pages;
    const cle = (p: readonly string[]) => [...p].sort().join(",");
    if (Array.isArray(pagesConnexion) && cle(pagesConnexion) !== cle(pages)) await syncUserMetadata(droits.userId);
  } catch (error) {
    console.error("Resynchronisation des pages du compte impossible :", error);
  }
  return NextResponse.json({ pages, permissions, flags });
}
