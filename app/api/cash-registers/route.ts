import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
