import { requirePermission } from "@/lib/authz";
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';


export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // Masquer / réafficher une caisse : réservé au droit « Saisir au journal de caisse ».
  const droitsAcces = await requirePermission("finance.caisses");
  if (droitsAcces instanceof NextResponse) return droitsAcces;
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
