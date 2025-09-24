import { NextResponse } from 'next/server';
import { PrismaClient, OperationType } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cashRegisterId = searchParams.get('cashRegisterId');

    const cashRegisters = await prisma.cashRegister.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    let cashJournalEntries;
    if (cashRegisterId) {
      cashJournalEntries = await prisma.cashJournal.findMany({
        where: {
          cashRegisterId: parseInt(cashRegisterId),
        },
        orderBy: [
          {
            date_operation: 'asc',
          },
          {
            createdAt: 'asc',
          },
        ],
        include: {
          cashRegister: { select: { name: true } },
        },
      });
    } else {
      cashJournalEntries = await prisma.cashJournal.findMany({
        orderBy: [
          {
            date_operation: 'asc',
          },
          {
            createdAt: 'asc',
          },
        ],
        include: {
          cashRegister: { select: { name: true } },
        },
      });
    }

    return NextResponse.json({ cashRegisters, cashJournalEntries });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'An error occurred while fetching cash journal data.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { libelle, type, montant, date_operation, cashRegisterId, destinationCashRegisterId, isApportDeCaisse: isApportDeCaisseFromFrontend } = body;

    if (!libelle || !type || !montant || !date_operation || !cashRegisterId) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const parsedCashRegisterId = parseInt(cashRegisterId);
    const parsedMontant = parseFloat(montant);
    const parsedDateOperation = new Date(date_operation);

    // Fetch target register(s) outside the transaction to reduce transaction time
    const sourceRegister = await prisma.cashRegister.findUnique({
      where: { id: parsedCashRegisterId },
    });

    if (!sourceRegister) {
      return NextResponse.json({ error: `Source cash register with ID ${parsedCashRegisterId} not found.` }, { status: 404 });
    }

    let destinationRegister = null;
    if (type === OperationType.TRANSFERT) {
      if (!destinationCashRegisterId || parsedCashRegisterId === parseInt(destinationCashRegisterId)) {
        return NextResponse.json({ error: 'Destination cash register is required and must be different from source for transfers.' }, { status: 400 });
      }
      const parsedDestinationCashRegisterId = parseInt(destinationCashRegisterId);
      destinationRegister = await prisma.cashRegister.findUnique({
        where: { id: parsedDestinationCashRegisterId },
      });

      if (!destinationRegister) {
        return NextResponse.json({ error: `Destination cash register with ID ${parsedDestinationCashRegisterId} not found.` }, { status: 404 });
      }
    }

    // Use a single transaction for all related operations
    const result = await prisma.$transaction(async (tx) => {
      if (type === OperationType.TRANSFERT) {
        // Deduct from source
        const newSourceBalance = sourceRegister.balance - parsedMontant;
        await tx.cashRegister.update({
          where: { id: parsedCashRegisterId },
          data: { balance: newSourceBalance },
        });
        await tx.cashJournal.create({
          data: {
            libelle: `Transfert vers ${destinationRegister?.name}: ${libelle}`,
            type: OperationType.DEPENSE,
            montant: parsedMontant,
            date_operation: parsedDateOperation,
            solde: newSourceBalance,
            cashRegister: { connect: { id: parsedCashRegisterId } }, // Use connect
            isApportDeCaisse: false, // A DEPENSE from transfer is not an apport
          },
        });

        // Add to destination
        const newDestinationBalance = destinationRegister!.balance + parsedMontant;
        await tx.cashRegister.update({
          where: { id: destinationRegister!.id },
          data: { balance: newDestinationBalance },
        });
        const newEntry = await tx.cashJournal.create({
          data: {
            libelle: `Transfert depuis ${sourceRegister.name}: ${libelle}`,
            type: OperationType.RECETTE,
            montant: parsedMontant,
            date_operation: parsedDateOperation,
            solde: newDestinationBalance,
            cashRegister: { connect: { id: destinationRegister!.id } }, // Use connect
            isApportDeCaisse: true, // A RECETTE from transfer is an apport
          },
        });
        return newEntry;

      } else if (type === OperationType.RECETTE || type === OperationType.DEPENSE) {
        const newBalance = type === OperationType.RECETTE
          ? sourceRegister.balance + parsedMontant
          : sourceRegister.balance - parsedMontant;

        await tx.cashRegister.update({
          where: { id: parsedCashRegisterId },
          data: { balance: newBalance },
        });

        const newEntry = await tx.cashJournal.create({
          data: {
            libelle,
            type: type as OperationType,
            montant: parsedMontant,
            date_operation: parsedDateOperation,
            solde: newBalance,
            cashRegister: { connect: { id: parsedCashRegisterId } }, // Use connect
            isApportDeCaisse: type === OperationType.RECETTE ? (isApportDeCaisseFromFrontend || false) : false, // Only RECETTE can be an apport
          },
        });
        return newEntry;
      } else {
        throw new Error('Invalid operation type.');
      }
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: Error ) {
    console.error(error);
    return NextResponse.json({ error: error.message || 'An error occurred while creating the cash journal entry.' }, { status: 500 });
  }
}
