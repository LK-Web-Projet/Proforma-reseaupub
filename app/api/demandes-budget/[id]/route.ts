import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBudgetUser, isImpliqueBudget, isSameEmail } from "@/lib/budgetAuth";
import { facturesPrestatairesPayables } from "@/lib/commandeFournisseurSuivi";
import { typesBudgetSigneRequis } from "@/lib/budgetSuivi";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;

  try {
    const demande = await prisma.demandeBudget.findUnique({
      where: { id },
      include: {
        lignes: {
          orderBy: { designation: "asc" },
          // Bons de commande financés par la ligne (avances / solde, liasse) — Lot C.
          include: {
            commandes: {
              where: { statut: { not: "ANNULEE" } },
              orderBy: { dateCommande: "asc" },
              select: {
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
                // Lignes de produit et imputations (payé / reste par ligne de produit).
                lignes: { select: { id: true, designation: true, prixTotal: true }, orderBy: { id: "asc" } },
                imputations: { select: { ligneCommandeId: true, montant: true, annuleeAt: true } },
              },
            },
          },
        },
        attachments: true,
        bonCommande: { include: { fournisseur: true } },
        proformas: { include: { invoice: { include: { client: true } } } },
        depenses: {
          orderBy: { dateDepense: "desc" },
          include: {
            cashRegister: { select: { id: true, name: true } },
            invoice: { select: { id: true, numero: true } },
            attachments: true,
            commande: { select: { id: true, numero: true, fournisseurId: true, documents: { select: { kind: true } }, factures: { select: { pieceJointe: true, status: true } } } },
            lotPaiement: { select: { reference: true, referenceOperateur: true, nbBeneficiaires: true, detail: true } },
          },
        },
        commentaires: { orderBy: { createdAt: "asc" } },
        depassements: { orderBy: { createdAt: "desc" } },
        historique: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!demande) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }

    // Une demande n'est consultable que par son auteur, ou par un rôle du circuit budget —
    // jamais par un autre employé qui devinerait l'URL.
    if (!isImpliqueBudget(caps) && !isSameEmail(demande.requesterEmail, caps.email)) {
      return NextResponse.json({ error: "Accès refusé à cette demande." }, { status: 403 });
    }

    // Dépenses reçues de Camptrack (ancien appel, sans ligne) sur une proforma de ce budget : à rattacher.
    const depensesARattacher = await prisma.paiement.findMany({
      where: { aRattacherBudget: true, invoiceId: { in: demande.proformas.map((p) => p.invoiceId) } },
      orderBy: { datePaiement: "asc" },
      select: { id: true, montant: true, datePaiement: true, reference: true, invoice: { select: { numero: true } }, cashJournalEntry: { select: { id: true, libelle: true, cashRegister: { select: { name: true } } } } },
    });

    // Factures de prestataires internes / externes payables sur les lignes de ce budget.
    const facturesPrestataires = await facturesPrestatairesPayables(prisma, demande.lignes.map((l) => l.id));

    // Scan du budget signé exigé pour ce type (réglage Paramètres → Rôles).
    const budgetSigneRequis = (await typesBudgetSigneRequis(prisma)).includes(demande.type);

    return NextResponse.json({ ...demande, depensesARattacher, facturesPrestataires, budgetSigneRequis });
  } catch (error) {
    console.error(`Erreur lors de la récupération de la demande ${id}:`, error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
