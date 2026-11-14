import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { ALLOWED_IMAGE_EXTENSIONS, assertAllowedUpload, safeUploadFileName } from "@/lib/uploadSecurity";

export interface SavedPhoto {
  url: string;
  fileName: string;
  fileType: string;
}

export async function saveProduitFournisseurPhotos(produitId: string, files: File[]): Promise<SavedPhoto[]> {
  if (files.length === 0) return [];
  // Photos de produit : images uniquement.
  for (const file of files) assertAllowedUpload(file, ALLOWED_IMAGE_EXTENSIONS);

  const uploadDir = path.join(process.cwd(), "public", "Upload", "ProduitFournisseur", produitId);
  await mkdir(uploadDir, { recursive: true });

  const saved: SavedPhoto[] = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = `${Date.now()}-${safeUploadFileName(file.name)}`;
    await writeFile(path.join(uploadDir, filename), buffer);
    saved.push({
      url: `/Upload/ProduitFournisseur/${produitId}/${filename}`,
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
