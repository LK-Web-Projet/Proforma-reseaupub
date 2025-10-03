
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
  const file: File | null = data.get("file") as unknown as File;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Define the upload directory and create it if it doesn't exist
  const uploadDir = join(process.cwd(), "public", "Upload", "CashJournal", String(cashJournalId));
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }

  // Define the file path
  const path = join(uploadDir, file.name);
  await writeFile(path, buffer);
  console.log(`File uploaded to ${path}`);

  // Create a corresponding entry in the database
  const fileUrl = join("/", "Upload", "CashJournal", String(cashJournalId), file.name).replace(/\\/g, "/");

  try {
    const attachment = await prisma.cashJournalAttachment.create({
      data: {
        cashJournalId: cashJournalId,
        url: fileUrl,
        fileName: file.name,
        fileType: file.type,
      },
    });
    return NextResponse.json({ success: true, attachment });
  } catch (error) {
    console.error("Error creating attachment in DB:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
