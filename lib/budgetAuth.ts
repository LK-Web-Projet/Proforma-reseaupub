import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

function parseEmailList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function getCurrentUserIdentity(): Promise<{ email: string | null; name: string | null }> {
  const user = await currentUser();
  if (!user) return { email: null, name: null };
  const email = user.emailAddresses[0]?.emailAddress ?? null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || null;
  return { email, name };
}

export function isBudgetAdminEmail(email: string | null): boolean {
  if (!email) return false;
  return parseEmailList(process.env.BUDGET_ADMIN_EMAILS).includes(email.toLowerCase());
}

export function isBudgetComptableEmail(email: string | null): boolean {
  if (!email) return false;
  return parseEmailList(process.env.BUDGET_COMPTABLE_EMAILS).includes(email.toLowerCase());
}

/** Vérifie que l'utilisateur connecté a le droit de valider/rejeter une demande de budget. */
export async function requireBudgetAdmin(): Promise<{ email: string; name: string | null } | NextResponse> {
  const { email, name } = await getCurrentUserIdentity();
  if (!email) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  if (!isBudgetAdminEmail(email)) {
    return NextResponse.json({ error: "Réservé aux administrateurs habilités à valider les demandes." }, { status: 403 });
  }
  return { email, name };
}

/** Vérifie que l'utilisateur connecté a le droit de traiter/payer une demande de budget validée. */
export async function requireBudgetComptable(): Promise<{ email: string; name: string | null } | NextResponse> {
  const { email, name } = await getCurrentUserIdentity();
  if (!email) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  if (!isBudgetComptableEmail(email)) {
    return NextResponse.json({ error: "Réservé au comptable habilité à traiter les paiements." }, { status: 403 });
  }
  return { email, name };
}
