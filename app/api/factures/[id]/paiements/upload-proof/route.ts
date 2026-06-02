import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { join } from "path";
import { mkdirSync, existsSync } from "fs";
import { writeFile } from "fs/promises";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await params; // Consomme params pour éviter d'autres warnings si nécessaire
    const formData = await request.formData();

    const paiementId = formData.get("paiementId") as string;
    const files = formData.getAll("files") as File[];

    if (!paiementId || files.length === 0) {
      return NextResponse.json(
        { error: "Paiement ID and files are required." },
        { status: 400 },
      );
    }

    const paiement = await prisma.paiement.findUnique({
      where: { id: paiementId },
      include: { cashJournalEntry: true },
    });

    if (!paiement || !paiement.cashJournalEntryId) {
      return NextResponse.json(
        { error: "Paiement or cash journal entry not found." },
        { status: 404 },
      );
    }

    const uploadDir = join(
      process.cwd(),
      "public",
      "Upload",
      "CashJournal",
      String(paiement.cashJournalEntryId),
    );
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }

    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const path = join(uploadDir, file.name);
      await writeFile(path, buffer);

      const fileUrl = join(
        "/",
        "Upload",
        "CashJournal",
        String(paiement.cashJournalEntryId),
        file.name,
      ).replace(/\\/g, "/");

      await prisma.cashJournalAttachment.create({
        data: {
          cashJournalId: paiement.cashJournalEntryId,
          url: fileUrl,
          fileName: file.name,
          fileType: file.type,
        },
      });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Erreur lors de l'upload des preuves:", error);
    return NextResponse.json({ error: "Une erreur interne est survenue." }, { status: 500 });
  }
}
