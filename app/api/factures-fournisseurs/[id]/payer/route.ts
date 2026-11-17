import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ModePaiementDemande, NatureDepense, Prisma, SourceDepense, StatutFactureFournisseur } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireBudgetUser } from "@/lib/budgetAuth";
import { etatDepensable, getLigneDisponible, seuilsFranchis } from "@/lib/budgetSuivi";
import { etatLiasse, payeSurCommande } from "@/lib/commandeFournisseurLiasse";
import { PaiementCommandeError } from "@/lib/commandeFournisseurSuivi";
import { DepenseError, enregistrerDepense } from "@/lib/depenses/enregistrerDepense";
import { isSoldeInsuffisantError } from "@/lib/cashJournal";
import { describeFsError, saveDemandeBudgetFiles, UploadRejectedError } from "@/lib/uploadDemandeBudget";
import { exigeBonDeCommande } from "@/lib/typeFournisseur";
import { sendAlerteConsommationNotification } from "@/lib/email/demandeBudget";

/**
 * « Appliquer le paiement » d'une facture fournisseur, depuis la liste des factures : c'est le seul
 * endroit où l'on paie une facture.
 * - Facture d'un Fournisseur : rattachée à son bon de commande, lui-même financé par une ligne de
 *   budget → SOLDE du bon (les avances déjà versées sont déduites).
 * - Facture d'un prestataire interne / externe (sans bon) : rattachée directement à une ligne de
 *   budget (ex. budget mensuel de la comptabilité pour la paie), choisie ici si elle ne l'est pas.
 * Le montant est fixé au reste à payer et la preuve de paiement est obligatoire. Tout passe par
 * enregistrerDepense : caisse, ligne de budget, proforma du budget, facture « payée », bon « payé ».
 */

const factureInclude = {
  fournisseur: { select: { entreprise: true, typeFournisseur: true } },
  ligneBudget: { select: { id: true, designation: true, demandeBudgetId: true } },
  depenses: { where: { annuleeAt: null }, select: { montant: true } },
  commande: {
    select: {
      id: true,
      numero: true,
      statut: true,
      montantNet: true,
      ligneBudgetId: true,
      ligneBudget: { select: { id: true, designation: true, demandeBudgetId: true } },
      documents: { select: { kind: true } },
      factures: { select: { pieceJointe: true, status: true } },
      imputations: { select: { montant: true, annuleeAt: true } },
      proformas: { select: { invoiceId: true } },
    },
  },
} satisfies Prisma.FactureFournisseurInclude;

type FacturePayable = Prisma.FactureFournisseurGetPayload<{ include: typeof factureInclude }>;

/** Ce qu'il faut savoir pour payer : reste, ligne de budget, et ce qui bloque encore. */
async function analyser(facture: FacturePayable) {
  const blocages: string[] = [];
  if (facture.status !== StatutFactureFournisseur.EN_ATTENTE) {
    blocages.push(facture.status === StatutFactureFournisseur.PAYEE ? "Cette facture est déjà payée." : "Cette facture est annulée.");
  }
  const commande = facture.commande;
  let dejaPaye: number;
  let ligne: { id: string; designation: string; demandeBudgetId: string } | null;
  if (commande) {
    dejaPaye = payeSurCommande(commande.imputations);
    ligne = commande.ligneBudget;
    if (!ligne) {
      blocages.push(
        `Le bon de commande ${commande.numero} n'est rattaché à aucune ligne de budget : rattachez-le depuis sa fiche (ou, pour une campagne sans budget, payez-le depuis la proforma).`
      );
    }
    if (!etatLiasse(commande.documents).bcSigne) {
      blocages.push(`Le scan du bon de commande ${commande.numero} signé n'est pas joint.`);
    }
    if (commande.statut === "BROUILLON" || commande.statut === "ANNULEE") {
      blocages.push(`Le bon de commande ${commande.numero} n'est pas validé.`);
    }
    const config = await prisma.entrepriseConfig.findUnique({ where: { id: "singleton" }, select: { liasseExigeePourSolde: true } });
    const liasse = etatLiasse(commande.documents, commande.factures);
    if ((config?.liasseExigeePourSolde ?? true) && !liasse.complete) {
      const manquantes = liasse.manquantes.filter((m) => m !== "bon de commande signé");
      if (manquantes.length > 0) blocages.push(`Liasse incomplète : manque ${manquantes.join(", ")}.`);
    }
  } else {
    dejaPaye = facture.depenses.reduce((s, d) => s + Number(d.montant), 0);
    ligne = facture.ligneBudget;
    if (exigeBonDeCommande(facture.fournisseur.typeFournisseur)) {
      blocages.push(
        "Facture d'un fournisseur sans bon de commande (ancienne facture) : elle ne passe pas par le budget. Marquez-la « Payée » à la main dans la liste si elle a été réglée."
      );
    }
  }
  const montantReference = commande ? Number(commande.montantNet) : Number(facture.montant);
  const reste = Math.max(montantReference - dejaPaye, 0);
  if (reste <= 0 && blocages.length === 0) blocages.push("Il ne reste rien à payer sur cette facture.");
  return { dejaPaye, reste, ligne, ligneRequise: !commande && !ligne && !exigeBonDeCommande(facture.fournisseur.typeFournisseur), blocages };
}

