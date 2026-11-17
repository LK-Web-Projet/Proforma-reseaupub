import { NextRequest, NextResponse } from "next/server";
import { Prisma, StatutDemandeBudget, StatutDepassement, StatutLigneBudget, TypeBudget } from "@prisma/client";
import { montantAccordeLigne } from "@/lib/budgetSuivi";
import prisma from "@/lib/prisma";
import { requireBudgetUser, isImpliqueBudget } from "@/lib/budgetAuth";
import { toPeriodeMois } from "@/lib/budgetSchema";

export interface SuiviBudgetaireLigne {
  mois: string; // "yyyy-MM" — mois du budget (periodeMois pour un mensuel, sinon mois de validation)
  demandeId: string;
  numero: string;
  type: TypeBudget;
  statut: StatutDemandeBudget;
  departement: string;
  designation: string;
  categorie: string | null;
  modePaiement: string; // moyen de paiement prévu sur la ligne (celui de la demande à défaut)
  demande: number; // montant demandé
  prevu: number; // montant accordé (= prévu du budget)
  depassements: number; // dépassements approuvés
  plafond: number; // prévu + dépassements
  realise: number; // dépenses non annulées (ou montant total pour l'ancien circuit)
  ancienCircuit: boolean; // payée avant le suivi par dépenses : réalisé = prévu, non rattaché à la caisse
}

const moisCle = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/**
 * GET /api/rapports/suivi-budgetaire?from=yyyy-MM&to=yyyy-MM&type=&departement=&categorie=
 * Prévu vs réalisé des budgets validés (VALIDEE, EN_COURS, PAYEE), ligne par ligne. Les
 * regroupements (par mois, service, catégorie) sont faits côté page. Réservé aux rôles du
 * circuit budget (données financières internes).
 */
export async function GET(request: NextRequest) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;
  if (!isImpliqueBudget(caps)) {
    return NextResponse.json({ error: "Rapport réservé aux rôles du circuit budget." }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const fromParam = toPeriodeMois(searchParams.get("from") ?? undefined);
    const toParam = toPeriodeMois(searchParams.get("to") ?? undefined);
    const debut = fromParam
      ? new Date(Date.UTC(fromParam.getUTCFullYear(), fromParam.getUTCMonth(), 1))
      : new Date(Date.UTC(now.getFullYear(), now.getMonth() - 5, 1));
    const finRef = toParam ?? new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const fin = new Date(Date.UTC(finRef.getUTCFullYear(), finRef.getUTCMonth() + 1, 1)); // exclusif

    const type = searchParams.get("type");
    const departement = searchParams.get("departement");
    const categorie = searchParams.get("categorie");

    const periode = { gte: debut, lt: fin };
    const where: Prisma.DemandeBudgetWhereInput = {
      statut: { in: [StatutDemandeBudget.VALIDEE, StatutDemandeBudget.VALIDATION_PARTIELLE, StatutDemandeBudget.EN_COURS, StatutDemandeBudget.PAYEE] },
      // Mois de rattachement : periodeMois (mensuel), sinon date de validation, sinon de création.
      OR: [
        { periodeMois: periode },
        { periodeMois: null, validatedAt: periode },
        { periodeMois: null, validatedAt: null, createdAt: periode },
      ],
    };
    if (type && Object.values(TypeBudget).includes(type as TypeBudget)) where.type = type as TypeBudget;
    if (departement) where.departement = departement === "__aucun__" ? null : departement;

    const demandes = await prisma.demandeBudget.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: {
        lignes: true,
        depenses: { where: { annuleeAt: null }, select: { ligneId: true, montant: true } },
        depassements: { where: { statut: StatutDepassement.APPROUVE }, select: { ligneId: true, montant: true } },
      },
    });

    const lignes: SuiviBudgetaireLigne[] = [];
    for (const d of demandes) {
      const mois = moisCle(d.periodeMois ?? d.validatedAt ?? d.createdAt);
      const ancienCircuit = d.statut === StatutDemandeBudget.PAYEE && d.depenses.length === 0 && !d.clotureeAt;
      for (const l of d.lignes) {
        // Seules les lignes accordées font partie du budget (en attente, à corriger ou retirées : hors rapport).
        if (l.statutValidation !== StatutLigneBudget.ACCORDEE) continue;
        if (categorie && (categorie === "__aucune__" ? l.categorie !== null : l.categorie !== categorie)) continue;
        const prevu = montantAccordeLigne(l);
        const depassements = d.depassements.filter((x) => x.ligneId === l.id).reduce((s, x) => s + Number(x.montant), 0);
        const realise = ancienCircuit
          ? prevu
          : d.depenses.filter((x) => x.ligneId === l.id).reduce((s, x) => s + Number(x.montant), 0);
        lignes.push({
          mois,
          demandeId: d.id,
          numero: d.numero,
          type: d.type,
          statut: d.statut,
          departement: d.departement || "Sans service",
          designation: l.designation,
          categorie: l.categorie,
          modePaiement: l.modePaiement ?? d.modePaiement,
          demande: Number(l.montant),
          prevu,
          depassements,
          plafond: prevu + depassements,
          realise,
          ancienCircuit,
        });
      }
    }

    return NextResponse.json({ from: moisCle(debut), to: moisCle(finRef), lignes });
  } catch (error) {
    console.error("Erreur lors du rapport de suivi budgétaire:", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
