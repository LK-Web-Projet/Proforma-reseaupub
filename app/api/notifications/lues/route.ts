import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireBudgetUser } from "@/lib/budgetAuth";

const schema = z.object({ ids: z.array(z.string()).max(500).optional() });

// POST /api/notifications/lues — { ids } : marque ces notifications comme lues ; sans ids : toutes.
// Ne touche jamais que les notifications de l'utilisateur connecté.
export async function POST(request: NextRequest) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;

  const validation = schema.safeParse(await request.json().catch(() => ({})));
  if (!validation.success) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }
  const { ids } = validation.data;
  try {
    const res = await prisma.notification.updateMany({
      where: { destinataireEmail: caps.email.toLowerCase(), luAt: null, ...(ids ? { id: { in: ids } } : {}) },
      data: { luAt: new Date() },
    });
    return NextResponse.json({ marquees: res.count });
  } catch (error) {
    console.error("Erreur lors du marquage des notifications:", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
