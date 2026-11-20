import { NextResponse } from "next/server";
import { getDroits } from "@/lib/authz";

// GET /api/me/droits — droits de l'utilisateur connecté, pour masquer les boutons à l'écran
// (components/DroitsProvider.tsx). La sécurité reste vérifiée par chaque route (requirePermission).
export async function GET() {
  const droits = await getDroits();
  if (droits instanceof NextResponse) return droits;
  const { pages, permissions, flags } = droits;
  return NextResponse.json({ pages, permissions, flags });
}