async function chargerFacture(id: string) {
  return prisma.factureFournisseur.findUnique({ where: { id }, include: factureInclude });
}

/** Lignes de budget dépensables (pour une facture de prestataire interne / externe sans ligne). */
async function lignesPossibles() {
  const budgets = await prisma.demandeBudget.findMany({
    where: { statut: { in: ["VALIDEE", "EN_COURS", "VALIDATION_PARTIELLE"] }, clotureeAt: null },
    select: { id: true, numero: true, type: true, statut: true, lignes: { where: { statutValidation: "ACCORDEE" }, orderBy: { designation: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  const resultat = [];
  for (const b of budgets) {
    if (!(await etatDepensable(prisma, b)).depensable) continue;
    for (const l of b.lignes) {
      const d = await getLigneDisponible(prisma, l);
      if (d.reste > 0) resultat.push({ id: l.id, designation: l.designation, budgetId: b.id, budgetNumero: b.numero, budgetType: b.type, reste: d.reste });
    }
  }
  return resultat;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;
  const { id } = await params;
  const facture = await chargerFacture(id);
  if (!facture) return NextResponse.json({ error: "Facture introuvable." }, { status: 404 });

  const a = await analyser(facture);
  let ligne = null;
  if (a.ligne) {
    const l = await prisma.demandeBudgetLigne.findUniqueOrThrow({
      where: { id: a.ligne.id },
      include: { demandeBudget: { select: { id: true, numero: true, type: true, statut: true } } },
    });
    const d = await getLigneDisponible(prisma, l);
    const etat = await etatDepensable(prisma, l.demandeBudget);
    if (!etat.depensable && etat.motif) a.blocages.push(etat.motif);
    ligne = { id: l.id, designation: l.designation, budgetId: l.demandeBudget.id, budgetNumero: l.demandeBudget.numero, reste: d.reste };
  }
  return NextResponse.json({
    facture: { id: facture.id, reference: facture.reference, montant: Number(facture.montant), fournisseur: facture.fournisseur.entreprise },
    commande: facture.commande ? { id: facture.commande.id, numero: facture.commande.numero, montantNet: Number(facture.commande.montantNet) } : null,
    dejaPaye: a.dejaPaye,
    reste: a.reste,
    ligne,
    ligneRequise: a.ligneRequise,
    lignesPossibles: a.ligneRequise ? await lignesPossibles() : [],
    blocages: a.blocages,
    peutPayer: caps.canPay,
  });
}

const schema = z.object({
  cashRegisterId: z.number().int().positive("Choisissez la caisse."),
  datePaiement: z.string().min(1, "La date du paiement est requise."),
  modePaiement: z.nativeEnum(ModePaiementDemande),
  reference: z.string().trim().optional(),
  ligneBudgetId: z.string().optional(),
  invoiceId: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;
  if (!caps.canPay) {
    return NextResponse.json({ error: "Réservé au comptable habilité à enregistrer les dépenses." }, { status: 403 });
  }
  const { id } = await params;

  try {
    const formData = await request.formData();
    const preuves = (formData.getAll("preuves") as File[]).filter((f) => f && f.size > 0);
    const validation = schema.safeParse({
      cashRegisterId: Number(formData.get("cashRegisterId")),
      datePaiement: formData.get("datePaiement"),
      modePaiement: formData.get("modePaiement"),
      reference: (formData.get("reference") as string) || undefined,
      ligneBudgetId: (formData.get("ligneBudgetId") as string) || undefined,
      invoiceId: (formData.get("invoiceId") as string) || undefined,
      notes: (formData.get("notes") as string) || undefined,
    });
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
    }
    const data = validation.data;
    if (preuves.length === 0) {
      return NextResponse.json({ error: "Joignez la preuve de paiement (reçu Mobile Money, ordre de virement, décharge…)." }, { status: 400 });
    }

    const facture = await chargerFacture(id);
    if (!facture) return NextResponse.json({ error: "Facture introuvable." }, { status: 404 });
    const a = await analyser(facture);
    const ligneBudgetId = a.ligne?.id ?? data.ligneBudgetId;
    if (!ligneBudgetId) {
      return NextResponse.json({ error: "Choisissez la ligne de budget qui paie cette facture (ex. budget mensuel de la comptabilité)." }, { status: 400 });
    }
    if (a.blocages.length > 0) return NextResponse.json({ error: a.blocages[0] }, { status: 400 });

    const ligne = await prisma.demandeBudgetLigne.findUnique({
      where: { id: ligneBudgetId },
      select: { id: true, demandeBudgetId: true, demandeBudget: { select: { proformas: { select: { invoiceId: true } } } } },
    });
    if (!ligne) return NextResponse.json({ error: "Ligne de budget introuvable." }, { status: 400 });

    // Proforma imputée : celle du budget s'il n'en a qu'une ; sinon celle du bon de commande parmi
    // celles du budget, ou celle choisie.
    const proformasBudget = ligne.demandeBudget.proformas.map((p) => p.invoiceId);
    const invoiceId =
      proformasBudget.length <= 1
        ? undefined
        : data.invoiceId ?? facture.commande?.proformas.map((p) => p.invoiceId).find((pid) => proformasBudget.includes(pid));

    const datePaiement = new Date(data.datePaiement);
    const savedFiles = await saveDemandeBudgetFiles(ligne.demandeBudgetId, preuves, {
      date: datePaiement,
      montant: a.reste,
      kind: "PREUVE_PAIEMENT",
    });

    const resultat = await prisma.$transaction(async (tx) => {
      // Facture de prestataire sans ligne : elle est rattachée à la ligne choisie.
      if (!facture.commande && !facture.ligneBudgetId) {
        await tx.factureFournisseur.update({ where: { id: facture.id }, data: { ligneBudgetId } });
      }
      return enregistrerDepense(tx, {
        source: SourceDepense.MANUEL,
        auteur: { userId: caps.userId, email: caps.email, name: caps.name },
        montant: a.reste,
        dateDepense: datePaiement,
        cashRegisterId: data.cashRegisterId,
        nomReceveur: facture.fournisseur.entreprise,
        modePaiement: data.modePaiement,
        notes: data.notes ?? `Paiement de la facture ${facture.reference}${data.reference ? ` — réf. ${data.reference}` : ""}`,
        ligneBudgetId,
        demandeBudgetId: ligne.demandeBudgetId,
        invoiceId,
        commandeId: facture.commande?.id,
        nature: facture.commande ? NatureDepense.SOLDE : NatureDepense.NORMALE,
        factureFournisseurId: facture.id,
        justificatifs: savedFiles,
        reference: data.reference,
      });
    });

    // Alertes 80 % / 100 % de la ligne — hors transaction.
    const { demande, ligne: ligneBudget, avant } = resultat;
    if (demande && ligneBudget && avant) {
      const demandeEmail = await prisma.demandeBudget.findUnique({ where: { id: demande.id }, include: { lignes: true } });
      for (const seuil of seuilsFranchis(avant.consomme, avant.consomme + a.reste, avant.plafond)) {
        if (!demandeEmail) break;
        sendAlerteConsommationNotification(demandeEmail, {
          designation: ligneBudget.designation,
          seuil,
          consomme: avant.consomme + a.reste,
          plafond: avant.plafond,
        }).catch((err) => console.error("Erreur lors de l'envoi de l'alerte de consommation:", err));
      }
    }

    return NextResponse.json({ success: true, montant: a.reste, budgetDepenseId: resultat.budgetDepense?.id ?? null }, { status: 201 });
  } catch (error) {
    if (error instanceof DepenseError || error instanceof UploadRejectedError || error instanceof PaiementCommandeError || isSoldeInsuffisantError(error)) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
    console.error(`Erreur lors du paiement de la facture fournisseur ${id}:`, error);
    const fsMessage = describeFsError(error);
    return NextResponse.json({ error: fsMessage || "Erreur interne du serveur" }, { status: 500 });
  }
}
