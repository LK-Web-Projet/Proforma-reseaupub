import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCaisseUser } from '@/lib/budgetAuth';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Masquer / réafficher une caisse : réservé au droit « Saisir au journal de caisse ».
  const caps = await requireCaisseUser();
  if (caps instanceof NextResponse) return caps;
  try {
    const { view } = await request.json();
    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);

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
