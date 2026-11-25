import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { assertAllowedUpload, safeUploadFileName } from "@/lib/uploadSecurity";
import { DOSSIER_DOCUMENT_PROFORMA, type TypeDocumentProformaValue } from "@/lib/proformaPieces";

/**
 * Enregistre une pièce de proforma sur le disque, au même endroit qu'avant la table unique :
 * public/Upload/<Bon|Facture|Attestation|Autre>/<numéro de proforma>/<fichier>. Un fichier du même
 * nom déjà présent n'est pas écrasé (préfixe horaire). Renvoie l'adresse publique.
 */
export async function saveDocumentProforma(
  file: File,
  type: TypeDocumentProformaValue,
  numeroProforma: string
): Promise<{ url: string; fileName: string; fileType: string }> {
  assertAllowedUpload(file);
  const dossier = DOSSIER_DOCUMENT_PROFORMA[type];
  // Le numéro contient une barre (RP-PRO-25/09-0015) : sous-dossiers, comme avant.
  const segments = numeroProforma.split("/").map((s) => safeUploadFileName(s));
  const repertoire = path.join(process.cwd(), "public", "Upload", dossier, ...segments);
  await mkdir(repertoire, { recursive: true });
  let nom = safeUploadFileName(file.name);
  if (existsSync(path.join(repertoire, nom))) nom = `${Date.now()}-${nom}`;
  await writeFile(path.join(repertoire, nom), Buffer.from(await file.arrayBuffer()));
  return { url: `/Upload/${dossier}/${segments.join("/")}/${nom}`, fileName: file.name, fileType: file.type };
}
