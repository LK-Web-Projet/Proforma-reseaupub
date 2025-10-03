
import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import { mkdirSync, existsSync } from "fs";
import prisma from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cashJournalId = parseInt(params.id, 10);
  if (isNaN(cashJournalId)) {
    return NextResponse.json({ error: "Invalid cash journal ID" }, { status: 400 });
  }

  const data = await request.formData();
  const files: File[] = data.getAll("files") as File[];

  if (!files || files.length === 0) {
    return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
  }

  const uploadDir = join(process.cwd(), "public", "Upload", "CashJournal", String(cashJournalId));
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }

  const attachments = [];

  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const path = join(uploadDir, file.name);
    await writeFile(path, buffer);

    const fileUrl = join("/", "Upload", "CashJournal", String(cashJournalId), file.name).replace(/\\/g, "/");

    const attachment = await prisma.cashJournalAttachment.create({
      data: {
        cashJournalId: cashJournalId,
        url: fileUrl,
        fileName: file.name,
        fileType: file.type,
      },
    });
    attachments.push(attachment);
  }

  return NextResponse.json({ success: true, attachments });
}
