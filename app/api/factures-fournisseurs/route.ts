
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

// GET /api/factures-fournisseurs - Récupérer toutes les factures fournisseurs
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fournisseurId = searchParams.get('fournisseurId');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const year = searchParams.get('year');

    const where: Prisma.FactureFournisseurWhereInput = {};

    if (fournisseurId) {
      where.fournisseurId = fournisseurId;
    }
    if (status) {
      where.status = status;
    }

    if (year) {
      const parsedYear = parseInt(year, 10);
      where.date = {
        gte: new Date(parsedYear, 0, 1),
        lt: new Date(parsedYear + 1, 0, 1),
      };
    } else if (startDate || endDate) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (startDate) {
        dateFilter.gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.lte = new Date(endDate);
      }
      where.date = dateFilter;
    } else {
      const currentYear = new Date().getFullYear();
      where.date = {
        gte: new Date(currentYear, 0, 1),
        lt: new Date(currentYear + 1, 0, 1),
      };
    }

    const factures = await prisma.factureFournisseur.findMany({
      where,
      include: {
        fournisseur: true, // Inclure les informations du fournisseur lié
      },
      orderBy: {
        date: 'desc',
      },
    });
    return NextResponse.json(factures);
  } catch (error) {
    console.error('Erreur lors de la récupération des factures fournisseurs:', error);
    return NextResponse.json({ message: 'Erreur interne du serveur' }, { status: 500 });
  }
}

// POST /api/factures-fournisseurs - Créer une nouvelle facture fournisseur avec pièce jointe
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    
    const file = formData.get('pieceJointe') as File | null;
    const reference = formData.get('reference') as string;
    const montant = formData.get('montant') as string;
    const date = formData.get('date') as string;
    const fournisseurId = formData.get('fournisseurId') as string;
    const statusValue = formData.get('status');
    const status = typeof statusValue === 'string' ? statusValue : null;

    if (!reference || !montant || !date || !fournisseurId || !status) {
      return NextResponse.json({ message: 'Les champs référence, montant, date, fournisseur et statut sont requis.' }, { status: 400 });
    }

    let pieceJointeUrl: string | null = null;

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const filename = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
      const uploadDir = path.join(process.cwd(), 'public', 'Upload', 'FactureFournisseur');

      // Assurer que le dossier d'upload existe
      await mkdir(uploadDir, { recursive: true });

      await writeFile(path.join(uploadDir, filename), buffer);
      pieceJointeUrl = `/Upload/FactureFournisseur/${filename}`;
    }

    const newFacture = await prisma.factureFournisseur.create({
      data: {
        reference,
        montant: parseFloat(montant),
        date: new Date(date),
        fournisseurId,
        status: status || 'EN_ATTENTE',
        pieceJointe: pieceJointeUrl,
      },
    });

    return NextResponse.json(newFacture, { status: 201 });

  } catch (error) {
    console.error('Erreur lors de la création de la facture fournisseur:', error);
    return NextResponse.json({ message: 'Erreur interne du serveur' }, { status: 500 });
  }
}
