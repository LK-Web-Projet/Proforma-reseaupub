import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ModePaiementDemande, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { verifyIntegrationKey } from "@/lib/integrationAuth";
import { isSoldeInsuffisantError } from "@/lib/cashJournal";
import { DepenseError } from "@/lib/depenses/enregistrerDepense";
import { enregistrerLotPaiement } from "@/lib/depenses/enregistrerLotPaiement";

/**
 * Contrat défini côté CampTrack (docs/INTEGRATION_FINANCE_PAIEMENTS_GROUPES.md, fonction
 * createCashJournalDepenseGroupee) — accepté TEL QUEL — plus 4 champs facultatifs propres au
 * budget (ligneBudgetId, comptableEmail, modePaiement, datePaiement). Voir
 * docs/integration/camptrack-paiements-lots.md (instructions pour le développeur CampTrack).
 */
const ligneSchema = z.object({
  numero: z.number().int(),
  reference: z.string().trim().min(1, "Chaque ligne doit avoir une référence."),
  beneficiaire: z.string().trim().min(1, "Chaque ligne doit nommer son bénéficiaire."),
  numeroMomo: z.string().optional().default(""),
  nomCompteMomo: z.string().nullable().optional(),
  typePaiement: z.string().optional().default("AUTRE"),
  montant: z.number().positive("Chaque ligne doit avoir un montant supérieur à 0."),
  libelle: z.string().optional().default(""),
  idPaiement: z.string().optional(),
  idPrestataire: z.string().nullable().optional(),
});

const lotSchema = z.object({
  cashRegisterId: z.number().int().positive("La caisse est requise."),
  proformaId: z.string().optional(),
  reference: z.string().trim().min(1, "La référence du lot est requise."),
  libelle: z.string().trim().min(1, "Le libellé est requis."),
  montant: z.number().positive("Le montant doit être supérieur à 0."),
  campagne: z.object({ id: z.string(), nom: z.string() }),
  referenceOperateur: z.string().trim().optional(),
  lignes: z.array(ligneSchema).min(1, "Le lot doit contenir au moins une ligne.").max(1000, "1 000 lignes au maximum par lot."),
  // Ajouts Proforma (budget) — facultatifs pendant la transition.
  ligneBudgetId: z.string().optional(),
  comptableEmail: z.string().email("comptableEmail invalide.").optional(),
  modePaiement: z.nativeEnum(ModePaiementDemande).default(ModePaiementDemande.MOBILE_MONEY),
  datePaiement: z.string().optional(),
});

/**
 * POST /api/integration/cash-journal/depenses-groupees — CampTrack envoie un lot de paiement des
 * prestataires d'une campagne (un seul appel, une ligne par prestataire). Tout ou rien :
 * - UNE écriture de caisse pour le total (solde contrôlé), le détail des lignes conservé (LotPaiement) ;
 * - campagne avec budget + `ligneBudgetId` : dépense de budget (plafond, séparation des tâches avec
 *   `comptableEmail`) imputée à la proforma ;
 * - campagne avec budget SANS `ligneBudgetId` (transition) : enregistré quand même, marqué « à
 *   rattacher » — le comptable le rattache à une ligne depuis la fiche budget ;
 * - campagne sans budget : dépense sur la proforma ; sans proforma : simple sortie de caisse.
 * Doublon (même `reference`) → 409. Le lot est considéré comme justifié dans CampTrack.
 */
export async function POST(request: NextRequest) {
  const authError = verifyIntegrationKey(request);
  if (authError) return authError;

  const validation = lotSchema.safeParse(await request.json().catch(() => null));
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }
  const lot = validation.data;
  const somme = Math.round(lot.lignes.reduce((s, l) => s + l.montant, 0) * 100) / 100;
  if (Math.abs(somme - lot.montant) > 0.01) {
    return NextResponse.json({ error: `Le montant du lot (${lot.montant}) ne correspond pas à la somme des lignes (${somme}).` }, { status: 400 });
  }
  if (lot.ligneBudgetId && !lot.comptableEmail) {
    return NextResponse.json({ error: "comptableEmail est requis avec ligneBudgetId (séparation des tâches)." }, { status: 400 });
  }

  try {
    const caisse = await prisma.cashRegister.findUnique({ where: { id: lot.cashRegisterId }, select: { id: true } });
    if (!caisse) return NextResponse.json({ error: "Caisse introuvable." }, { status: 404 });
    if (await prisma.lotPaiement.findUnique({ where: { reference: lot.reference }, select: { id: true } })) {
      return NextResponse.json({ error: `Le lot ${lot.reference} est déjà enregistré dans Finance.` }, { status: 409 });
    }
    if (lot.proformaId && !(await prisma.invoice.findUnique({ where: { id: lot.proformaId }, select: { id: true } }))) {
      return NextResponse.json({ error: "Proforma introuvable." }, { status: 404 });
    }

    const dateDepense = lot.datePaiement ? new Date(lot.datePaiement) : new Date();
    const resultat = await prisma.$transaction(
      (tx) =>
        enregistrerLotPaiement(tx, {
          reference: lot.reference,
          referenceOperateur: lot.referenceOperateur,
          proformaId: lot.proformaId,
          campagneId: lot.campagne.id,
          campagneNom: lot.campagne.nom,
          libelle: lot.libelle,
          cashRegisterId: lot.cashRegisterId,
          montant: lot.montant,
          modePaiement: lot.modePaiement,
          dateDepense,
          ligneBudgetId: lot.ligneBudgetId,
          comptableEmail: lot.comptableEmail,
          lignes: lot.lignes,
        }),
      { timeout: 30000 }
    );

    return NextResponse.json(
      {
        cashJournalEntry: { id: resultat.cashJournalEntry.id, montant: resultat.cashJournalEntry.montant, solde: resultat.cashJournalEntry.solde },
        lignes: lot.lignes.map((l) => ({ numero: l.numero, id: l.reference })),
        budgetDepenseId: resultat.budgetDepenseId,
        aRattacher: resultat.aRattacher,
      },
      { status: 201 }
    );
  } catch (error) {
    // Même lot envoyé deux fois en même temps : la contrainte d'unicité a joué.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: `Le lot ${lot.reference} est déjà enregistré dans Finance.` }, { status: 409 });
    }
    if (error instanceof DepenseError || isSoldeInsuffisantError(error)) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
    console.error("Erreur API intégration - dépense groupée:", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
