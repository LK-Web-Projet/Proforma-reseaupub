import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import {
  CANAL_PAR_DEFAUT,
  CANAUX_NOTIFICATION,
  EVENEMENTS_NOTIFICATION,
  isEvenementNotification,
} from "@/lib/notifications/evenements";
import { viderCacheCanaux } from "@/lib/notifications/notifier";

// GET /api/notifications/preferences — canal de chaque événement (défaut : les deux).
export async function GET() {
  const droitsAcces = await requirePermission("parametres.notifications");
  if (droitsAcces instanceof NextResponse) return droitsAcces;
  const prefs = await prisma.notificationPreference.findMany();
  const parEvenement = new Map(prefs.map((p) => [p.evenement, p]));
  return NextResponse.json(
    Object.keys(EVENEMENTS_NOTIFICATION).map((evenement) => ({
      evenement,
      canal: parEvenement.get(evenement)?.canal ?? CANAL_PAR_DEFAUT,
      updatedAt: parEvenement.get(evenement)?.updatedAt ?? null,
      updatedByEmail: parEvenement.get(evenement)?.updatedByEmail ?? null,
    }))
  );
}

const schema = z.object({
  preferences: z
    .array(z.object({ evenement: z.string(), canal: z.enum(CANAUX_NOTIFICATION) }))
    .min(1),
});

// PUT /api/notifications/preferences — { preferences: [{ evenement, canal }] } (administrateurs).
export async function PUT(request: NextRequest) {
  const droitsAcces = await requirePermission("parametres.notifications");
  if (droitsAcces instanceof NextResponse) return droitsAcces;

  const validation = schema.safeParse(await request.json().catch(() => null));
  if (!validation.success) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }
  const inconnus = validation.data.preferences.filter((p) => !isEvenementNotification(p.evenement));
  if (inconnus.length > 0) {
    return NextResponse.json({ error: `Événement inconnu : ${inconnus[0].evenement}` }, { status: 400 });
  }

  const { userId } = await auth();
  const admin = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }) : null;
  await prisma.$transaction(
    validation.data.preferences.map((p) =>
      prisma.notificationPreference.upsert({
        where: { evenement: p.evenement },
        create: { evenement: p.evenement, canal: p.canal, updatedByEmail: admin?.email ?? null },
        update: { canal: p.canal, updatedByEmail: admin?.email ?? null },
      })
    )
  );
  viderCacheCanaux();
  return NextResponse.json({ success: true });
}
