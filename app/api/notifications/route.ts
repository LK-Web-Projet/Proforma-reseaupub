import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBudgetUser } from "@/lib/budgetAuth";

// GET /api/notifications?limit=10&nonLuesSeulement=1 — notifications de l'utilisateur connecté
// (les plus récentes d'abord) et nombre de non lues (pastille de la cloche).
export async function GET(request: NextRequest) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 20, 1), 200);
  const nonLuesSeulement = searchParams.get("nonLuesSeulement") === "1";
  const email = caps.email.toLowerCase();

  try {
    const [notifications, nonLues] = await Promise.all([
      prisma.notification.findMany({
        where: { destinataireEmail: email, ...(nonLuesSeulement ? { luAt: null } : {}) },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({ where: { destinataireEmail: email, luAt: null } }),
    ]);
    return NextResponse.json({ notifications, nonLues });
  } catch (error) {
    console.error("Erreur lors de la lecture des notifications:", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
