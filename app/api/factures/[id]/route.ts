import { getDroits, peut, refusDroit, requirePermission } from "@/lib/authz";
import { proformaDansPortee } from "@/lib/proformaPortee";
import { droitChangementStatutProforma } from "@/lib/permissions";
import { NextResponse, NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { StatusFacture } from "@prisma/client";
import { sendProformaValidatedNotification } from "@/lib/email/proformaValidation";
import { journaliserProforma, type AuteurHistorique } from "@/lib/proformaHistoriqueServeur";
import { fcfa, libelleStatutProforma } from "@/lib/proformaHistorique";

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
  const droits = await getDroits();
  if (droits instanceof NextResponse) return droits;
  if (!droits.pages.includes("proforma")) {
    return NextResponse.json({ error: "Accès refusé pour cette section." }, { status: 403 });
  }
  const { id } = await params;
  if (!(await proformaDansPortee(prisma, droits, id))) {
    return NextResponse.json({ error: "Cette proforma n'est pas dans votre portée (vous ne voyez que les vôtres)." }, { status: 403 });
  }

  try {
    const facture = await prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        produits: { include: { produit: true } },
        gestionnaires: { include: { gestionnaire: true } },
        // Pièces de la proforma (bon de commande du client, factures normalisées, attestation…).
        documents: { orderBy: { createdAt: "desc" } },
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
async function updateFacture(id: string, body: unknown, auteur: AuteurHistorique | null) {
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
          documents: { orderBy: { createdAt: "desc" } },
        },
      });

      // Historique : ce qui a changé (contenu), puis le statut s'il a changé.
      const libellesChamps: [boolean, string][] = [
        [!!produits, "lignes"],
        [!!objet && objet !== currentInvoice.objet, "objet"],
        [!!devise && devise !== currentInvoice.devise, "devise"],
        [!!info && info !== currentInvoice.info, "informations"],
        [paymentConditionPercentage !== undefined && paymentConditionPercentage !== currentInvoice.paymentConditionPercentage, "conditions de paiement"],
        [isTaxExempt !== undefined && isTaxExempt !== currentInvoice.isTaxExempt, "exonération de TVA"],
        [
          (isDiscountEnabled !== undefined && isDiscountEnabled !== currentInvoice.isDiscountEnabled) ||
            (discountType !== undefined && discountType !== currentInvoice.discountType) ||
            (discountValue !== undefined && discountValue !== Number(currentInvoice.discountValue)),
          "remise",
        ],
        [gestionnaireId !== undefined, "commercial"],
      ];
      const champsModifies = libellesChamps.filter(([change]) => change).map(([, libelle]) => libelle);
      if (champsModifies.length > 0) {
        const totalAvant = Number(currentInvoice.totalTTC);
        const totalApres = Number(finalUpdate.totalTTC);
        await journaliserProforma(
          tx,
          id,
          "MODIFICATION",
          `Modifié : ${champsModifies.join(", ")}${Math.abs(totalApres - totalAvant) > 0.5 ? ` — total TTC ${fcfa(totalAvant)} → ${fcfa(totalApres)}` : ""}`,
          auteur,
          { champs: champsModifies, totalAvant, totalApres }
        );
      }
      if (finalUpdate.statut !== currentInvoice.statut) {
        await journaliserProforma(
          tx,
          id,
          "STATUT",
          `Statut : ${libelleStatutProforma(currentInvoice.statut)} → ${libelleStatutProforma(finalUpdate.statut)}${statut === finalUpdate.statut ? "" : " (recalcul des encaissements)"}`,
          auteur,
          { ancien: currentInvoice.statut, nouveau: finalUpdate.statut }
        );
      }

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

// ---------- Droits d'une modification ----------
// Champs de contenu : les modifier exige « Modifier le contenu ». Le statut suit sa propre
// règle : Validée → « Valider », Annulée (ou sortir d'Annulée) → « Annuler », les autres →
// « Changer le statut ». Payée / Soldée posés automatiquement (encaissements, totaux) ne
// demandent aucun droit : ils découlent de l'enregistrement.
const CHAMPS_CONTENU = [
  "produits", "tva", "devise", "paymentConditionPercentage", "objet", "gestionnaireId", "info",
  "isTaxExempt", "isDiscountEnabled", "discountType", "discountValue",
] as const;

async function modifierAvecDroits(id: string, body: unknown) {
  const droits = await getDroits();
  if (droits instanceof NextResponse) return droits;
  if (!droits.pages.includes("proforma")) return refusDroit("proforma.modifier");

  const actuelle = await prisma.invoice.findUnique({ where: { id }, select: { statut: true } });
  if (!actuelle) return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 });
  if (!(await proformaDansPortee(prisma, droits, id))) {
    return NextResponse.json({ error: "Cette proforma n'est pas dans votre portée (vous ne voyez que les vôtres)." }, { status: 403 });
  }

  const donnees = (body ?? {}) as Record<string, unknown>;
  if (CHAMPS_CONTENU.some((c) => donnees[c] !== undefined) && !peut(droits, "proforma.modifier")) {
    return refusDroit("proforma.modifier");
  }
  const cible = typeof donnees.statut === "string" ? (donnees.statut as StatusFacture) : null;
  const droitNecessaire = cible ? droitChangementStatutProforma(actuelle.statut, cible) : null;
  if (droitNecessaire && !peut(droits, droitNecessaire)) return refusDroit(droitNecessaire);

  const utilisateur = await prisma.user.findUnique({ where: { id: droits.userId }, select: { nom: true } });
  return updateFacture(id, body, { email: droits.email, nom: utilisateur?.nom ?? null });
}

// ---------- PATCH / PUT ----------
export async function PATCH(
  request: NextRequest,
  {params}: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  return modifierAvecDroits(id, body);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await request.json();
  return modifierAvecDroits(id, body);
}

// ---------- DELETE ----------
export async function DELETE(
  request: NextRequest,
  {params}: { params: Promise<{ id: string }> }
) {
  const droitsAcces = await requirePermission("proforma.supprimer");
  if (droitsAcces instanceof NextResponse) return droitsAcces;
  const { id } = await params;
  if (!(await proformaDansPortee(prisma, droitsAcces, id))) {
    return NextResponse.json({ error: "Cette proforma n'est pas dans votre portée (vous ne voyez que les vôtres)." }, { status: 403 });
  }

  try {
    // Suppression réservée à une proforma sans historique : encore en brouillon, sans
    // encaissement ni dépense, sans budget ni bon de commande liés. Sinon, l'annuler.
    const proforma = await prisma.invoice.findUnique({
      where: { id },
      select: {
        statut: true,
        _count: { select: { paiements: true, demandesBudget: true, commandesFournisseur: true, budgetDepenses: true } },
      },
    });
    if (!proforma) {
      return NextResponse.json({ error: "Proforma introuvable." }, { status: 404 });
    }
    const c = proforma._count;
    if (proforma.statut !== "Brouillon" || c.paiements + c.demandesBudget + c.commandesFournisseur + c.budgetDepenses > 0) {
      return NextResponse.json(
        { error: "Cette proforma a déjà un historique (envoyée, encaissement, dépense, budget ou bon de commande) : annulez-la au lieu de la supprimer." },
        { status: 409 }
      );
    }

    await prisma.invoiceProduit.deleteMany({ where: { invoiceId: id } });
    await prisma.invoiceGestionnaire.deleteMany({ where: { invoiceId: id } });
    // Anciennes tables des pièces (conservées jusqu'à leur suppression) ; les pièces et
    // l'historique de la nouvelle table partent avec la proforma.
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