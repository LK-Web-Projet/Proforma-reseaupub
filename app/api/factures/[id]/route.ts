import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { StatusFacture } from "@prisma/client";
import { sendProformaValidatedNotification } from "@/lib/email/proformaValidation";

// ---------- Schéma de validation ----------
const productSchema = z.object({
  id: z.string().optional(),
  produitId: z.string().min(1, "produitId est requis"),
  designation: z.string().min(1, "designation est requise"),
  quantite: z.coerce.number().min(1, "quantité min 1"),
  prixUnitaire: z.coerce.number().min(0, "prix unitaire >= 0"),
  duree: z.coerce.number().min(0).optional(),
  uniteDuree: z.enum(["jour", "heure", "mois", "semaine"]).optional(),
  includeduree: z.boolean().optional(),
});

const updateInvoiceSchema = z.object({
  statut: z.nativeEnum(StatusFacture).optional(),
  produits: z.array(productSchema).optional(),
  tva: z.coerce.number().min(0).optional(),
  devise: z.enum(["XOF", "EUR", "USD"]).optional(),
  paymentConditionPercentage: z.number().optional().nullable(),
  objet: z.string().min(1, "L'objet de la facture est requis.").optional(),
  gestionnaireId: z.string().optional().nullable(),
  info: z.string().optional().nullable(),
  isTaxExempt: z.boolean().optional(),
  isDiscountEnabled: z.boolean().optional(),
  discountType: z.enum(["POURCENTAGE", "MONTANT"]).optional(),
  discountValue: z.coerce.number().min(0).optional(),
});

// ---------- Helpers ----------
function toNumber(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** calcule le montant d'une ligne en fonction des champs et de includeduree */
function computeLineTotal(p: z.infer<typeof productSchema>) {
  const quantite = toNumber(p.quantite);
  const prixUnitaire = toNumber(p.prixUnitaire);
  const duree =
    p.duree === undefined || p.duree === null ? 1 : toNumber(p.duree);
  const inclureDuree = p.includeduree ?? false;
  return inclureDuree
    ? quantite * prixUnitaire * (duree || 1)
    : quantite * prixUnitaire;
}

// ---------- GET ----------
export async function GET(
  request: NextRequest,
  {params}: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const facture = await prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        produits: { include: { produit: true } },
        gestionnaires: { include: { gestionnaire: true } },
        bonCommande: true, // Added
        factureNormaliser: true, // Added
        paiements: {
          include: {
            cashJournalEntry: {
              include: {
                attachments: true,
                // Origine de la dépense (colonne « Origine » de la proforma) : ligne de budget, bon
                // de commande, facture, lot CampTrack. Même écriture de caisse : aucun doublon.
                budgetDepense: {
                  select: {
                    id: true,
                    nature: true,
                    source: true,
                    annuleeAt: true,
                    demandeBudget: { select: { id: true, numero: true } },
                    ligne: { select: { designation: true } },
                    commande: { select: { id: true, numero: true, fournisseurId: true } },
                    factureFournisseur: { select: { reference: true } },
                    _count: { select: { attachments: true } },
                  },
                },
                lotPaiement: { select: { reference: true, referenceOperateur: true, campagneNom: true, nbBeneficiaires: true, detail: true } },
              },
            },
          },
        }, // Added to include payment history
      },
    });

    if (!facture) {
      return NextResponse.json(
        { error: "Facture non trouvée" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...facture,
      produits: facture.produits.map((p) => ({ ...p, produitId: p.productId })),
    });
  } catch (error) {
    console.error("Erreur lors de la récupération de la facture :", error);
    return NextResponse.json(
      { error: "Erreur Interne du Serveur" },
      { status: 500 }
    );
  }
}

