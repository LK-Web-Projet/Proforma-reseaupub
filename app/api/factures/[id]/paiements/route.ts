import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { join } from "path";
import { mkdirSync, existsSync } from "fs";
import { writeFile } from "fs/promises";
import { assertAllowedUpload, safeUploadFileName } from "@/lib/uploadSecurity";
import { auth } from "@clerk/nextjs/server";
import { NatureDepense, SourceDepense } from "@prisma/client";
import { codeMoyenSchema } from "@/lib/moyensPaiement";
import { erreurMoyenEtCaisse } from "@/lib/moyensPaiementServeur";
import { DepenseError, enregistrerDepense } from "@/lib/depenses/enregistrerDepense";
import { PaiementCommandeError } from "@/lib/commandeFournisseurSuivi";
import { isSoldeInsuffisantError } from "@/lib/cashJournal";
import { lockCashRegister } from "@/lib/cashJournal";
import { safeCreatedById } from "@/lib/authz";
import { sendProformaPaiementNotification } from "@/lib/email/proformaPaiement";
import { requireCaisseUser } from "@/lib/budgetAuth";
import { requirePermission } from "@/lib/authz";
import { proformaDansPortee } from "@/lib/proformaPortee";
import { auteurDepuisUtilisateur, journaliserProforma } from "@/lib/proformaHistoriqueServeur";
import { fcfa, libelleStatutProforma } from "@/lib/proformaHistorique";

