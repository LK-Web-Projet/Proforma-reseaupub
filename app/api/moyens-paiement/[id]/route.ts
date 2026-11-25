import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { reponseMigrationManquante, requirePermission } from "@/lib/authz";
import { moyenPaiementSchema } from "@/lib/moyensPaiement";
import { erreurCaisses, reponseDoublonMoyen } from "@/lib/moyensPaiementServeur";

/**
 * PUT /api/moyens-paiement/[id] — modifier un moyen : nom, description, ordre et caisses liées
 * (la liste envoyée remplace l'ancienne). Le code ne change jamais.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const droits = await requirePermission("finance.moyenModifier");
  if (droits instanceof NextResponse) return droits;
  const { id } = await params;

  try {
    const validation = moyenPaiementSchema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
    }
    const { caisseIds, ...data } = validation.data;
    const resultat = await prisma.$transaction(async (tx) => {
      const existant = await tx.moyenPaiement.findUnique({ where: { id }, select: { id: true } });
      if (!existant) return { erreur: "Moyen de paiement introuvable.", status: 404 };
      const erreur = await erreurCaisses(tx, caisseIds);
      if (erreur) return { erreur, status: 400 };
      await tx.moyenPaiementCaisse.deleteMany({ where: { moyenPaiementId: id, cashRegisterId: { notIn: caisseIds } } });
      if (caisseIds.length > 0) {
        await tx.moyenPaiementCaisse.createMany({
          data: caisseIds.map((cashRegisterId) => ({ moyenPaiementId: id, cashRegisterId })),
          skipDuplicates: true,
        });
      }
      return { moyen: await tx.moyenPaiement.update({ where: { id }, data }) };
    });
    if ("erreur" in resultat) return NextResponse.json({ error: resultat.erreur }, { status: resultat.status });
    return NextResponse.json(resultat.moyen);
  } catch (error) {
    const doublon = reponseDoublonMoyen(error);
    if (doublon) return doublon;
    const migration = reponseMigrationManquante(error);
    if (migration) return migration;
    console.error("Erreur lors de la modification du moyen de paiement :", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

const actifSchema = z.object({ actif: z.boolean() });

/** PATCH /api/moyens-paiement/[id] — activer ou désactiver un moyen. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const droits = await requirePermission("finance.moyenActiver");
  if (droits instanceof NextResponse) return droits;
  const { id } = await params;

  try {
    const validation = actifSchema.safeParse(await request.json());
    if (!validation.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    const existant = await prisma.moyenPaiement.findUnique({ where: { id }, select: { id: true } });
    if (!existant) return NextResponse.json({ error: "Moyen de paiement introuvable." }, { status: 404 });
    const moyen = await prisma.moyenPaiement.update({ where: { id }, data: { actif: validation.data.actif } });
    return NextResponse.json(moyen);
  } catch (error) {
    const migration = reponseMigrationManquante(error);
    if (migration) return migration;
    console.error("Erreur lors du changement d'état du moyen de paiement :", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

/** Un moyen de paiement ne se supprime pas (il reste sur les anciennes opérations) : on le désactive. */
export async function DELETE() {
  return NextResponse.json(
    { error: "Un moyen de paiement ne se supprime pas : désactivez-le (il reste affiché sur les anciennes opérations)." },
    { status: 405 }
  );
}
