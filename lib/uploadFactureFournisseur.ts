import { mkdir, writeFile } from "fs/promises";
import path from "path";

export async function saveFactureFournisseurPieceJointe(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
  const uploadDir = path.join(
    process.cwd(),
    "public",
    "Upload",
    "FactureFournisseur",
  );

  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, filename), buffer);

  return `/Upload/FactureFournisseur/${filename}`;
}
