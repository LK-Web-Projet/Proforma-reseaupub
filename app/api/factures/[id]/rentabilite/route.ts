import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getDroits } from "@/lib/authz";
import { refusHorsPortee } from "@/lib/proformaPortee";
import { getBudgetTotaux } from "@/lib/budgetSuivi";

/**
 * GET /api/factures/[id]/rentabilite — rentabilité d'une campagne, à partir de sa proforma :
 * - chiffre d'affaires (HT et TTC) et encaissé ;
 * - budget accordé (lignes accordées + dépassements approuvés des budgets liés, hors rejetés) ;
 * - dépensé : total des dépenses de la proforma (net des annulations), dont par le budget, hors
 *   budget, et reçu de CampTrack en attente de rattachement ;
 * - marges prévue (CA HT − budget accordé) et réelle (CA HT − dépensé).
 * Contrôle de cohérence : la part « budget » vue côté proforma (Paiement) doit égaler la somme des
 * dépenses de budget imputées à la proforma (BudgetDepense) — une seule écriture de caisse chacune.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const droits = await getDroits();
  if (droits instanceof NextResponse) return droits;
  if (!droits.pages.includes("proforma")) {
    return NextResponse.json({ error: "Accès refusé pour cette section." }, { status: 403 });
  }
  const { id } = await params;
  const horsPortee = await refusHorsPortee(droits, id);
  if (horsPortee) return horsPortee;

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: {
        totalHT: true,
        totalTTC: true,
        isDiscountEnabled: true,
        discountAmount: true,
        paiements: {
          select: {
            type: true,
            montant: true,
            aRattacherBudget: true,
            cashJournalEntry: { select: { budgetDepense: { select: { annuleeAt: true } } } },
          },
        },
        demandesBudget: { select: { demandeBudget: { select: { id: true, numero: true, statut: true } } } },
      },
    });
    if (!invoice) return NextResponse.json({ error: "Proforma introuvable." }, { status: 404 });

    const encaisse = invoice.paiements.filter((p) => p.type === "PAIEMENT").reduce((s, p) => s + Number(p.montant), 0);
    const depenses = invoice.paiements.filter((p) => p.type === "DEPENSE");
    const depense = depenses.reduce((s, p) => s + Number(p.montant), 0);
    const aRattacher = depenses.filter((p) => p.aRattacherBudget).reduce((s, p) => s + Number(p.montant), 0);
    const parBudgetCoteProforma = depenses
      .filter((p) => p.cashJournalEntry?.budgetDepense && !p.cashJournalEntry.budgetDepense.annuleeAt)
      .reduce((s, p) => s + Number(p.montant), 0);

    const budgets = invoice.demandesBudget.map((d) => d.demandeBudget).filter((b) => b.statut !== "REJETEE");
    let budgetAccorde = 0;
    for (const b of budgets) budgetAccorde += (await getBudgetTotaux(prisma, b.id)).plafond;
    const parBudget = Number(
      (await prisma.budgetDepense.aggregate({ where: { invoiceId: id, annuleeAt: null }, _sum: { montant: true } }))._sum.montant ?? 0
    );

    // Chiffre d'affaires HT après remise (totalHT est enregistré avant remise).
    const caHT = Number(invoice.totalHT) - (invoice.isDiscountEnabled ? Number(invoice.discountAmount) : 0);
    const horsBudget = depense - parBudget - aRattacher;
    return NextResponse.json({
      caHT,
      caTTC: Number(invoice.totalTTC),
      encaisse,
      aBudget: budgets.length > 0,
      budgets: budgets.map((b) => ({ id: b.id, numero: b.numero, statut: b.statut })),
      budgetAccorde,
      depense,
      parBudget,
      horsBudget,
      aRattacher,
      resteBudget: budgetAccorde - parBudget,
      margePrevue: budgets.length > 0 ? caHT - budgetAccorde : null,
      margeReelle: caHT - depense,
      tauxMargeReelle: caHT > 0 ? ((caHT - depense) / caHT) * 100 : null,
      coherent: Math.abs(parBudget - parBudgetCoteProforma) < 0.01,
    });
  } catch (error) {
    console.error(`Erreur lors du calcul de la rentabilité de la proforma ${id}:`, error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
