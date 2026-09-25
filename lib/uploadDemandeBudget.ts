import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { DOCUMENT_UPLOAD_TYPES, DocumentUploadType } from "@/lib/demandeBudgetAttachmentTypes";

export interface SavedFile {
  url: string;
  fileName: string;
  fileType: string;
}

/**
 * Sauvegarde les documents typés soumis dans un FormData (champs `documents_DEVIS`,
 * `documents_FACTURE`, etc. — voir components/DemandeBudgetForm.tsx) et retourne les lignes
 * prêtes pour `prisma.demandeBudgetAttachment.createMany()`.
 */
export async function saveTypedDemandeBudgetAttachments(demandeBudgetId: string, formData: FormData) {
  const rows: (SavedFile & { demandeBudgetId: string; kind: DocumentUploadType })[] = [];

  for (const type of DOCUMENT_UPLOAD_TYPES) {
    const files = formData.getAll(`documents_${type}`) as File[];
    if (files.length === 0) continue;
    const saved = await saveDemandeBudgetFiles(demandeBudgetId, files);
    rows.push(...saved.map((f) => ({ demandeBudgetId, kind: type, ...f })));
  }

  return rows;
}

export async function saveDemandeBudgetFiles(demandeBudgetId: string, files: File[]): Promise<SavedFile[]> {
  if (files.length === 0) return [];

  const uploadDir = path.join(process.cwd(), "public", "Upload", "DemandeBudget", demandeBudgetId);
  await mkdir(uploadDir, { recursive: true });

  const saved: SavedFile[] = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
    await writeFile(path.join(uploadDir, filename), buffer);
    saved.push({
      url: `/Upload/DemandeBudget/${demandeBudgetId}/${filename}`,
      fileName: file.name,
      fileType: file.type,
    });
  }
  return saved;
}

export function describeFsError(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return null;
  }

  switch ((error as { code?: string }).code) {
    case "EACCES":
    case "EPERM":
      return "Le serveur n'a pas la permission d'écrire le fichier dans le dossier d'upload.";
    case "ENOSPC":
      return "Espace disque insuffisant sur le serveur pour enregistrer le fichier.";
    case "EROFS":
      return "Le système de fichiers du serveur est en lecture seule : impossible d'enregistrer le fichier.";
    case "ENOENT":
      return "Le dossier de destination du fichier est introuvable sur le serveur.";
    default:
      return null;
  }
}
