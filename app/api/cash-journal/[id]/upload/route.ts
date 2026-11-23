import { requirePermission } from "@/lib/authz";
import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import { mkdirSync, existsSync } from "fs";
import prisma from "@/lib/prisma";
import { assertAllowedUpload, safeUploadFileName } from "@/lib/uploadSecurity";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const droitsAcces = await requirePermission("finance.justificatifs");
  if (droitsAcces instanceof NextResponse) return droitsAcces;
  const cashJournalId = await parseInt((await params).id, 10);
  if (isNaN(cashJournalId)) {
    return NextResponse.json(
      { error: "Invalid cash journal ID" },
      { status: 400 },
    );
  }

  const data = await request.formData();
  const files: File[] = data.getAll("files") as File[];

  if (!files || files.length === 0) {
    return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
  }

  try {
    files.forEach((f) => assertAllowedUpload(f));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Fichier refusé." }, { status: 400 });
  }

  const uploadDir = join(
    process.cwd(),
    "public",
    "Upload",
    "CashJournal",
    String(cashJournalId),
  );
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }

  const attachments = [];

  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const safeName = safeUploadFileName(file.name);
    const path = join(uploadDir, safeName);
    await writeFile(path, buffer);

    const fileUrl = join(
      "/",
      "Upload",
      "CashJournal",
      String(cashJournalId),
      safeName,
    ).replace(/\\/g, "/");

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
