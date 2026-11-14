import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import prisma from '@/lib/prisma';
import { assertAllowedUpload, safeUploadFileName } from '@/lib/uploadSecurity';

const UPLOAD_DIR = 'public/Upload';

async function updateInvoiceStatus(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { bonCommande: true, factureNormaliser: true },
  });

  if (!invoice) return;

  const hasBonCommande = !!invoice.bonCommande;
  const hasFactureNormaliser = !!invoice.factureNormaliser;

  let newStatus: "Valider" | "Payer" | "Envoyer" = invoice.statut as "Valider" | "Payer" | "Envoyer";

  if (hasFactureNormaliser) {
    newStatus = 'Payer';
  } else if (hasBonCommande) {
    newStatus = 'Valider';
  } else {
    newStatus = 'Envoyer';
  }

  if (newStatus !== invoice.statut) {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        statut: newStatus,
        ...(newStatus === 'Valider' && invoice.statut !== 'Valider'
          ? { dateValidation: new Date() }
          : {}),
      },
    });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const invoiceId = (await params).id;
  const data = await request.formData();
  const file: File | null = data.get("file") as unknown as File;
  const type = data.get("type") as "bon" | "facture";

  if (!file || !type) {
    return NextResponse.json({
      success: false,
      message: "Missing file or type",
    });
  }

  try {
    assertAllowedUpload(file);
  } catch (e) {
    return NextResponse.json({ success: false, message: e instanceof Error ? e.message : 'Fichier refusé.' }, { status: 400 });
  }
  const safeName = safeUploadFileName(file.name);

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice) {
    return NextResponse.json({ success: false, message: "Invoice not found" });
  }

  const subfolder = type === "bon" ? "Bon" : "Facture";
  const uploadPath = join(process.cwd(), UPLOAD_DIR, subfolder, invoice.numero);

  if (!existsSync(uploadPath)) {
    mkdirSync(uploadPath, { recursive: true });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const filePath = join(uploadPath, safeName);
  await writeFile(filePath, buffer);

  const fileUrl = `/${subfolder}/${invoice.numero}/${safeName}`;

  if (type === "bon") {
    await prisma.bonCommande.upsert({
      where: { invoiceId },
      update: { url: fileUrl },
      create: {
        invoiceId,
        url: fileUrl,
      },
    });
  } else {
    await prisma.factureNormaliser.upsert({
      where: { invoiceId },
      update: { url: fileUrl },
      create: {
        invoiceId,
        url: fileUrl,
      },
    });
  }

  await updateInvoiceStatus(invoiceId);

  return NextResponse.json({ success: true, url: fileUrl });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const invoiceId = (await params).id;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as "bon" | "facture";

  if (!type) {
    return NextResponse.json({ success: false, message: "Missing type" });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { bonCommande: true, factureNormaliser: true },
  });

  if (!invoice) {
    return NextResponse.json({ success: false, message: "Invoice not found" });
  }

  let fileToDelete = null;
  if (type === "bon" && invoice.bonCommande) {
    fileToDelete = invoice.bonCommande;
    await prisma.bonCommande.delete({ where: { invoiceId } });
  } else if (type === "facture" && invoice.factureNormaliser) {
    fileToDelete = invoice.factureNormaliser;
    await prisma.factureNormaliser.delete({ where: { invoiceId } });
  }

  if (fileToDelete) {
    const filePath = join(process.cwd(), UPLOAD_DIR, fileToDelete.url);
    if (existsSync(filePath)) {
      rmSync(filePath);
    }
  }

  await updateInvoiceStatus(invoiceId);

  return NextResponse.json({ success: true });
}