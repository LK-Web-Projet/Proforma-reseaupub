import { NextResponse } from "next/server";
import { getCurrentUserIdentity, isBudgetAdminEmail, isBudgetComptableEmail } from "@/lib/budgetAuth";

export async function GET() {
  const { email } = await getCurrentUserIdentity();
  return NextResponse.json({
    isAdmin: isBudgetAdminEmail(email),
    isComptable: isBudgetComptableEmail(email),
  });
}