// ---------- Fonction commune mise à jour ----------
async function updateFacture(id: string, body: unknown) {
  console.log(`Début de la mise à jour pour la facture ID: ${id}`);
  console.log("Données reçues:", body);

  const validation = updateInvoiceSchema.safeParse(body);
  if (!validation.success) {
    console.error("Erreur de validation:", validation.error.format());
    return NextResponse.json(
      { error: validation.error.issues.map((i) => i.message).join(" ") },
      { status: 400 }
    );
  }

  console.log("Validation réussie. Données validées:", validation.data);
  const {
    statut, produits, devise, paymentConditionPercentage, objet, gestionnaireId, info, isTaxExempt,
    isDiscountEnabled, discountType, discountValue,
  } = validation.data;

  let previousStatut: StatusFacture | undefined;

  try {
    // Start a transaction
    const updatedFacture = await prisma.$transaction(async (tx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updatedFactureData: any = {};
      const currentInvoice = await tx.invoice.findUnique({ where: { id } });
      if (!currentInvoice) throw new Error("Facture non trouvée pour la mise à jour");
      previousStatut = currentInvoice.statut;

      if (statut) {
        updatedFactureData.statut = statut;
        console.log(`Mise à jour du statut: ${statut}`);

        // Horodatage de la validation — uniquement au moment où le statut passe
        // à "Valider" depuis un autre statut (pas à chaque ré-sauvegarde alors
        // qu'il est déjà "Valider").
        if (statut === "Valider" && currentInvoice.statut !== "Valider") {
          updatedFactureData.dateValidation = new Date();
        }
      }

      if (devise) {
        updatedFactureData.devise = devise;
      }

      if (paymentConditionPercentage !== undefined) {
        updatedFactureData.paymentConditionPercentage = paymentConditionPercentage;
      }

      if (objet) {
        updatedFactureData.objet = objet;
        console.log(`Mise à jour de l'objet: ${objet}`);
      }
      if (info) {
        updatedFactureData.info = info;
        console.log(`Mise à jour de l'objet: ${info}`);
      }
       if (isTaxExempt !== undefined) {
        updatedFactureData.isTaxExempt = isTaxExempt;
      }


      // Handle gestionnaire update
      if (gestionnaireId !== undefined) {
        await tx.invoiceGestionnaire.deleteMany({ where: { invoiceId: id } });
        if (gestionnaireId) { // if not null
          await tx.invoiceGestionnaire.create({
            data: {
              invoiceId: id,
              gestionnaireId: gestionnaireId,
            },
          });
        }
        console.log(`Mise à jour du gestionnaire pour la facture ${id}`);
      }

      if (
        produits || isTaxExempt !== undefined ||
        isDiscountEnabled !== undefined || discountType !== undefined || discountValue !== undefined
      ) {
        console.log("Mise à jour des produits, de l'exonération de taxe ou de la remise et calcul des totaux.");

        const finalIsTaxExempt = isTaxExempt ?? currentInvoice.isTaxExempt;
        const finalIsDiscountEnabled = isDiscountEnabled ?? currentInvoice.isDiscountEnabled;
        const finalDiscountType = discountType ?? currentInvoice.discountType;
        const finalDiscountValue = discountValue ?? Number(currentInvoice.discountValue);

        const totalHT = produits ? produits.reduce((acc, p) => acc + computeLineTotal(p), 0) : Number(currentInvoice.totalHT);

        const discountAmount = finalIsDiscountEnabled
          ? Math.min(
              finalDiscountType === "MONTANT" ? finalDiscountValue : totalHT * (finalDiscountValue / 100),
              totalHT
            )
          : 0;
        const totalHTApresRemise = totalHT - discountAmount;
        const montantTVA = finalIsTaxExempt ? 0 : totalHTApresRemise * 0.18;
        const totalTTC = totalHTApresRemise + montantTVA;

        console.log(`Nouveaux totaux calculés: HT=${totalHT}, Remise=${discountAmount}, TVA_amount=${montantTVA}, TTC=${totalTTC}`);

        updatedFactureData.isDiscountEnabled = finalIsDiscountEnabled;
        updatedFactureData.discountType = finalDiscountType;
        updatedFactureData.discountValue = finalIsDiscountEnabled ? finalDiscountValue : 0;
        updatedFactureData.discountAmount = discountAmount;

        const payments = await tx.paiement.findMany({
          where: { invoiceId: id, type: 'PAIEMENT' },
        });
        const totalPaid = payments.reduce((acc, p) => acc + p.montant.toNumber(), 0);
        let resteAPayer = Math.round((totalTTC - totalPaid) * 100) / 100;

        // ✅ Sécurité pour le XOF : si moins de 1, c'est soldé
        if (resteAPayer < 1) resteAPayer = 0;

        updatedFactureData.resteAPayer = resteAPayer;
        updatedFactureData.totalHT = totalHT;
        updatedFactureData.tva = montantTVA;
        updatedFactureData.totalTTC = totalTTC;
        
        if (resteAPayer <= 0 && totalPaid > 0) {
          if (currentInvoice.statut !== 'Annuler') {
            updatedFactureData.statut = 'Solde';
            console.log(`Statut mis à jour à 'Solde' car resteAPayer=${resteAPayer}`);
          }
        } else if (totalPaid > 0 && resteAPayer > 0) {
          updatedFactureData.statut = 'Payer';
        }

        // Product updates only if they are provided
        if (produits) {
          await tx.invoiceProduit.deleteMany({ where: { invoiceId: id } });

          for (const p of produits) {
            await tx.invoiceProduit.create({
              data: {
                invoiceId: id,
                productId: p.produitId,
                designation: p.designation,
                quantite: toNumber(p.quantite),
                prixUnitaire: toNumber(p.prixUnitaire),
                duree: p.duree ? toNumber(p.duree) : 0,
                uniteDuree: p.uniteDuree ?? "jour",
                montantTotal: Math.round(computeLineTotal(p)),
                includeduree: p.includeduree ?? false,
              },
            });
          }
          console.log("Produits de la facture mis à jour.");
        }
      }

      // Final invoice update
      const finalUpdate = await tx.invoice.update({
        where: { id },
        data: updatedFactureData,
        include: {
          produits: { include: { produit: true } },
          client: true,
          gestionnaires: { include: { gestionnaire: true } },
          bonCommande: true,
          factureNormaliser: true,
        },
      });

      return finalUpdate;
    }, {
      timeout: 15000, // 15 seconds
    });

    console.log("Mise à jour de la facture réussie.");

    // Envoi de la notification interne uniquement lors du passage au statut "Valider"
    if (
      statut === "Valider" &&
      previousStatut !== "Valider" &&
      updatedFacture.statut === "Valider"
    ) {
      sendProformaValidatedNotification(updatedFacture).catch((emailError) => {
        console.error(
          "Erreur lors de l'envoi de la notification de validation de proforma :",
          emailError
        );
      });
    }

    return NextResponse.json(updatedFacture);

  } catch (error: Error | unknown) {
    console.error("Erreur lors de la mise à jour de la facture :", error);
    return NextResponse.json(
      { error: "Erreur Interne du Serveur", details: (error as Error).message || error },
      { status: 500 }
    );
  }
}

// ---------- PATCH / PUT ----------
export async function PATCH(
  request: NextRequest,
  {params}: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  return updateFacture(id, body);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await request.json();
  return updateFacture(id, body);
}

// ---------- DELETE ----------
export async function DELETE(
  request: NextRequest,
  {params}: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await prisma.invoiceProduit.deleteMany({ where: { invoiceId: id } });
    await prisma.invoiceGestionnaire.deleteMany({ where: { invoiceId: id } });
    // Also delete bonCommande and factureNormaliser if they exist
    await prisma.bonCommande.deleteMany({ where: { invoiceId: id } });
    await prisma.factureNormaliser.deleteMany({ where: { invoiceId: id } });

    await prisma.invoice.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Erreur lors de la suppression de la facture :", error);
    return NextResponse.json(
      { error: "Erreur Interne du Serveur" },
      { status: 500 }
    );
  }
}