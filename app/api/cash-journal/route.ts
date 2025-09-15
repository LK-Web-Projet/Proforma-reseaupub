import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const cashJournalEntries = await prisma.cashJournal.findMany({
      orderBy: {
        date_operation: 'asc',
      },
    });
    return NextResponse.json(cashJournalEntries);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'An error occurred while fetching cash journal entries.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { libelle, type, montant, date_operation } = await request.json();

    if (!libelle || !type || !montant || !date_operation) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const lastEntry = await prisma.cashJournal.findFirst({
      orderBy: {
        date_operation: 'desc',
      },
    });

    const previousSolde = lastEntry ? lastEntry.solde : 0;
    const newSolde = type === 'RECETTE' ? previousSolde + montant : previousSolde - montant;

    const newEntry = await prisma.cashJournal.create({
      data: {
        libelle,
        type,
        montant,
        date_operation: new Date(date_operation),
        solde: newSolde,
      },
    });

    return NextResponse.json(newEntry, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'An error occurred while creating the cash journal entry.' }, { status: 500 });
  }
}
