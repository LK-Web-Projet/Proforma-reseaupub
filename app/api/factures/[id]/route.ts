import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { StatusFacture } from "@prisma/client";

// ---------- Schéma de validation ----------
const productSchema = z.object({
  id: z.string().optional(),
  productId: z.string().min(1, "productId est requis"),
  designation: z.string().min(1, "designation est requise"),
  quantite: z.coerce.number().min(1, "quantité min 1"),
  prixUnitaire: z.coerce.number().min(0, "prix unitaire >= 0"),
  duree: z.coerce.number().min(0).optional(),
  uniteDuree: z.enum(["jour", "heure", "mois"]).optional(),
  includeduree: z.boolean().optional(),
});

const updateInvoiceSchema = z.object({
  statut: z.nativeEnum(StatusFacture).optional(),
  produits: z.array(productSchema).optional(),
  tva: z.coerce.number().min(0).optional(), // pourcentage attendu (ex: 18)
  devise: z.enum(["XOF", "EUR", "USD"]).optional(),
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
  const { statut, produits, tva, devise } = validation.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updatedFactureData: any = {};

      // 1) statut
      if (statut) {
        updatedFactureData.statut = statut;
        console.log(`Mise à jour du statut: ${statut}`);
      }

      if (devise) {
        updatedFactureData.devise = devise;
      }

      // 2) produits + tva (on exige tva si on met à jour les produits pour recalculer)
      if (produits && tva !== undefined) {
        console.log("Mise à jour des produits et calcul des totaux.");

        // calcul total HT (somme des lignes)
        const totalHT = produits.reduce(
          (acc, p) => acc + computeLineTotal(p),
          0
        );
        const montantTVA = totalHT * 0.18;
        const totalTTC = totalHT + montantTVA;

        console.log(
          `Nouveaux totaux calculés: HT=${totalHT}, TVA_amount=${montantTVA}, TTC=${totalTTC}`
        );

        // suppression des anciens produits liés
        await tx.invoiceProduit.deleteMany({ where: { invoiceId: id } });

        // création des nouveaux produits avec montantTotal correct
        const createManyData = produits.map((p) => {
          const montant = Math.round(computeLineTotal(p));
          return {
            invoiceId: id,
            productId: p.productId,
            designation: p.designation,
            quantite: toNumber(p.quantite),
            prixUnitaire: toNumber(p.prixUnitaire),
            duree:
              p.duree === undefined || p.duree === null ? 0 : toNumber(p.duree),
            uniteDuree: p.uniteDuree ?? undefined,
            montantTotal: montant,
            includeduree: p.includeduree ?? false,
          };
        });

        // si createManyData est vide (peu probable), skip createMany
        if (createManyData.length > 0) {
          await tx.invoiceProduit.createMany({ data: createManyData });
        }

        // update des totaux dans la facture
        updatedFactureData.totalHT = totalHT;
        updatedFactureData.tva = montantTVA; // stocke le montant de la TVA
        updatedFactureData.totalTTC = totalTTC;

        // optionnel : si tu as un champ montantTVA dans la table invoice, tu peux le mettre aussi
        // updatedFactureData.montantTVA = montantTVA;
      }

      // 3) update final
      const finalUpdate = await tx.invoice.update({
        where: { id },
        data: updatedFactureData,
        include: {
          produits: { include: { produit: true } },
          client: true,
          gestionnaires: { include: { gestionnaire: true } },
        },
      });

      console.log("Transaction Prisma terminée avec succès.");
      return finalUpdate;
    });

    console.log("Mise à jour de la facture réussie.");
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Erreur lors de la mise à jour de la facture :", error);
    return NextResponse.json(
      { error: "Erreur Interne du Serveur", details: error.message || error },
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
