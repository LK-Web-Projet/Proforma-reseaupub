import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getAllowedPages, requirePermission } from "@/lib/authz";
import { departementSchema } from "@/lib/departementSchema";
import { POSTE_RESPONSABLE } from "@/lib/departements";
import { nomPrestataire, reponseDoublonDepartement } from "@/lib/departementsServeur";

/**
 * GET /api/departements — liste des départements. Ouverte à tout compte connecté : le formulaire
 * de budget en a besoin pour le département de chaque ligne. `?actifs=1` : seulement les actifs.
 */
export async function GET(request: Request) {
  const acces = await getAllowedPages();
  if (acces instanceof NextResponse) return acces;

  try {
    const actifsSeulement = new URL(request.url).searchParams.get("actifs") === "1";
    const departements = await prisma.departement.findMany({
      where: actifsSeulement ? { actif: true } : undefined,
      orderBy: { nom: "asc" },
      include: {
        prestataires: {
          where: { actif: true },
          select: { id: true, entreprise: true, nom: true, prenom: true, posteDepartement: true },
        },
        _count: { select: { lignesBudget: true } },
      },
    });

    return NextResponse.json(
      departements.map(({ prestataires, _count, enveloppeMensuelle, ...d }) => {
        const responsable = prestataires.find((p) => p.posteDepartement === POSTE_RESPONSABLE) ?? null;
        return {
          ...d,
          enveloppeMensuelle: enveloppeMensuelle === null ? null : Number(enveloppeMensuelle),
          nbPrestataires: prestataires.length,
          nbLignesBudget: _count.lignesBudget,
          responsable: responsable ? { id: responsable.id, nom: nomPrestataire(responsable) } : null,
        };
      })
    );
  } catch (error) {
    console.error("Erreur lors de la récupération des départements :", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

/** POST /api/departements — créer un département (nom en majuscules, unique). */
export async function POST(request: Request) {
  const droits = await requirePermission("fournisseurs.departementCreer");
  if (droits instanceof NextResponse) return droits;

  try {
    const validation = departementSchema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
    }
    const { enveloppeMensuelle, ...data } = validation.data;
    const departement = await prisma.departement.create({
      data: {
        ...data,
        enveloppeMensuelle: enveloppeMensuelle === null ? null : new Prisma.Decimal(enveloppeMensuelle),
        createdByEmail: droits.email,
      },
    });
    return NextResponse.json(departement, { status: 201 });
  } catch (error) {
    const doublon = reponseDoublonDepartement(error);
    if (doublon) return doublon;
    console.error("Erreur lors de la création du département :", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
