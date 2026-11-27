import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireBudgetUser } from "@/lib/budgetAuth";
import { accesAuBudget, estResponsable, ligneVisible, refusSaisieDepartement, saisieOuverte, voitToutLeBudget } from "@/lib/budgetPortee";
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
            departement: { select: { id: true, nom: true, code: true, couleur: true } },
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
        departementsInvites: { include: { departement: { select: { id: true, nom: true, code: true, couleur: true, actif: true } } } },
      },
    });

    if (!demande) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }

    // Consultable par qui voit tout, ou (budget collectif) par les départements invités / ayant une
    // ligne visible — jamais par un autre employé qui devinerait l'URL.
    if (!accesAuBudget(caps, demande)) {
      return NextResponse.json({ error: "Accès refusé à cette demande." }, { status: 403 });
    }
    const toutVoir = voitToutLeBudget(caps, demande);
    // Ce que ce compte peut faire pendant la préparation (budget collectif), pour l'écran.
    const preparation = {
      toutVoir,
      responsable: estResponsable(caps, demande),
      preparer: caps.preparer,
      saisieOuverte: saisieOuverte(demande),
      // Départements pour lesquels ce compte peut saisir des lignes (invités, et les siens sauf coordinateur).
      departementsSaisie: demande.departementsInvites
        .filter((d) => refusSaisieDepartement(caps, demande, d.departementId) === null)
        .map((d) => d.departement),
      mesDepartements: caps.departementIds,
      email: caps.email,
    };

    // Dépenses d'une proforma de ce budget qui ne sont sur aucun budget : reçues de Camptrack par
    // l'ancien appel (sans ligne), ou saisies sur la proforma avant le budget. À rattacher.
    const depensesARattacher = (
      await prisma.paiement.findMany({
        where: {
          type: "DEPENSE",
          montant: { gt: 0 },
          invoiceId: { in: demande.proformas.map((p) => p.invoiceId) },
          cashJournalEntry: { is: { budgetDepense: { is: null } } },
        },
        orderBy: { datePaiement: "asc" },
        select: { id: true, montant: true, datePaiement: true, reference: true, aRattacherBudget: true, invoice: { select: { numero: true } }, cashJournalEntry: { select: { id: true, libelle: true, cashRegister: { select: { name: true } } } } },
      })
    ).map(({ aRattacherBudget, ...p }) => ({ ...p, origine: aRattacherBudget ? ("CAMPTRACK" as const) : ("PROFORMA" as const) }));

    // Factures de prestataires internes / externes payables sur les lignes de ce budget.
    const facturesPrestataires = await facturesPrestatairesPayables(prisma, demande.lignes.map((l) => l.id));

    // Scan du budget signé exigé pour ce type (réglage Paramètres → Rôles).
    const budgetSigneRequis = (await typesBudgetSigneRequis(prisma)).includes(demande.type);

    if (!toutVoir) {
      // Vue partielle : ses lignes, leur total et ce qui les concerne (dépenses, dépassements,
      // commentaires, pièces de ces dépenses) ; l'historique général sans le détail des autres lignes.
      const lignes = demande.lignes.filter((l) => ligneVisible(caps, demande, l));
      const ids = new Set(lignes.map((l) => l.id));
      const depenses = demande.depenses.filter((x) => ids.has(x.ligneId));
      const idsDepenses = new Set(depenses.map((x) => x.id));
      const ACTIONS_GENERALES = ["CREATION", "RESOUMISSION", "VALIDATION", "REJET", "CLOTURE", "PREPARATION", "SOUMISSION", "PREPARATION_ROUVERTE"];
      return NextResponse.json({
        ...demande,
        lignes,
        montantTotal: lignes.filter((l) => l.statutValidation !== "RETIREE").reduce((s, l) => s + Number(l.montant), 0),
        depenses,
        depassements: demande.depassements.filter((x) => ids.has(x.ligneId)),
        commentaires: demande.commentaires.filter((x) => ids.has(x.ligneId)),
        // Pièces de ses dépenses, et documents qui justifient ses lignes (budget collectif).
        attachments: demande.attachments.filter((a) => (a.depenseId && idsDepenses.has(a.depenseId)) || (!!a.ligneId && ids.has(a.ligneId))),
        historique: demande.historique.filter((h) => ACTIONS_GENERALES.includes(h.action) || h.auteurEmail?.toLowerCase() === caps.email),
        depensesARattacher: [],
        facturesPrestataires: [],
        budgetSigneRequis,
        vuePartielle: true,
        preparation,
      });
    }

    return NextResponse.json({ ...demande, depensesARattacher, facturesPrestataires, budgetSigneRequis, vuePartielle: false, preparation });
  } catch (error) {
    console.error(`Erreur lors de la récupération de la demande ${id}:`, error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
