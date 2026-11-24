import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { NatureDepense, SourceDepense } from "@prisma/client";
import { codeMoyenSchema } from "@/lib/moyensPaiement";
import prisma from "@/lib/prisma";
import { requireBudgetUser } from "@/lib/budgetAuth";
import { BUDGET_EPSILON, etatDepensable, getLigneDisponible } from "@/lib/budgetSuivi";
import { etatLiasse, payeSurCommande } from "@/lib/commandeFournisseurLiasse";
import { PaiementCommandeError } from "@/lib/commandeFournisseurSuivi";
import { DepenseError, enregistrerDepense } from "@/lib/depenses/enregistrerDepense";
import { isSoldeInsuffisantError } from "@/lib/cashJournal";
import { describeFsError, saveDemandeBudgetFiles, UploadRejectedError } from "@/lib/uploadDemandeBudget";

/**
 * Avance à un fournisseur, depuis la fiche du bon de commande : dépense AVANCE sur la ligne de
 * budget qui finance le bon (enregistrerDepense : caisse, ligne, proforma, imputation « tout le bon »
 * au prorata). Le solde se paie ensuite depuis la facture (« Appliquer le paiement »), avances déduites.
 */

const commandeInclude = {
  fournisseur: { select: { entreprise: true } },
  documents: { select: { kind: true } },
  imputations: { select: { montant: true, annuleeAt: true } },
  proformas: { select: { invoiceId: true } },
  ligneBudget: { include: { demandeBudget: { select: { id: true, numero: true, type: true, statut: true, proformas: { select: { invoiceId: true } } } } } },
} as const;

async function charger(commandeId: string) {
  const commande = await prisma.commandeFournisseur.findUnique({ where: { id: commandeId }, include: commandeInclude });
  if (!commande) return null;
  const blocages: string[] = [];
  const dejaPaye = payeSurCommande(commande.imputations);
  const reste = Math.max(Number(commande.montantNet) - dejaPaye, 0);
  if (commande.statut !== "VALIDEE" && commande.statut !== "LIVREE") blocages.push(`Le bon de commande ${commande.numero} n'est pas validé, ou il est déjà payé.`);
  if (!commande.ligneBudget) blocages.push(`Le bon de commande ${commande.numero} n'est rattaché à aucune ligne de budget : rattachez-le d'abord.`);
  if (!etatLiasse(commande.documents).bcSigne) blocages.push(`Le scan du bon de commande ${commande.numero} signé n'est pas joint.`);
  let ligne = null;
  if (commande.ligneBudget) {
    const d = await getLigneDisponible(prisma, commande.ligneBudget);
    const etat = await etatDepensable(prisma, commande.ligneBudget.demandeBudget);
    if (!etat.depensable && etat.motif) blocages.push(etat.motif);
    ligne = {
      id: commande.ligneBudget.id,
      designation: commande.ligneBudget.designation,
      budgetId: commande.ligneBudget.demandeBudget.id,
      budgetNumero: commande.ligneBudget.demandeBudget.numero,
      reste: d.reste,
    };
  }
  if (reste <= 0 && blocages.length === 0) blocages.push("Ce bon de commande est entièrement payé.");
  return { commande, dejaPaye, reste, ligne, blocages };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ commandeId: string }> }) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;
  const { commandeId } = await params;
  const r = await charger(commandeId);
  if (!r) return NextResponse.json({ error: "Bon de commande introuvable." }, { status: 404 });
  return NextResponse.json({
    facture: null,
    commande: { id: r.commande.id, numero: r.commande.numero, montantNet: Number(r.commande.montantNet), fournisseur: r.commande.fournisseur.entreprise },
    dejaPaye: r.dejaPaye,
    reste: r.reste,
    ligne: r.ligne,
    ligneRequise: false,
    lignesPossibles: [],
    blocages: r.blocages,
    peutPayer: caps.canPay,
  });
}

const schema = z.object({
  montant: z.number().positive("Le montant doit être supérieur à 0."),
  cashRegisterId: z.number().int().positive("Choisissez la caisse."),
  datePaiement: z.string().min(1, "La date du paiement est requise."),
  modePaiement: codeMoyenSchema,
  reference: z.string().trim().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ commandeId: string }> }) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;
  if (!caps.canPay) {
    return NextResponse.json({ error: "Réservé au comptable habilité à enregistrer les dépenses." }, { status: 403 });
  }
  const { commandeId } = await params;

  try {
    const formData = await request.formData();
    const preuves = (formData.getAll("preuves") as File[]).filter((f) => f && f.size > 0);
    const validation = schema.safeParse({
      montant: Number(formData.get("montant")),
      cashRegisterId: Number(formData.get("cashRegisterId")),
      datePaiement: formData.get("datePaiement"),
      modePaiement: formData.get("modePaiement"),
      reference: (formData.get("reference") as string) || undefined,
    });
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
    }
    const data = validation.data;
    if (preuves.length === 0) {
      return NextResponse.json({ error: "Joignez la preuve de paiement (reçu Mobile Money, ordre de virement, décharge…)." }, { status: 400 });
    }
    const r = await charger(commandeId);
    if (!r) return NextResponse.json({ error: "Bon de commande introuvable." }, { status: 404 });
    if (r.blocages.length > 0) return NextResponse.json({ error: r.blocages[0] }, { status: 400 });
    if (data.montant > r.reste + BUDGET_EPSILON) {
      return NextResponse.json({ error: `L'avance dépasse le reste du bon de commande (${r.reste.toLocaleString("fr-FR")} FCFA).` }, { status: 400 });
    }
    const ligneBudget = r.commande.ligneBudget!;
    const proformasBudget = ligneBudget.demandeBudget.proformas.map((p) => p.invoiceId);
    const invoiceId = proformasBudget.length <= 1 ? undefined : r.commande.proformas.map((p) => p.invoiceId).find((pid) => proformasBudget.includes(pid));

    const datePaiement = new Date(data.datePaiement);
    const savedFiles = await saveDemandeBudgetFiles(ligneBudget.demandeBudget.id, preuves, {
      date: datePaiement,
      montant: data.montant,
      kind: "PREUVE_PAIEMENT",
    });

    const resultat = await prisma.$transaction((tx) =>
      enregistrerDepense(tx, {
        source: SourceDepense.MANUEL,
        auteur: { userId: caps.userId, email: caps.email, name: caps.name },
        montant: data.montant,
        dateDepense: datePaiement,
        cashRegisterId: data.cashRegisterId,
        nomReceveur: r.commande.fournisseur.entreprise,
        modePaiement: data.modePaiement,
        notes: `Avance sur le bon de commande ${r.commande.numero}${data.reference ? ` — réf. ${data.reference}` : ""}`,
        ligneBudgetId: ligneBudget.id,
        demandeBudgetId: ligneBudget.demandeBudget.id,
        invoiceId,
        commandeId: r.commande.id,
        nature: NatureDepense.AVANCE,
        justificatifs: savedFiles,
        reference: data.reference,
      })
    );
    return NextResponse.json({ success: true, montant: data.montant, budgetDepenseId: resultat.budgetDepense?.id ?? null }, { status: 201 });
  } catch (error) {
    if (error instanceof DepenseError || error instanceof UploadRejectedError || error instanceof PaiementCommandeError || isSoldeInsuffisantError(error)) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
    console.error(`Erreur lors de l'avance sur le bon de commande ${commandeId}:`, error);
    const fsMessage = describeFsError(error);
    return NextResponse.json({ error: fsMessage || "Erreur interne du serveur" }, { status: 500 });
  }
}
