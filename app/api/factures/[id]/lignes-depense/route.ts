import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBudgetUser } from "@/lib/budgetAuth";
import { getLigneDisponible } from "@/lib/budgetSuivi";
import { facturesPrestatairesPayables } from "@/lib/commandeFournisseurSuivi";

const STATUTS_DEPENSABLES = ["VALIDEE", "EN_COURS", "VALIDATION_PARTIELLE"];

const commandeSelect = {
  id: true,
  numero: true,
  statut: true,
  montantNet: true,
  totalHT: true,
  fournisseurId: true,
  fournisseur: { select: { entreprise: true } },
  documents: { select: { kind: true } },
  factures: { select: { id: true, reference: true, montant: true, status: true, pieceJointe: true } },
  depenses: { select: { montant: true, annuleeAt: true, nature: true } },
  lignes: { select: { id: true, designation: true, prixTotal: true }, orderBy: { id: "asc" as const } },
  imputations: { select: { ligneCommandeId: true, montant: true, annuleeAt: true } },
};

/**
 * GET /api/factures/[id]/lignes-depense — de quoi saisir une dépense depuis la fiche proforma :
 * - `aBudget` : la campagne a un budget → la dépense DOIT porter sur une de ses lignes accordées
 *   (budgets ouverts, avec le reste de chaque ligne et les bons de commande qu'elle finance) ;
 * - sinon (campagne sans budget) : les bons de commande liés à la proforma et rattachés à aucune
 *   ligne de budget, payables directement depuis la proforma.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;
  const { id } = await params;

  try {
    const budgets = await prisma.demandeBudget.findMany({
      where: { proformas: { some: { invoiceId: id } } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        numero: true,
        statut: true,
        modePaiement: true,
        lignes: {
          where: { statutValidation: "ACCORDEE" },
          orderBy: { designation: "asc" },
          include: { commandes: { where: { statut: { not: "ANNULEE" } }, select: commandeSelect } },
        },
      },
    });

    const budgetsAvecReste = [];
    for (const b of budgets) {
      const depensable = STATUTS_DEPENSABLES.includes(b.statut);
      const lignes = [];
      if (depensable) {
        for (const l of b.lignes) {
          const d = await getLigneDisponible(prisma, l);
          lignes.push({ id: l.id, designation: l.designation, modePaiement: l.modePaiement, reste: Math.max(d.reste, 0), commandes: l.commandes });
        }
      }
      budgetsAvecReste.push({ id: b.id, numero: b.numero, statut: b.statut, modePaiement: b.modePaiement, depensable, lignes });
    }

    const commandesSansBudget = budgets.length
      ? []
      : await prisma.commandeFournisseur.findMany({
          where: { ligneBudgetId: null, statut: { in: ["VALIDEE", "LIVREE"] }, proformas: { some: { invoiceId: id } } },
          select: commandeSelect,
          orderBy: { dateCommande: "asc" },
        });

    const facturesPrestataires = budgets.length
      ? await facturesPrestatairesPayables(prisma, budgetsAvecReste.flatMap((b) => b.lignes.map((l) => l.id)))
      : [];

    return NextResponse.json({ aBudget: budgets.length > 0, budgets: budgetsAvecReste, commandesSansBudget, facturesPrestataires });
  } catch (error) {
    console.error(`Erreur lors du chargement des lignes de dépense de la proforma ${id}:`, error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
