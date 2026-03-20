import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { view } = await request.json();
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const updatedRegister = await prisma.cashRegister.update({
      where: { id },
      data: { view },
    });

    return NextResponse.json(updatedRegister);
  } catch (error) {
    console.error('Failed to update cash register:', error);
    return NextResponse.json({ error: 'Failed to update cash register' }, { status: 500 });
  }
}
