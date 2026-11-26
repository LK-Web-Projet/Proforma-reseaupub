import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { z } from "zod";
import { NatureDepense, Prisma, SourceDepense, StatutFactureFournisseur } from "@prisma/client";
import { codeMoyenSchema } from "@/lib/moyensPaiement";
import prisma from "@/lib/prisma";
import { requireBudgetUser } from "@/lib/budgetAuth";
import { etatDepensable, getLigneDisponible, seuilsFranchis } from "@/lib/budgetSuivi";
import { etatLiasse, payeSurCommande } from "@/lib/commandeFournisseurLiasse";
import { PaiementCommandeError } from "@/lib/commandeFournisseurSuivi";
import { budgetsDeLaProforma, DepenseError, enregistrerDepense } from "@/lib/depenses/enregistrerDepense";
import { isSoldeInsuffisantError } from "@/lib/cashJournal";
import { describeFsError, saveDemandeBudgetFiles, UploadRejectedError } from "@/lib/uploadDemandeBudget";
import { assertAllowedUpload, safeUploadFileName } from "@/lib/uploadSecurity";
import { sendAlerteConsommationNotification } from "@/lib/email/demandeBudget";

/**
 * « Appliquer le paiement » d'une facture de prestataire, depuis la liste des factures : c'est le seul
 * endroit où l'on paie une facture. On ne choisit JAMAIS le budget ici : il découle du rattachement.
 * - `BUDGET` — ligne de budget du bon de commande (fournisseur), ou de la facture elle-même (prestataire
 *   interne / externe, choisie à l'enregistrement) : sortie de caisse, retrait sur la ligne, dépense sur
 *   la proforma du budget s'il en a une, facture « payée » (et bon « payé » au solde).
 * - `PROFORMA` — bon de commande d'une campagne SANS budget : sortie de caisse, dépense sur la proforma,
 *   facture et bon « payés ».
 * - `CAISSE` — rien de rattaché au budget (pas de bon ni de ligne, ou bon sans ligne ni proforma) :
 *   sortie de la caisse choisie et facture « payée », rien sur un budget.
 * Le montant est fixé au reste à payer, la preuve de paiement est obligatoire. Avec un bon de commande,
 * ses contrôles restent : bon validé, scan signé, liasse complète pour le solde.
 */

type ModePaiementFacture = "BUDGET" | "PROFORMA" | "CAISSE";

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
      proformas: { select: { invoiceId: true, invoice: { select: { numero: true } } } },
    },
  },
} satisfies Prisma.FactureFournisseurInclude;

type FacturePayable = Prisma.FactureFournisseurGetPayload<{ include: typeof factureInclude }>;

/** Ce qu'il faut savoir pour payer : reste, mode (budget, proforma, caisse seule), et ce qui bloque. */
async function analyser(facture: FacturePayable) {
  const blocages: string[] = [];
  if (facture.status !== StatutFactureFournisseur.EN_ATTENTE) {
    blocages.push(facture.status === StatutFactureFournisseur.PAYEE ? "Cette facture est déjà payée." : "Cette facture est annulée.");
  }
  const commande = facture.commande;
  let dejaPaye: number;
  let ligne: { id: string; designation: string; demandeBudgetId: string } | null;
  let proforma: { id: string; numero: string } | null = null;
  let mode: ModePaiementFacture;
  if (commande) {
    dejaPaye = payeSurCommande(commande.imputations);
    ligne = commande.ligneBudget;
    if (ligne) {
      mode = "BUDGET";
    } else {
      const p = commande.proformas[0];
      if (p) {
        // Campagne sans budget : la dépense va sur la proforma. Avec un budget, le bon doit avoir sa ligne.
        const budgets = await budgetsDeLaProforma(prisma, p.invoiceId);
        if (budgets.length > 0) {
          blocages.push(
            `Le bon de commande ${commande.numero} n'est rattaché à aucune ligne alors que sa campagne a un budget (${budgets.map((b) => b.numero).join(", ")}) : rattachez-le à une ligne de ce budget depuis sa fiche.`
          );
        }
        proforma = { id: p.invoiceId, numero: p.invoice.numero };
        mode = "PROFORMA";
      } else {
        mode = "CAISSE";
      }
    }
    // Contrôles du bon de commande, avec ou sans budget (choix 3a).
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
    // Sans ligne (y compris une ancienne facture de fournisseur sans bon, choix 4a) : caisse seule.
    mode = ligne ? "BUDGET" : "CAISSE";
  }
  const montantReference = commande ? Number(commande.montantNet) : Number(facture.montant);
  const reste = Math.max(montantReference - dejaPaye, 0);
  if (reste <= 0 && blocages.length === 0) blocages.push("Il ne reste rien à payer sur cette facture.");
  return { dejaPaye, reste, ligne, proforma, mode, blocages };
}

async function chargerFacture(id: string) {
  return prisma.factureFournisseur.findUnique({ where: { id }, include: factureInclude });
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
      include: { demandeBudget: { select: { id: true, numero: true, type: true, statut: true, proformas: { select: { invoice: { select: { numero: true } } } } } } },
    });
    const d = await getLigneDisponible(prisma, l);
    const etat = await etatDepensable(prisma, l.demandeBudget);
    if (!etat.depensable && etat.motif) a.blocages.push(etat.motif);
    ligne = {
      id: l.id,
      designation: l.designation,
      budgetId: l.demandeBudget.id,
      budgetNumero: l.demandeBudget.numero,
      reste: d.reste,
      proformas: l.demandeBudget.proformas.map((p) => p.invoice.numero),
    };
  }
  return NextResponse.json({
    facture: { id: facture.id, reference: facture.reference, montant: Number(facture.montant), fournisseur: facture.fournisseur.entreprise },
    commande: facture.commande ? { id: facture.commande.id, numero: facture.commande.numero, montantNet: Number(facture.commande.montantNet) } : null,
    dejaPaye: a.dejaPaye,
    reste: a.reste,
    mode: a.mode,
    ligne,
    proforma: a.proforma,
    blocages: a.blocages,
    peutPayer: caps.canPay,
  });
}

