import { NextResponse } from "next/server";
import { Prisma, StatutDemandeBudget, StatutDepassement, StatutLigneBudget } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requireAnyPage, requirePermission } from "@/lib/authz";
import { departementSchema } from "@/lib/departementSchema";
import { bornesMois, nomPrestataire, reponseDoublonDepartement } from "@/lib/departementsServeur";
import { montantAccordeLigne } from "@/lib/budgetSuivi";

const NB_MOIS_SERIE = 6;

/**
 * GET /api/departements/[id] — fiche d'un département : informations, prestataires rattachés
 * (actifs et inactifs), historique des arrivées et départs, dépenses des 6 derniers mois et lignes
 * de budget en cours.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const refus = await requireAnyPage(["fournisseurs"]);
  if (refus) return refus;
  const { id } = await params;

  try {
    const departement = await prisma.departement.findUnique({
      where: { id },
      include: {
        prestataires: {
          orderBy: { entreprise: "asc" },
          select: { id: true, entreprise: true, nom: true, prenom: true, typeFournisseur: true, actif: true, posteDepartement: true },
        },
      },
    });
    if (!departement) return NextResponse.json({ error: "Département introuvable." }, { status: 404 });

    const historique = await prisma.fournisseurDepartementHistorique.findMany({
      where: { OR: [{ ancienDepartementId: id }, { nouveauDepartementId: id }] },
      orderBy: [{ dateEffet: "desc" }, { createdAt: "desc" }],
      take: 100,
      include: {
        fournisseur: { select: { id: true, entreprise: true, nom: true, prenom: true } },
        ancienDepartement: { select: { nom: true } },
        nouveauDepartement: { select: { nom: true } },
      },
    });

    // Dépenses réelles (non annulées) des 6 derniers mois, par mois de la dépense.
    const maintenant = new Date();
    const series = [];
    for (let i = NB_MOIS_SERIE - 1; i >= 0; i--) {
      const { debut, fin } = bornesMois(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - i);
      const somme = await prisma.budgetDepense.aggregate({
        where: { annuleeAt: null, dateDepense: { gte: debut, lt: fin }, ligne: { departementId: id } },
        _sum: { montant: true },
        _count: true,
      });
      series.push({
        mois: `${debut.getUTCFullYear()}-${String(debut.getUTCMonth() + 1).padStart(2, "0")}`,
        depense: Number(somme._sum.montant ?? 0),
        nbDepenses: somme._count,
      });
    }

    // Lignes accordées des budgets encore ouverts : plafond, consommé, reste.
    const lignes = await prisma.demandeBudgetLigne.findMany({
      where: {
        departementId: id,
        statutValidation: StatutLigneBudget.ACCORDEE,
        demandeBudget: {
          clotureeAt: null,
          statut: { in: [StatutDemandeBudget.VALIDEE, StatutDemandeBudget.VALIDATION_PARTIELLE, StatutDemandeBudget.EN_COURS] },
        },
      },
      include: {
        demandeBudget: { select: { id: true, numero: true, type: true } },
        depenses: { where: { annuleeAt: null }, select: { montant: true } },
        depassements: { where: { statut: StatutDepassement.APPROUVE }, select: { montant: true } },
      },
      orderBy: { demandeBudget: { createdAt: "desc" } },
      take: 200,
    });
    const lignesEnCours = lignes.map((l) => {
      const plafond = montantAccordeLigne(l) + l.depassements.reduce((s, d) => s + Number(d.montant), 0);
      const consomme = l.depenses.reduce((s, d) => s + Number(d.montant), 0);
      return {
        id: l.id,
        designation: l.designation,
        budget: l.demandeBudget,
        plafond,
        consomme,
        reste: Math.max(plafond - consomme, 0),
      };
    });

    const { enveloppeMensuelle, prestataires, ...infos } = departement;
    return NextResponse.json({
      ...infos,
      enveloppeMensuelle: enveloppeMensuelle === null ? null : Number(enveloppeMensuelle),
      prestataires: prestataires.map((p) => ({ ...p, nomAffiche: nomPrestataire(p) })),
      historique: historique.map((h) => ({
        id: h.id,
        dateEffet: h.dateEffet,
        motif: h.motif,
        auteurNom: h.auteurNom ?? h.auteurEmail,
        prestataire: { id: h.fournisseur.id, nom: nomPrestataire(h.fournisseur) },
        sens: h.nouveauDepartementId === id ? (h.ancienDepartementId === id ? "POSTE" : "ARRIVEE") : "DEPART",
        ancienDepartement: h.ancienDepartement?.nom ?? null,
        nouveauDepartement: h.nouveauDepartement?.nom ?? null,
        ancienPoste: h.ancienPoste,
        nouveauPoste: h.nouveauPoste,
      })),
      depensesParMois: series,
      lignesEnCours,
    });
  } catch (error) {
    console.error(`Erreur lors de la lecture du département ${id} :`, error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

/** PUT /api/departements/[id] — modifier les informations d'un département. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const droits = await requirePermission("fournisseurs.departementModifier");
  if (droits instanceof NextResponse) return droits;
  const { id } = await params;

  try {
    const validation = departementSchema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
    }
    const { enveloppeMensuelle, ...data } = validation.data;
    const departement = await prisma.departement.update({
      where: { id },
      data: { ...data, enveloppeMensuelle: enveloppeMensuelle === null ? null : new Prisma.Decimal(enveloppeMensuelle) },
    });
    return NextResponse.json(departement);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Département introuvable." }, { status: 404 });
    }
    const doublon = reponseDoublonDepartement(error);
    if (doublon) return doublon;
    console.error(`Erreur lors de la modification du département ${id} :`, error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/departements/[id] — activer ou désactiver. Un département ne se supprime pas : désactivé,
 * il n'est plus proposé sur les nouvelles lignes de budget ni pour rattacher un prestataire, mais il
 * reste sur les lignes et l'historique existants.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const droits = await requirePermission("fournisseurs.departementActiver");
  if (droits instanceof NextResponse) return droits;
  const { id } = await params;

  const validation = z.object({ actif: z.boolean() }).safeParse(await request.json().catch(() => null));
  if (!validation.success) return NextResponse.json({ error: "Le champ actif (oui/non) est requis." }, { status: 400 });

  try {
    const departement = await prisma.departement.update({ where: { id }, data: { actif: validation.data.actif } });
    return NextResponse.json(departement);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Département introuvable." }, { status: 404 });
    }
    console.error(`Erreur lors du changement de statut du département ${id} :`, error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

/** DELETE — un département ne se supprime pas (lignes de budget et historique y renvoient). */
export async function DELETE() {
  return NextResponse.json(
    { error: "Un département ne se supprime pas : désactivez-le. Ses lignes de budget et son historique restent consultables." },
    { status: 405, headers: { Allow: "GET, PUT, PATCH" } }
  );
}
