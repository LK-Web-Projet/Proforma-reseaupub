import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getDroits, peut, reponseMigrationManquante, requirePermission } from "@/lib/authz";
import { moyenPaiementSchema } from "@/lib/moyensPaiement";
import { codeMoyenLibre, erreurCaisses, reponseDoublonMoyen } from "@/lib/moyensPaiementServeur";

/**
 * GET /api/moyens-paiement — liste des moyens de paiement, triée par ordre d'affichage. Ouverte à
 * tout compte connecté (le formulaire de budget en a besoin). Les caisses liées ne sont renvoyées
 * qu'aux comptes qui encaissent ou paient (page Finance, encaissement de proforma, dépenses de
 * budget, saisie au journal, petites dépenses). `?actifs=1` : seulement les actifs.
 */
export async function GET(request: Request) {
  const droits = await getDroits();
  if (droits instanceof NextResponse) return droits;

  const voitCaisses =
    droits.pages.includes("finance") ||
    droits.flags.canPayBudget ||
    droits.flags.canSaisirCaisse ||
    droits.flags.canSaisirPetiteDepense ||
    peut(droits, "proforma.encaisser");

  try {
    const actifsSeulement = new URL(request.url).searchParams.get("actifs") === "1";
    const moyens = await prisma.moyenPaiement.findMany({
      where: actifsSeulement ? { actif: true } : undefined,
      orderBy: [{ ordre: "asc" }, { nom: "asc" }],
      include: {
        caisses: { select: { cashRegister: { select: { id: true, name: true, view: true } } } },
        _count: { select: { lignesBudget: true, depensesBudget: true } },
      },
    });
    return NextResponse.json(
      moyens.map(({ caisses, _count, ...m }) => ({
        ...m,
        caisses: voitCaisses ? caisses.map((c) => c.cashRegister).sort((a, b) => a.name.localeCompare(b.name, "fr")) : undefined,
        nbLignesBudget: _count.lignesBudget,
        nbDepenses: _count.depensesBudget,
      }))
    );
  } catch (error) {
    const migration = reponseMigrationManquante(error);
    if (migration) return migration;
    console.error("Erreur lors de la récupération des moyens de paiement :", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

/** POST /api/moyens-paiement — créer un moyen (code tiré du nom), avec ses caisses liées. */
export async function POST(request: Request) {
  const droits = await requirePermission("finance.moyenCreer");
  if (droits instanceof NextResponse) return droits;

  try {
    const validation = moyenPaiementSchema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
    }
    const { caisseIds, ...data } = validation.data;
    const moyen = await prisma.$transaction(async (tx) => {
      const erreur = await erreurCaisses(tx, caisseIds);
      if (erreur) return { erreur };
      const code = await codeMoyenLibre(tx, data.nom);
      return {
        moyen: await tx.moyenPaiement.create({
          data: {
            ...data,
            code,
            createdByEmail: droits.email,
            caisses: { create: caisseIds.map((cashRegisterId) => ({ cashRegisterId })) },
          },
        }),
      };
    });
    if ("erreur" in moyen) return NextResponse.json({ error: moyen.erreur }, { status: 400 });
    return NextResponse.json(moyen.moyen, { status: 201 });
  } catch (error) {
    const doublon = reponseDoublonMoyen(error);
    if (doublon) return doublon;
    const migration = reponseMigrationManquante(error);
    if (migration) return migration;
    console.error("Erreur lors de la création du moyen de paiement :", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