// ✅ Schéma de validation
const paiementSchema = z.object({
  montant: z.number().positive("Le montant doit être un nombre positif."),
  // Code du moyen de paiement (Finance → Moyens de paiement) : la caisse doit lui être liée.
  methode: codeMoyenSchema,
  reference: z.string().optional(),
  notes: z.string().optional(),
  datePaiement: z.preprocess(
    (arg) =>
      typeof arg === "string" || arg instanceof Date
        ? new Date(arg)
        : undefined,
    z.date().optional(),
  ),
  cashRegisterId: z.number().optional(),
  type: z.enum(["PAIEMENT", "DEPENSE"]).default("PAIEMENT"),
  // Dépense d'une campagne SANS budget : bon de commande facultatif (avance / solde, ligne de
  // produit ou tout le bon). Une campagne avec budget passe par /api/demandes-budget/[id]/depenses.
  commandeId: z.string().optional(),
  nature: z.nativeEnum(NatureDepense).optional(),
  ligneCommandeId: z.string().optional(),
  factureFournisseurId: z.string().optional(),
  nomReceveur: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await auth();
    const { id: invoiceId } = await params;
    const formData = await request.formData();

    const paymentDataString = formData.get("paymentData") as string;
    if (!paymentDataString) {
      return NextResponse.json(
        { error: "Payment data is missing" },
        { status: 400 },
      );
    }

    const paymentData = JSON.parse(paymentDataString);
    const files = formData.getAll("files") as File[];
    // Vérifié AVANT la transaction : un fichier refusé ne doit jamais laisser un paiement enregistré.
    try {
      files.forEach((f) => assertAllowedUpload(f));
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Fichier refusé." }, { status: 400 });
    }

    const validation = paiementSchema.safeParse(paymentData);
    if (!validation.success) {
      // ✅ Correction : remplacer formErrors par format()
      return NextResponse.json(
        { error: "Données invalides", details: validation.error.format() },
        { status: 400 },
      );
    }

    const { montant, methode, cashRegisterId, type, commandeId, nature, ligneCommandeId, factureFournisseurId, nomReceveur, ...rest } = validation.data;
    const montantDecimal = parseFloat(montant.toFixed(2));

    // Une dépense imputée à une proforma est une sortie de caisse hors budget : même droit que la
    // saisie directe au journal (les encaissements clients restent ouverts comme avant).
    let auteur = { email: "inconnu", name: null as string | null };
    if (type === "PAIEMENT") {
      // Encaissement d'une recette client : droit « Enregistrer un encaissement » (page Proforma),
      // sur une proforma de sa portée.
      const droits = await requirePermission("proforma.encaisser");
      if (droits instanceof NextResponse) return droits;
      if (!(await proformaDansPortee(prisma, droits, invoiceId))) {
        return NextResponse.json({ error: "Cette proforma n'est pas dans votre portée (vous ne voyez que les vôtres)." }, { status: 403 });
      }
      auteur = { email: droits.email, name: null };
    }
    if (type === "DEPENSE") {
      const caisseCaps = await requireCaisseUser();
      if (caisseCaps instanceof NextResponse) return caisseCaps;
      auteur = { email: caisseCaps.email, name: caisseCaps.name };
    }

    // La caisse est celle choisie (plus de caisse imposée pour les espèces depuis le 2026-11-24 :
    // la caisse doit être liée au moyen choisi, voir Finance → Moyens de paiement).
    const finalCashRegisterId = cashRegisterId;
    if (!finalCashRegisterId) {
      return NextResponse.json(
        { error: "Choisissez la caisse de cette opération." },
        { status: 400 },
      );
    }
    // Encaissement : moyen actif, caisse visible et liée à ce moyen (pour une dépense, le même
    // contrôle est fait par enregistrerDepense).
    if (type === "PAIEMENT") {
      const erreurMoyen = await erreurMoyenEtCaisse(prisma, methode, finalCashRegisterId);
      if (erreurMoyen) return NextResponse.json({ error: erreurMoyen }, { status: 400 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        resteAPayer: true,
        numero: true,
        objet: true,
        totalTTC: true,
        devise: true,
        client: { select: { nom: true } },
        produits: { select: { designation: true, quantite: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Facture non trouvée." },
        { status: 404 },
      );
    }

    if (
      type === "PAIEMENT" &&
      montantDecimal > parseFloat(invoice.resteAPayer.toString())
    ) {
      return NextResponse.json(
        {
          error:
            "Le montant du paiement ne peut pas dépasser le reste à payer.",
        },
        { status: 400 },
      );
    }

    if (type === "DEPENSE") {
      const lastCashJournalEntry = await prisma.cashJournal.findFirst({
        where: { cashRegisterId: finalCashRegisterId },
        orderBy: { id: "desc" },
      });
      const currentBalance = lastCashJournalEntry
        ? lastCashJournalEntry.solde
        : 0;

      if (montantDecimal > currentBalance) {
        const cashRegister = await prisma.cashRegister.findUnique({
          where: { id: finalCashRegisterId },
        });
        return NextResponse.json(
          {
            error: `Solde insuffisant dans la caisse "${cashRegister?.name}". Solde actuel: ${currentBalance.toLocaleString("fr-FR")} FCFA.`,
          },
          { status: 400 },
        );
      }
    }

    const libelle = `${rest.reference || (type === "PAIEMENT" ? "Paiement" : "Dépense")} (Proforma ${invoice.numero} de ${invoice.client.nom} pour ${invoice.objet})`;
    const dateOperation = rest.datePaiement
      ? new Date(rest.datePaiement)
      : new Date();

    const result = await prisma.$transaction(async (tx) => {
      const createdById = await safeCreatedById(tx, userId);

      if (type === "DEPENSE") {
        // Même opération que partout ailleurs (lib/depenses/enregistrerDepense.ts) : refusée si la
        // campagne a un budget (la dépense doit alors porter sur une ligne), bon de commande géré.
        const { cashJournalEntry } = await enregistrerDepense(tx, {
          source: SourceDepense.PROFORMA,
          auteur: { userId: createdById, ...auteur },
          montant: montantDecimal,
          dateDepense: dateOperation,
          cashRegisterId: finalCashRegisterId,
          nomReceveur: nomReceveur?.trim() || rest.reference || "—",
          modePaiement: methode,
          notes: rest.notes,
          invoiceId,
          commandeId,
          nature: commandeId ? nature : NatureDepense.NORMALE,
          ligneCommandeId,
          factureFournisseurId,
          libelle,
          methode,
          reference: rest.reference,
        });

        const updatedInvoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
        return { updatedInvoice, newCashJournalEntryId: cashJournalEntry.id };
      }

      await lockCashRegister(tx, finalCashRegisterId);
      const lastCashJournalEntry = await tx.cashJournal.findFirst({
        where: { cashRegisterId: finalCashRegisterId },
        orderBy: { id: "desc" },
      });
      const lastBalance = lastCashJournalEntry ? lastCashJournalEntry.solde : 0;
      const newBalance = lastBalance + montantDecimal;

      const newCashJournalEntry = await tx.cashJournal.create({
        data: {
          date_operation: dateOperation,
          libelle,
          type: "RECETTE",
          montant: montantDecimal,
          solde: newBalance,
          isApportDeCaisse: false,
          cashRegisterId: finalCashRegisterId,
          createdById,
        },
      });

      await tx.cashRegister.update({
        where: { id: finalCashRegisterId },
        data: { balance: newBalance },
      });

      await tx.paiement.create({
        data: {
          invoiceId,
          montant: montantDecimal,
          methode,
          type,
          ...rest,
          cashJournalEntryId: newCashJournalEntry.id,
          createdById,
        },
      });

      const currentReste = parseFloat((await tx.invoice.findUnique({ where: { id: invoiceId } }))!.resteAPayer.toString());
      // ✅ Calcul avec arrondi pour éviter les résidus de virgule flottante
      let newResteAPayer = Math.round((currentReste - montantDecimal) * 100) / 100;

      // ✅ Pour le XOF (et par sécurité), si le reste est inférieur à 1, on considère que c'est soldé
      if (newResteAPayer < 1) {
        newResteAPayer = 0;
      }

      const statutAvant = (await tx.invoice.findUnique({ where: { id: invoiceId }, select: { statut: true } }))!.statut;
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          resteAPayer: newResteAPayer,
          statut: newResteAPayer <= 0 ? "Solde" : "Payer",
        },
      });

      // Historique : l'encaissement, et le statut s'il a changé (posé par l'encaissement).
      const auteurHisto = (await auteurDepuisUtilisateur(tx, createdById)) ?? { email: auteur.email };
      const caisse = await tx.cashRegister.findUnique({ where: { id: finalCashRegisterId }, select: { name: true } });
      const moyen = await tx.moyenPaiement.findUnique({ where: { code: methode }, select: { nom: true } });
      await journaliserProforma(
        tx,
        invoiceId,
        "ENCAISSEMENT",
        `Encaissement de ${fcfa(montantDecimal)} par ${moyen?.nom ?? methode} (caisse ${caisse?.name ?? finalCashRegisterId})${rest.reference ? ` — ${rest.reference}` : ""} — reste à payer ${fcfa(newResteAPayer)}`,
        auteurHisto,
        { montant: montantDecimal, methode, cashRegisterId: finalCashRegisterId, resteAPayer: newResteAPayer }
      );
      if (updatedInvoice.statut !== statutAvant) {
        await journaliserProforma(
          tx,
          invoiceId,
          "STATUT",
          `Statut : ${libelleStatutProforma(statutAvant)} → ${libelleStatutProforma(updatedInvoice.statut)} (encaissement)`,
          auteurHisto,
          { ancien: statutAvant, nouveau: updatedInvoice.statut, automatique: true }
        );
      }

      return { updatedInvoice, newCashJournalEntryId: newCashJournalEntry.id };
    }, {
      timeout: 15000, // 15 secondes (le défaut de 5s est parfois trop court, ex. latence Supabase)
    });

    // Notification Admin (avec confetti) uniquement pour un vrai paiement client, pas une dépense.
    if (type === "PAIEMENT") {
      const margeSums = await prisma.paiement.groupBy({
        by: ["type"],
        where: { invoiceId },
        _sum: { montant: true },
      });
      const paiementTotal = Number(
        margeSums.find((s) => s.type === "PAIEMENT")?._sum.montant ?? 0,
      );
      const depenseTotal = Number(
        margeSums.find((s) => s.type === "DEPENSE")?._sum.montant ?? 0,
      );

      sendProformaPaiementNotification({
        invoice: {
          id: invoiceId,
          numero: invoice.numero,
          objet: invoice.objet,
          totalTTC: Number(invoice.totalTTC),
          devise: invoice.devise,
          client: { nom: invoice.client.nom },
          produits: invoice.produits,
        },
        montantPaye: montantDecimal,
        resteAPayer: Number(result.updatedInvoice!.resteAPayer),
        margeBrute: paiementTotal - depenseTotal,
      }).catch((err) => {
        console.error("Erreur lors de l'envoi de la notification de paiement proforma :", err);
      });
    }

    if (files.length > 0) {
      const uploadDir = join(
        process.cwd(),
        "public",
        "Upload",
        "CashJournal",
        String(result.newCashJournalEntryId),
      );
      if (!existsSync(uploadDir)) {
        mkdirSync(uploadDir, { recursive: true });
      }

      for (const file of files) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const safeName = safeUploadFileName(file.name);
        const path = join(uploadDir, safeName);
        await writeFile(path, buffer);

        const fileUrl = join(
          "/",
          "Upload",
          "CashJournal",
          String(result.newCashJournalEntryId),
          safeName,
        ).replace(/\\/g, "/");

        await prisma.cashJournalAttachment.create({
          data: {
            cashJournalId: result.newCashJournalEntryId,
            url: fileUrl,
            fileName: file.name,
            fileType: file.type,
          },
        });
      }
    }

    return NextResponse.json(result.updatedInvoice, { status: 201 });
  } catch (error) {
    if (error instanceof DepenseError || error instanceof PaiementCommandeError || isSoldeInsuffisantError(error)) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
    console.error("Erreur lors de l'ajout du paiement:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Une erreur interne est survenue.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
