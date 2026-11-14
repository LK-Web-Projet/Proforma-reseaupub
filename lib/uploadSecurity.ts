import path from "path";

/**
 * Sécurité des fichiers envoyés par les utilisateurs (audit budget du 2026-11-14).
 * Deux risques couverts, pour TOUS les envois de l'application :
 *  1. Traversée de dossier : le nom envoyé par le navigateur est contrôlé par le client
 *     (« ../../../x » est transmis tel quel) — on ne garde que le nom de base, nettoyé.
 *  2. Fichier actif servi depuis le site : les fichiers vont dans /public et sont ouverts dans
 *     l'aperçu (iframe) — un .html / .svg / .js y exécuterait du code avec la session de celui
 *     qui l'ouvre. Seuls les formats documentaires et images ci-dessous sont acceptés.
 */
export const ALLOWED_UPLOAD_EXTENSIONS = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "heic",
  "heif",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "odt",
  "ods",
  "csv",
  "txt",
] as const;

export const ALLOWED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"] as const;

export function fileExtension(name: string): string {
  return path.extname(path.basename(name.replace(/\\/g, "/"))).slice(1).toLowerCase();
}

/**
 * Nom de fichier sûr : nom de base uniquement (aucun séparateur de dossier), caractères
 * limités aux lettres / chiffres / . _ -, pas de point initial, 120 caractères maximum
 * en conservant l'extension.
 */
export function safeUploadFileName(original: string): string {
  const base = path.basename((original || "").replace(/\\/g, "/"));
  const ext = fileExtension(base);
  const stem = (ext ? base.slice(0, -(ext.length + 1)) : base)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^[._]+/, "")
    .slice(0, 110);
  return `${stem || "fichier"}${ext ? `.${ext}` : ""}`;
}

export class UploadRejectedError extends Error {}

/** Refuse un fichier dont l'extension n'est pas dans la liste autorisée. */
export function assertAllowedUpload(
  file: { name: string },
  allowed: readonly string[] = ALLOWED_UPLOAD_EXTENSIONS
): void {
  const ext = fileExtension(file.name);
  if (!ext || !allowed.includes(ext)) {
    throw new UploadRejectedError(
      `Le fichier "${path.basename(file.name)}" n'est pas accepté. Formats autorisés : ${allowed.join(", ")}.`
    );
  }
}
