import { NextResponse } from 'next/server';
import { PrismaClient, OperationType } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    // Fetch all cash registers
    const cashRegisters = await prisma.cashRegister.findMany();

    for (const register of cashRegisters) {
      let currentBalance = 0;

      // Fetch all journal entries for the current register, ordered by date and creation time
      const journalEntries = await prisma.cashJournal.findMany({
        where: { cashRegisterId: register.id },
        orderBy: [
          { date_operation: 'asc' },
          { createdAt: 'asc' },
        ],
      });

      // Recalculate solde for each entry and update the entry
      for (const entry of journalEntries) {
        if (entry.type === OperationType.RECETTE) {
          currentBalance += entry.montant;
        } else if (entry.type === OperationType.DEPENSE) {
          currentBalance -= entry.montant;
        } else if (entry.type === OperationType.TRANSFERT) {
          // For transfers, the entry type already reflects RECETTE or DEPENSE
          // so the currentBalance calculation is correct based on the entry's type
          if (entry.type === OperationType.RECETTE) {
            currentBalance += entry.montant;
          } else if (entry.type === OperationType.DEPENSE) {
            currentBalance -= entry.montant;
          }
        }

        // Update the solde for the current journal entry
        await prisma.cashJournal.update({
          where: { id: entry.id },
          data: { solde: currentBalance },
        });
      }

      // Update the final balance for the cash register
      await prisma.cashRegister.update({
        where: { id: register.id },
        data: { balance: currentBalance },
      });
    }

    return NextResponse.json({ message: 'Cash journal recalculation successful.' }, { status: 200 });
  } catch (error) {
    console.error('Error during cash journal recalculation:', error);
    return NextResponse.json({ error: 'An error occurred during cash journal recalculation.' }, { status: 500 });
  }
}
