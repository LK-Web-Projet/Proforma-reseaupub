import { OperationType, Prisma } from "@prisma/client";
import { safeCreatedById } from "@/lib/authz";

/**
 * Verrouille la caisse jusqu'à la fin de la transaction (SELECT … FOR UPDATE).
 * Chaque écriture lit le dernier solde du journal puis écrit le nouveau : sans verrou, deux
 * écritures simultanées sur la même caisse partent du même solde et l'une « efface » l'autre
 * dans le solde courant. Le verrou les fait passer l'une après l'autre. Sans effet hors
 * transaction ; ré-entrant dans une même transaction (verrouiller deux fois ne bloque pas).
 * Pour plusieurs caisses, verrouiller par id croissant (évite les interblocages).
 */
export async function lockCashRegister(tx: Prisma.TransactionClient, cashRegisterId: number) {
  await tx.$queryRaw`SELECT id FROM "CashRegister" WHERE id = ${cashRegisterId} FOR UPDATE`;
}

interface RecordCashMovementInput {
  cashRegisterId: number;
  type: typeof OperationType.RECETTE | typeof OperationType.DEPENSE;
  montant: number;
  libelle: string;
  date_operation: Date;
  isApportDeCaisse?: boolean;
  createdById?: string | null;
}

/** Message (et préfixe reconnu par les routes, pour répondre 400) d'une sortie non couverte par le solde. */
export function messageSoldeInsuffisant(nomCaisse: string | null | undefined, solde: number): string {
  return `Solde insuffisant dans la caisse "${nomCaisse ?? "?"}". Solde actuel: ${solde.toLocaleString("fr-FR")} FCFA.`;
}

export function isSoldeInsuffisantError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("Solde insuffisant");
}

/**
 * Refuse une sortie de caisse que le dernier solde du journal ne couvre pas. À appeler APRÈS
 * lockCashRegister, dans la même transaction (sinon deux sorties simultanées passent toutes deux).
 */
export async function assertSoldeSuffisant(tx: Prisma.TransactionClient, cashRegisterId: number, montant: number) {
  const last = await tx.cashJournal.findFirst({ where: { cashRegisterId }, orderBy: { id: "desc" } });
  const solde = last ? last.solde : 0;
  if (montant > solde) {
    const caisse = await tx.cashRegister.findUnique({ where: { id: cashRegisterId }, select: { name: true } });
    throw new Error(messageSoldeInsuffisant(caisse?.name, solde));
  }
}

/**
 * Enregistre un mouvement de caisse (RECETTE ou DEPENSE, hors TRANSFERT) : calcule le nouveau
 * solde de la caisse à partir de la dernière entrée du journal, crée l'entrée CashJournal
 * correspondante, et met à jour CashRegister.balance en conséquence.
 * Une DEPENSE est refusée si le solde de la caisse ne la couvre pas (contrôle serveur, quel que
 * soit le chemin : saisie manuelle, intégration Camptrack, budget, proforma).
 * Doit être appelé à l'intérieur d'une transaction Prisma pour rester atomique.
 */
export async function recordCashMovement(
  tx: Prisma.TransactionClient,
  { cashRegisterId, type, montant, libelle, date_operation, isApportDeCaisse, createdById }: RecordCashMovementInput
) {
  await lockCashRegister(tx, cashRegisterId);
  if (type === OperationType.DEPENSE) {
    await assertSoldeSuffisant(tx, cashRegisterId, montant);
  }
  const lastEntry = await tx.cashJournal.findFirst({
    where: { cashRegisterId },
    orderBy: { id: "desc" },
  });

  const lastBalance = lastEntry ? lastEntry.solde : 0;
  const newBalance = type === OperationType.RECETTE ? lastBalance + montant : lastBalance - montant;
  const safeCreatorId = await safeCreatedById(tx, createdById);

  const newEntry = await tx.cashJournal.create({
    data: {
      libelle,
      type,
      montant,
      date_operation,
      solde: newBalance,
      cashRegisterId,
      isApportDeCaisse: type === OperationType.RECETTE ? (isApportDeCaisse || false) : false,
      createdById: safeCreatorId,
    },
  });

  await tx.cashRegister.update({
    where: { id: cashRegisterId },
    data: { balance: newBalance },
  });

  return newEntry;
}
