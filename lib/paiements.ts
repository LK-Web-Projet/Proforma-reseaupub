import { OperationType, PaiementType, Prisma } from "@prisma/client";
import { safeCreatedById } from "@/lib/authz";
import { lockCashRegister, recordCashMovement } from "@/lib/cashJournal";

interface RecordCashDepenseInput {
  cashRegisterId: number;
  montant: number;
  libelle: string;
  date_operation: Date;
  createdById?: string | null;
}

/**
 * Enregistre une sortie de caisse (DEPENSE) après avoir vérifié que le solde de la caisse
 * choisie la couvre : refuse la dépense si `montant` dépasse le dernier solde du journal.
 * Utilisé seul pour une dépense non rattachée à une proforma (ex. budget mensuel), et par
 * `recordDepensePaiement` pour une dépense sur proforma.
 * Doit être appelé à l'intérieur d'une transaction Prisma pour rester atomique.
 */
export async function recordCashDepense(
  tx: Prisma.TransactionClient,
  { cashRegisterId, montant, libelle, date_operation, createdById }: RecordCashDepenseInput
) {
  // Verrou AVANT la lecture du solde : le contrôle « solde insuffisant » reste juste en cas
  // de dépenses simultanées sur la même caisse.
  await lockCashRegister(tx, cashRegisterId);
  const lastCashJournalEntry = await tx.cashJournal.findFirst({
    where: { cashRegisterId },
    orderBy: { id: "desc" },
  });
  const currentBalance = lastCashJournalEntry ? lastCashJournalEntry.solde : 0;

  if (montant > currentBalance) {
    const cashRegister = await tx.cashRegister.findUnique({ where: { id: cashRegisterId } });
    throw new Error(
      `Solde insuffisant dans la caisse "${cashRegister?.name}". Solde actuel: ${currentBalance.toLocaleString("fr-FR")} FCFA.`
    );
  }

  return recordCashMovement(tx, {
    cashRegisterId,
    type: OperationType.DEPENSE,
    montant,
    libelle,
    date_operation,
    createdById,
  });
}

interface RecordDepensePaiementInput {
  invoiceId: string;
  cashRegisterId: number;
  montant: number;
  libelle: string;
  date_operation: Date;
  methode?: string;
  reference?: string;
  notes?: string;
  createdById?: string | null;
}

/**
 * Enregistre une dépense rattachée à une facture (proforma) : crée UNE SEULE entrée
 * CashJournal (type DEPENSE, via `recordCashDepense`), puis le Paiement (type DEPENSE) lié
 * à cette entrée via cashJournalEntryId. Le lien Paiement <-> CashJournal garantit qu'il n'y
 * a jamais deux écritures pour une même dépense.
 * Ne modifie pas Invoice.resteAPayer/statut (seul le type PAIEMENT les modifie).
 * Doit être appelé à l'intérieur d'une transaction Prisma pour rester atomique.
 */
export async function recordDepensePaiement(
  tx: Prisma.TransactionClient,
  { invoiceId, cashRegisterId, montant, libelle, date_operation, methode, reference, notes, createdById }: RecordDepensePaiementInput
) {
  const cashJournalEntry = await recordCashDepense(tx, { cashRegisterId, montant, libelle, date_operation, createdById });
  const safeCreatorId = await safeCreatedById(tx, createdById);

  const paiement = await tx.paiement.create({
    data: {
      invoiceId,
      montant,
      type: PaiementType.DEPENSE,
      datePaiement: date_operation,
      methode,
      reference,
      notes,
      cashJournalEntryId: cashJournalEntry.id,
      createdById: safeCreatorId,
    },
  });

  return { paiement, cashJournalEntry };
}
