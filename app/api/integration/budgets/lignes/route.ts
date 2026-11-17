import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyIntegrationKey } from "@/lib/integrationAuth";
import { etatDepensable, getLigneDisponible } from "@/lib/budgetSuivi";


/**
 * GET /api/integration/budgets/lignes?proformaId= — pour Camptrack : lignes de budget sur
 * lesquelles un lot de paiement de cette proforma (campagne) peut être imputé, avec leur reste.
 * `aBudget` : la proforma a au moins un budget (alors la ligne est OBLIGATOIRE pour payer) ;
 * `lignes` vide avec `aBudget` = budget pas encore validé ou clôturé → paiement impossible.
 * Authentification : `Authorization: Bearer <INTEGRATION_API_KEY>`.
 */
export async function GET(request: NextRequest) {
  const authError = verifyIntegrationKey(request);
  if (authError) return authError;
  const proformaId = new URL(request.url).searchParams.get("proformaId");
  if (!proformaId) return NextResponse.json({ error: "proformaId requis." }, { status: 400 });

  try {
    const budgets = await prisma.demandeBudget.findMany({
      where: { proformas: { some: { invoiceId: proformaId } } },
      orderBy: { createdAt: "asc" },
      select: { id: true, numero: true, type: true, statut: true, lignes: { where: { statutValidation: "ACCORDEE" }, orderBy: { designation: "asc" } } },
    });
    // Budget ouvert ET budget signé joint s'il est exigé : sinon ses lignes ne sont pas renvoyées
    // (CampTrack affiche alors « budget pas ouvert aux dépenses »).
    const ouverts = [];
    for (const b of budgets) if ((await etatDepensable(prisma, b)).depensable) ouverts.push(b);
    const lignes = [];
    for (const b of ouverts) {
      for (const l of b.lignes) {
        const d = await getLigneDisponible(prisma, l);
        lignes.push({
          id: l.id,
          budgetId: b.id,
          budgetNumero: b.numero,
          designation: l.designation,
          categorie: l.categorie,
          modePaiement: l.modePaiement,
          plafond: d.plafond,
          consomme: d.consomme,
          reste: Math.max(d.reste, 0),
        });
      }
    }
    return NextResponse.json({
      proformaId,
      aBudget: budgets.length > 0,
      budgets: budgets.map((b) => ({ id: b.id, numero: b.numero, statut: b.statut })),
      lignes,
    });
  } catch (error) {
    console.error("Erreur API intégration - lignes de budget:", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
