import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { StatusFacture } from "@prisma/client";

// ---------- Schéma de validation ----------
const productSchema = z.object({
  id: z.string().optional(),
  produitId: z.string().optional(),
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
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

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

    return NextResponse.json(facture);
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
      { error: validation.error.format() },
      { status: 400 }
    );
  }

  console.log("Validation réussie. Données validées:", validation.data);
  const { statut, produits, devise, paymentConditionPercentage, objet, gestionnaireId, info, isTaxExempt } = validation.data;

  try {
    // Start a transaction
    const updatedFacture = await prisma.$transaction(async (tx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updatedFactureData: any = {};
      const currentInvoice = await tx.invoice.findUnique({ where: { id } });
      if (!currentInvoice) throw new Error("Facture non trouvée pour la mise à jour");

      if (statut) {
        updatedFactureData.statut = statut;
        console.log(`Mise à jour du statut: ${statut}`);
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

      if (produits || isTaxExempt !== undefined) {
        console.log("Mise à jour des produits ou de l'exonération de taxe et calcul des totaux.");
        
        const finalIsTaxExempt = isTaxExempt ?? currentInvoice.isTaxExempt;

        const totalHT = produits ? produits.reduce((acc, p) => acc + computeLineTotal(p), 0) : Number(currentInvoice.totalHT);
        const montantTVA = finalIsTaxExempt ? 0 : totalHT * 0.18;
        const totalTTC = totalHT + montantTVA;

        console.log(`Nouveaux totaux calculés: HT=${totalHT}, TVA_amount=${montantTVA}, TTC=${totalTTC}`);

        const payments = await tx.paiement.findMany({
          where: { invoiceId: id, type: 'PAIEMENT' },
        });
        const totalPaid = payments.reduce((acc, p) => acc + p.montant, 0);
        const resteAPayer = totalTTC - totalPaid;

        updatedFactureData.resteAPayer = resteAPayer;
        updatedFactureData.totalHT = totalHT;
        updatedFactureData.tva = montantTVA;
        updatedFactureData.totalTTC = totalTTC;
        
        if (resteAPayer <= 0 && totalPaid > 0) {
          if (currentInvoice.statut !== 'Annuler') {
            updatedFactureData.statut = 'Solde';
            console.log(`Statut mis à jour à 'Solde' car resteAPayer=${resteAPayer}`);
          }
        }

        // Product updates only if they are provided
        if (produits) {
          await tx.invoiceProduit.deleteMany({ where: { invoiceId: id } });

          for (const p of produits) {
            let productId = p.produitId;

            if (!productId && p.designation) {
              const product = await tx.produit.upsert({
                where: { nom: p.designation },
                update: { prixUnitaire: toNumber(p.prixUnitaire) },
                create: {
                  nom: p.designation,
                  prixUnitaire: toNumber(p.prixUnitaire),
                },
              });
              productId = product.id;
            }

            if (productId) {
              await tx.invoiceProduit.create({
                data: {
                  invoiceId: id,
                  productId: productId,
                  designation: p.designation,
                  quantite: toNumber(p.quantite),
                  prixUnitaire: toNumber(p.prixUnitaire),
                  duree: p.duree ? toNumber(p.duree) : 0,
                  uniteDuree: p.uniteDuree ?? undefined,
                  montantTotal: Math.round(computeLineTotal(p)),
                  includeduree: p.includeduree ?? false,
                },
              });
            }
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
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
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
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

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