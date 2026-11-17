import { ModePaiementDemande, Prisma, SourceDepense } from "@prisma/client";
import { recordCashDepense, recordDepensePaiement } from "@/lib/paiements";
import { budgetsDeLaProforma, enregistrerDepense } from "@/lib/depenses/enregistrerDepense";

type Db = Prisma.TransactionClient;

/** Une ligne du lot telle que conservée dans LotPaiement.detail (affichée sur la fiche budget et le journal de caisse). */
export interface LigneLotDetail {
  numero: number;
  reference: string;
  beneficiaire: string;
  numeroMomo?: string;
  nomCompteMomo?: string | null;
  typePaiement?: string;
  montant: number;
  libelle?: string;
  idPaiement?: string;
  idPrestataire?: string | null;
}

export interface EntreeLot {
  reference: string;
  referenceOperateur?: string | null;
  proformaId?: string | null;
  campagneId?: string | null;
  campagneNom?: string | null;
  libelle: string;
  cashRegisterId: number;
  montant: number;
  modePaiement: ModePaiementDemande;
  dateDepense: Date;
  ligneBudgetId?: string | null;
  comptableEmail?: string | null;
  lignes: LigneLotDetail[];
}

/**
 * Lot de paiement de prestataires reçu de CampTrack, quelle que soit la route d'arrivée
 * (`lots-paiement`, contrat actuel de CampTrack, ou `depenses-groupees`, contrat précédent). Tout
 * dans la transaction de l'appelant :
 * - ligne de budget fournie, ou campagne sans budget : enregistrerDepense (source CAMPTRACK, justifiée
 *   dans CampTrack) — écriture de caisse, dépense de budget (plafond, séparation des tâches, budget
 *   signé), dépense sur la proforma ;
 * - campagne avec budget SANS ligne (transition) : sortie de caisse + dépense sur la proforma marquée
 *   « à rattacher » ;
 * - sans proforma : simple sortie de caisse.
 * Puis le détail du lot (LotPaiement, référence unique). Le solde de la caisse est toujours contrôlé.
 */
export async function enregistrerLotPaiement(tx: Db, lot: EntreeLot) {
  const n = lot.lignes.length;
  const budgets = lot.proformaId ? await budgetsDeLaProforma(tx, lot.proformaId) : [];
  let cashJournalEntry: Prisma.CashJournalGetPayload<object>;
  let budgetDepenseId: string | null = null;
  let paiementId: string | null = null;
  let aRattacher = false;

  if (lot.ligneBudgetId || (lot.proformaId && budgets.length === 0)) {
    const d = await enregistrerDepense(tx, {
      source: SourceDepense.CAMPTRACK,
      auteur: { userId: null, email: (lot.comptableEmail ?? "camptrack@integration").toLowerCase(), name: null },
      montant: lot.montant,
      dateDepense: lot.dateDepense,
      cashRegisterId: lot.cashRegisterId,
      nomReceveur: `Lot ${lot.reference} — ${n} prestataire(s)`,
      modePaiement: lot.modePaiement,
      notes: lot.referenceOperateur ? `Référence opérateur : ${lot.referenceOperateur}` : null,
      ligneBudgetId: lot.ligneBudgetId ?? null,
      invoiceId: lot.proformaId ?? null,
      justifieAilleurs: true,
      referenceExterne: lot.reference,
      libelle: lot.libelle,
      methode: lot.modePaiement,
      reference: lot.referenceOperateur ?? lot.reference,
    });
    cashJournalEntry = d.cashJournalEntry;
    budgetDepenseId = d.budgetDepense?.id ?? null;
    paiementId = d.paiement?.id ?? null;
  } else if (lot.proformaId) {
    const r = await recordDepensePaiement(tx, {
      invoiceId: lot.proformaId,
      cashRegisterId: lot.cashRegisterId,
      montant: lot.montant,
      libelle: lot.libelle,
      date_operation: lot.dateDepense,
      methode: lot.modePaiement,
      reference: lot.referenceOperateur ?? lot.reference,
    });
    await tx.paiement.update({ where: { id: r.paiement.id }, data: { aRattacherBudget: true } });
    cashJournalEntry = r.cashJournalEntry;
    paiementId = r.paiement.id;
    aRattacher = true;
  } else {
    cashJournalEntry = await recordCashDepense(tx, {
      cashRegisterId: lot.cashRegisterId,
      montant: lot.montant,
      libelle: lot.libelle,
      date_operation: lot.dateDepense,
    });
  }

  const enregistre = await tx.lotPaiement.create({
    data: {
      reference: lot.reference,
      referenceOperateur: lot.referenceOperateur ?? null,
      proformaId: lot.proformaId ?? null,
      campagneId: lot.campagneId ?? null,
      campagneNom: lot.campagneNom ?? null,
      libelle: lot.libelle,
      nbBeneficiaires: n,
      montant: lot.montant,
      modePaiement: lot.modePaiement,
      detail: lot.lignes as unknown as Prisma.InputJsonValue,
      comptableEmail: lot.comptableEmail?.toLowerCase() ?? null,
      cashJournalEntryId: cashJournalEntry.id,
      budgetDepenseId,
    },
  });
  return { lot: enregistre, cashJournalEntry, budgetDepenseId, paiementId, aRattacher };
}
