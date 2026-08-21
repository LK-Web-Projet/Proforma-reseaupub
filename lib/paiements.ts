import { OperationType, PaiementType, Prisma } from "@prisma/client";
import { safeCreatedById } from "@/lib/authz";

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
 * Enregistre une dépense rattachée à une facture (proforma) : calcule le nouveau solde de la
 * caisse choisie, crée UNE SEULE entrée CashJournal (type DEPENSE), met à jour
 * CashRegister.balance, puis crée le Paiement (type DEPENSE) lié à cette entrée via
 * cashJournalEntryId. Le lien Paiement <-> CashJournal garantit qu'il n'y a jamais deux
 * écritures pour une même dépense.
 * Ne modifie pas Invoice.resteAPayer/statut (seul le type PAIEMENT les modifie).
 * Doit être appelé à l'intérieur d'une transaction Prisma pour rester atomique.
 */
export async function recordDepensePaiement(
  tx: Prisma.TransactionClient,
  { invoiceId, cashRegisterId, montant, libelle, date_operation, methode, reference, notes, createdById }: RecordDepensePaiementInput
) {
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

  const newBalance = currentBalance - montant;
  const safeCreatorId = await safeCreatedById(tx, createdById);

  const cashJournalEntry = await tx.cashJournal.create({
    data: {
      date_operation,
      libelle,
      type: OperationType.DEPENSE,
      montant,
      solde: newBalance,
      isApportDeCaisse: false,
      cashRegisterId,
      createdById: safeCreatorId,
    },
  });

  await tx.cashRegister.update({
    where: { id: cashRegisterId },
    data: { balance: newBalance },
  });

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