const schema = z.object({
  cashRegisterId: z.number().int().positive("Choisissez la caisse."),
  datePaiement: z.string().min(1, "La date du paiement est requise."),
  modePaiement: codeMoyenSchema,
  reference: z.string().trim().optional(),
  invoiceId: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * Preuves d'un paiement sans budget : rangées avec la facture (public/Upload/PaiementsFactures/<id>/),
 * puis jointes à l'écriture de caisse (pièces du journal de caisse).
 */
async function enregistrerPreuvesSansBudget(factureId: string, preuves: File[]) {
  preuves.forEach((f) => assertAllowedUpload(f));
  const dossier = join(process.cwd(), "public", "Upload", "PaiementsFactures", factureId);
  await mkdir(dossier, { recursive: true });
  const fichiers: { url: string; fileName: string; fileType: string }[] = [];
  for (const f of preuves) {
    const nom = `${Date.now()}-${safeUploadFileName(f.name)}`;
    await writeFile(join(dossier, nom), Buffer.from(await f.arrayBuffer()));
    fichiers.push({ url: `/Upload/PaiementsFactures/${factureId}/${nom}`, fileName: f.name, fileType: f.type || "application/octet-stream" });
  }
  return fichiers;
}

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
    if (a.blocages.length > 0) return NextResponse.json({ error: a.blocages[0] }, { status: 400 });

    const datePaiement = new Date(data.datePaiement);
    const auteur = { userId: caps.userId, email: caps.email, name: caps.name };
    const notes = data.notes ?? `Paiement de la facture ${facture.reference}${data.reference ? ` — réf. ${data.reference}` : ""}`;
    const communs = {
      auteur,
      montant: a.reste,
      dateDepense: datePaiement,
      cashRegisterId: data.cashRegisterId,
      nomReceveur: facture.fournisseur.entreprise,
      modePaiement: data.modePaiement,
      notes,
      commandeId: facture.commande?.id,
      nature: facture.commande ? NatureDepense.SOLDE : NatureDepense.NORMALE,
      factureFournisseurId: facture.id,
      reference: data.reference,
    };

    // ── Sans budget : caisse seule, ou dépense sur la proforma d'une campagne sans budget ──────────
    if (a.mode !== "BUDGET") {
      const fichiers = await enregistrerPreuvesSansBudget(facture.id, preuves);
      const resultat = await prisma.$transaction(async (tx) => {
        const r = await enregistrerDepense(tx, {
          ...communs,
          source: SourceDepense.MANUEL,
          ligneBudgetId: null,
          invoiceId: a.mode === "PROFORMA" ? a.proforma!.id : null,
          sansBudget: true,
          libelle: `Paiement facture ${facture.reference} — ${facture.fournisseur.entreprise}${facture.commande ? ` (BC ${facture.commande.numero})` : ""}`,
        });
        await tx.cashJournalAttachment.createMany({
          data: fichiers.map((f) => ({ cashJournalId: r.cashJournalEntry.id, ...f })),
        });
        // Trace du passage « payée » (pas de dépense de budget pour la porter).
        await tx.factureFournisseurStatutHistorique.create({
          data: {
            factureFournisseurId: facture.id,
            ancienStatut: StatutFactureFournisseur.EN_ATTENTE,
            nouveauStatut: StatutFactureFournisseur.PAYEE,
            modePaiement: data.modePaiement,
            datePaiement,
            preuve: fichiers[0]?.url ?? null,
            reference: data.reference ?? null,
            motif:
              `Paiement appliqué sans budget : caisse n° ${data.cashRegisterId}, écriture n° ${r.cashJournalEntry.id}` +
              (a.mode === "PROFORMA" ? `, dépense sur la proforma ${a.proforma!.numero}` : ""),
            auteurEmail: caps.email,
            auteurNom: caps.name,
          },
        });
        return r;
      });
      return NextResponse.json(
        { success: true, montant: a.reste, mode: a.mode, cashJournalEntryId: resultat.cashJournalEntry.id },
        { status: 201 }
      );
    }

    // ── Avec budget : la ligne vient du bon de commande ou de la facture ──────────────────────────
    const ligne = await prisma.demandeBudgetLigne.findUnique({
      where: { id: a.ligne!.id },
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

    const savedFiles = await saveDemandeBudgetFiles(ligne.demandeBudgetId, preuves, {
      date: datePaiement,
      montant: a.reste,
      kind: "PREUVE_PAIEMENT",
    });

    const resultat = await prisma.$transaction(async (tx) =>
      enregistrerDepense(tx, {
        ...communs,
        source: SourceDepense.MANUEL,
        ligneBudgetId: ligne.id,
        demandeBudgetId: ligne.demandeBudgetId,
        invoiceId,
        justificatifs: savedFiles,
      })
    );

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

    return NextResponse.json({ success: true, montant: a.reste, mode: a.mode, budgetDepenseId: resultat.budgetDepense?.id ?? null }, { status: 201 });
  } catch (error) {
    if (error instanceof DepenseError || error instanceof UploadRejectedError || error instanceof PaiementCommandeError || isSoldeInsuffisantError(error)) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
    console.error(`Erreur lors du paiement de la facture fournisseur ${id}:`, error);
    const fsMessage = describeFsError(error);
    return NextResponse.json({ error: fsMessage || "Erreur interne du serveur" }, { status: 500 });
  }
}
