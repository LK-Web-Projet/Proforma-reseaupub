import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/cash-registers — liste des caisses (id, nom, solde), pour choisir la caisse
// d'une dépense (ex. enregistrement d'une dépense de budget).
export async function GET() {
  try {
    const registers = await prisma.cashRegister.findMany({
      select: { id: true, name: true, balance: true },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(registers);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Impossible de récupérer les caisses.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json();

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Cash register name cannot be empty.' }, { status: 400 });
    }

    const existingRegister = await prisma.cashRegister.findUnique({
      where: { name: name.trim() },
    });

    if (existingRegister) {
      return NextResponse.json({ error: 'A cash register with this name already exists.' }, { status: 409 });
    }

    const newCashRegister = await prisma.cashRegister.create({
      data: {
        name: name.trim(),
        balance: 0, // New cash registers start with a 0 balance
      },
    });

    return NextResponse.json(newCashRegister, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'An error occurred while creating the cash register.' }, { status: 500 });
  }
}
