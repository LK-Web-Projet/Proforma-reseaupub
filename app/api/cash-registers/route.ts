import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getBudgetCapabilities } from '@/lib/budgetAuth';
import { requirePage, requirePermission } from '@/lib/authz';

// GET /api/cash-registers — liste des caisses (id, nom, solde), pour choisir la caisse
// d'une dépense (ex. enregistrement d'une dépense de budget).
export async function GET() {
  // Soldes de toutes les caisses : réservé au comptable (droit budget « Enregistrer les dépenses »)
  // ou à un rôle ayant la section Finance.
  const caps = await getBudgetCapabilities();
  if (!caps?.canPay) {
    const refus = await requirePage('finance');
    if (refus) return refus;
  }
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

// POST — créer une caisse : réservé au droit « Saisir au journal de caisse ».
export async function POST(request: Request) {
  const droitsAcces = await requirePermission("finance.caisses");
  if (droitsAcces instanceof NextResponse) return droitsAcces;
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
