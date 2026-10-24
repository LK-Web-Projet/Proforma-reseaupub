import { mkdir, writeFile } from "fs/promises";
import path from "path";

export interface SavedDocument {
  url: string;
  fileName: string;
  fileType: string;
}

// 10 Mo — garde-fou côté serveur (une vérification indépendante existe aussi côté client
// dans FournisseurDocuments.tsx, qui ne peut pas importer ce module Node-only).
const MAX_FOURNISSEUR_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

export async function saveFournisseurDocuments(fournisseurId: string, files: File[]): Promise<SavedDocument[]> {
  if (files.length === 0) return [];

  for (const file of files) {
    if (file.size > MAX_FOURNISSEUR_DOCUMENT_SIZE_BYTES) {
      throw new Error(`Le fichier "${file.name}" dépasse la taille maximale autorisée (10 Mo).`);
    }
  }

  const uploadDir = path.join(process.cwd(), "public", "Upload", "FournisseurDocument", fournisseurId);
  await mkdir(uploadDir, { recursive: true });

  const saved: SavedDocument[] = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
    await writeFile(path.join(uploadDir, filename), buffer);
    saved.push({
      url: `/Upload/FournisseurDocument/${fournisseurId}/${filename}`,
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
