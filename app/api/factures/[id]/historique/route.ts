import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getDroits, reponseMigrationManquante } from "@/lib/authz";
import { proformaDansPortee } from "@/lib/proformaPortee";

/** GET /api/factures/[id]/historique — toutes les actions sur la proforma, de la plus récente à la plus ancienne. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const droits = await getDroits();
  if (droits instanceof NextResponse) return droits;
  if (!droits.pages.includes("proforma")) return NextResponse.json({ error: "La page Proforma n'est pas ouverte à votre rôle." }, { status: 403 });
  const { id } = await params;
  if (!(await proformaDansPortee(prisma, droits, id))) {
    return NextResponse.json({ error: "Cette proforma n'est pas dans votre portée (vous ne voyez que les vôtres)." }, { status: 403 });
  }
  try {
    const historique = await prisma.invoiceHistorique.findMany({
      where: { invoiceId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 500,
    });
    return NextResponse.json(historique);
  } catch (error) {
    const migration = reponseMigrationManquante(error);
    if (migration) return migration;
    console.error("Erreur lors de la lecture de l'historique de la proforma :", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
