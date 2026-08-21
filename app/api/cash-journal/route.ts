import { NextResponse } from 'next/server';
import { PrismaClient, OperationType } from '@prisma/client';
import { auth } from '@clerk/nextjs/server';
import { recordCashMovement } from '@/lib/cashJournal';
import { safeCreatedById } from '@/lib/authz';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cashRegisterId = searchParams.get('cashRegisterId');
    const year = searchParams.get('year');

    const cashRegisters = await prisma.cashRegister.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (cashRegisterId) {
      where.cashRegisterId = parseInt(cashRegisterId);
    }
    
    if (year) {
      const targetYear = parseInt(year, 10);
      where.date_operation = {
        gte: new Date(targetYear, 0, 1),
        lt: new Date(targetYear + 1, 0, 1),
      };
    }

    const cashJournalEntries = await prisma.cashJournal.findMany({
      where,
      orderBy: {
        id: 'asc',
      },
      include: {
        cashRegister: { select: { name: true } },
        attachments: true,
      },
    });

    return NextResponse.json({ cashRegisters, cashJournalEntries });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'An error occurred while fetching cash journal data.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    const body = await request.json();
    const { libelle, type, montant, date_operation, cashRegisterId, destinationCashRegisterId, isApportDeCaisse: isApportDeCaisseFromFrontend } = body;

    if (!libelle || !type || !montant || !date_operation || !cashRegisterId) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const parsedCashRegisterId = parseInt(cashRegisterId);
    const parsedMontant = parseFloat(montant);
    const parsedDateOperation = new Date(date_operation);

    const result = await prisma.$transaction(async (tx) => {
      const createdById = await safeCreatedById(tx, userId);

      if (type === OperationType.TRANSFERT) {
        if (!destinationCashRegisterId || parsedCashRegisterId === parseInt(destinationCashRegisterId)) {
          throw new Error('Destination cash register is required and must be different from source for transfers.');
        }
        const parsedDestinationCashRegisterId = parseInt(destinationCashRegisterId);

        // Handle source register
        const lastSourceEntry = await tx.cashJournal.findFirst({
          where: { cashRegisterId: parsedCashRegisterId },
          orderBy: { id: 'desc' },
        });
        const sourceBalance = lastSourceEntry ? lastSourceEntry.solde : 0;
        const newSourceBalance = sourceBalance - parsedMontant;

        await tx.cashJournal.create({
          data: {
            libelle: `Transfert vers caisse ID ${parsedDestinationCashRegisterId}: ${libelle}`,
            type: OperationType.DEPENSE,
            montant: parsedMontant,
            date_operation: parsedDateOperation,
            solde: newSourceBalance,
            cashRegisterId: parsedCashRegisterId,
            isApportDeCaisse: false,
            createdById,
          },
        });
        await tx.cashRegister.update({
          where: { id: parsedCashRegisterId },
          data: { balance: newSourceBalance },
        });

        // Handle destination register
        const lastDestinationEntry = await tx.cashJournal.findFirst({
          where: { cashRegisterId: parsedDestinationCashRegisterId },
          orderBy: { id: 'desc' },
        });
        const destinationBalance = lastDestinationEntry ? lastDestinationEntry.solde : 0;
        const newDestinationBalance = destinationBalance + parsedMontant;

        const newEntry = await tx.cashJournal.create({
          data: {
            libelle: `Transfert depuis caisse ID ${parsedCashRegisterId}: ${libelle}`,
            type: OperationType.RECETTE,
            montant: parsedMontant,
            date_operation: parsedDateOperation,
            solde: newDestinationBalance,
            cashRegisterId: parsedDestinationCashRegisterId,
            isApportDeCaisse: true,
            createdById,
          },
        });
        await tx.cashRegister.update({
          where: { id: parsedDestinationCashRegisterId },
          data: { balance: newDestinationBalance },
        });

        return newEntry;

      } else if (type === OperationType.RECETTE || type === OperationType.DEPENSE) {
        return recordCashMovement(tx, {
          cashRegisterId: parsedCashRegisterId,
          type,
          montant: parsedMontant,
          libelle,
          date_operation: parsedDateOperation,
          isApportDeCaisse: isApportDeCaisseFromFrontend,
          createdById,
        });
      } else {
        throw new Error('Invalid operation type.');
      }
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: Error | unknown) {
    console.error(error);
    return NextResponse.json({ error: (error as Error).message || 'An error occurred while creating the cash journal entry.' }, { status: 500 });
  }
}
