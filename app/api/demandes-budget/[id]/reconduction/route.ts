import { NextResponse } from "next/server";
import { StatutDepassement } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireBudgetUser, isImpliqueBudget, isSameEmail } from "@/lib/budgetAuth";

/**
 * GET /api/demandes-budget/[id]/reconduction — données pour préremplir une NOUVELLE demande à
 * partir de celle-ci (« Reconduire pour le mois suivant » / « Dupliquer ») : mêmes lignes,
 * catégories et informations, avec pour chaque ligne le montant réellement dépensé et le
 * plafond final, afin d'ajuster le prévu en connaissance de cause. Rien n'est créé ici :
 * la nouvelle demande suit le circuit normal (soumission → validation).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;

  const { id } = await params;

  try {
    const source = await prisma.demandeBudget.findUnique({
      where: { id },
      include: {
        lignes: { orderBy: { designation: "asc" } },
        proformas: { select: { invoiceId: true } },
        depenses: { where: { annuleeAt: null }, select: { ligneId: true, montant: true } },
        depassements: { where: { statut: StatutDepassement.APPROUVE }, select: { ligneId: true, montant: true } },
      },
    });
    if (!source) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }
    if (!isImpliqueBudget(caps) && !isSameEmail(source.requesterEmail, caps.email)) {
      return NextResponse.json({ error: "Accès refusé à cette demande." }, { status: 403 });
    }

    // Budget mensuel : mois suivant celui de la source (ou le mois courant s'il est déjà passé).
    let periodeMois: string | null = null;
    if (source.type === "MENSUEL" && source.periodeMois) {
      const suivant = new Date(Date.UTC(source.periodeMois.getUTCFullYear(), source.periodeMois.getUTCMonth() + 1, 1));
      const now = new Date();
      const courant = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
      const cible = suivant < courant ? courant : suivant;
      periodeMois = `${cible.getUTCFullYear()}-${String(cible.getUTCMonth() + 1).padStart(2, "0")}`;
    }

    return NextResponse.json({
      sourceNumero: source.numero,
      type: source.type,
      periodeMois,
      departement: source.departement,
      contexteMotivation: source.contexteMotivation,
      modePaiement: source.modePaiement,
      typeDepense: source.typeDepense,
      pourLeCompteDe: source.pourLeCompteDe,
      bonCommandeId: null,
      // Les proformas d'une campagne sont propres à cette campagne : non reprises.
      proformaIds: source.type === "MENSUEL" || source.type === "CAMPAGNE" ? [] : source.proformas.map((p) => p.invoiceId),
      lignes: source.lignes.map((l) => {
        const realise = source.depenses.filter((d) => d.ligneId === l.id).reduce((s, d) => s + Number(d.montant), 0);
        const depassement = source.depassements.filter((d) => d.ligneId === l.id).reduce((s, d) => s + Number(d.montant), 0);
        return {
          designation: l.designation,
          montant: Number(l.montant),
          categorie: l.categorie,
          precedent: { prevu: Number(l.montant), plafond: Number(l.montant) + depassement, realise },
        };
      }),
    });
  } catch (error) {
    console.error(`Erreur lors de la préparation de la reconduction de ${id}:`, error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
