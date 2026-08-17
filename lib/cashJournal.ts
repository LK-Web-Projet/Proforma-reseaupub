import { OperationType, Prisma } from "@prisma/client";

interface RecordCashMovementInput {
  cashRegisterId: number;
  type: typeof OperationType.RECETTE | typeof OperationType.DEPENSE;
  montant: number;
  libelle: string;
  date_operation: Date;
  isApportDeCaisse?: boolean;
}

/**
 * Enregistre un mouvement de caisse (RECETTE ou DEPENSE, hors TRANSFERT) : calcule le nouveau
 * solde de la caisse à partir de la dernière entrée du journal, crée l'entrée CashJournal
 * correspondante, et met à jour CashRegister.balance en conséquence.
 * Doit être appelé à l'intérieur d'une transaction Prisma pour rester atomique.
 */
export async function recordCashMovement(
  tx: Prisma.TransactionClient,
  { cashRegisterId, type, montant, libelle, date_operation, isApportDeCaisse }: RecordCashMovementInput
) {
  const lastEntry = await tx.cashJournal.findFirst({
    where: { cashRegisterId },
    orderBy: { id: "desc" },
  });

  const lastBalance = lastEntry ? lastEntry.solde : 0;
  const newBalance = type === OperationType.RECETTE ? lastBalance + montant : lastBalance - montant;

  const newEntry = await tx.cashJournal.create({
    data: {
      libelle,
      type,
      montant,
      date_operation,
      solde: newBalance,
      cashRegisterId,
      isApportDeCaisse: type === OperationType.RECETTE ? (isApportDeCaisse || false) : false,
    },
  });

  await tx.cashRegister.update({
    where: { id: cashRegisterId },
    data: { balance: newBalance },
  });

  return newEntry;
}
