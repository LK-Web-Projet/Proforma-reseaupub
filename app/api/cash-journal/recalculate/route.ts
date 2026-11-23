import { requirePermission } from "@/lib/authz";
import { NextResponse } from 'next/server';
import { OperationType } from '@prisma/client';
import prisma from '@/lib/prisma';


// Recalcule tous les soldes du journal : réservé au droit « Saisir au journal de caisse ».
export async function POST() {
  const droitsAcces = await requirePermission("finance.recalculer");
  if (droitsAcces instanceof NextResponse) return droitsAcces;
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
      switch (entry.type) {
        case OperationType.RECETTE:
          currentBalance += entry.montant;
          break;

        case OperationType.DEPENSE:
          currentBalance -= entry.montant;
          break;

        case OperationType.TRANSFERT:
          // Aucun impact direct sur le solde
          break;
      }

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
