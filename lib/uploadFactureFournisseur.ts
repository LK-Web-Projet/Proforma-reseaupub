import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { assertAllowedUpload, safeUploadFileName } from "@/lib/uploadSecurity";

export async function saveFactureFournisseurPieceJointe(file: File): Promise<string> {
  assertAllowedUpload(file);
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${Date.now()}-${safeUploadFileName(file.name)}`;
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

/**
 * Traduit une erreur système (fs) en message compréhensible, pour éviter de renvoyer
 * un "Erreur interne du serveur" générique quand la cause est un souci de disque/permissions
 * côté serveur (fréquent en production, invisible en local).
 */
export function describeFsError(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return null;
  }

  switch ((error as { code?: string }).code) {
    case "EACCES":
    case "EPERM":
      return "Le serveur n'a pas la permission d'écrire le fichier dans le dossier d'upload. Vérifiez les droits d'accès sur le dossier public/Upload/FactureFournisseur.";
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
