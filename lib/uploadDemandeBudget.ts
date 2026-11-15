import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { assertAllowedUpload, fileExtension } from "@/lib/uploadSecurity";
import prisma from "@/lib/prisma";
export { UploadRejectedError } from "@/lib/uploadSecurity";
import { DOCUMENT_UPLOAD_TYPES, DocumentUploadType } from "@/lib/demandeBudgetAttachmentTypes";

export interface SavedFile {
  url: string;
  fileName: string;
  fileType: string;
}

// 10 Mo — garde-fou côté serveur (une vérification indépendante existe aussi côté client
// dans les formulaires de demande de budget, qui ne peuvent pas importer ce module Node-only).
// Même limite que lib/uploadFournisseurDocument.ts, pour rester sous la limite du reverse-proxy.
const MAX_DEMANDE_BUDGET_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Nommage normalisé des pièces (procédure de paiement, section 7) :
 * `date_campagne_document_montant`, ex. `2026-11-12_BIIC-DB-2026-0012_Preuve-paiement_350000F.pdf`.
 * « campagne » = client de la première proforma liée (budget de campagne ou pour tiers) suivi du
 * numéro du budget, sinon le numéro seul. Le nom d'origine du fichier n'est pas conservé : c'est ce
 * nom normalisé qui est affiché, pour retrouver une pièce par mots-clés.
 */
export interface NommageDocument {
  date: Date;
  montant: number;
  /** Type de pièce (TypeAttachmentDemande) — détermine le mot « document » du nom. */
  kind?: string;
}

const NOM_DOCUMENT: Record<string, string> = {
  DEVIS: "Devis",
  FACTURE: "Facture",
  BON_COMMANDE: "Bon-commande",
  BUDGET_SIGNE: "Budget-signe",
  PREUVE_PAIEMENT: "Preuve-paiement",
  // Liasse des bons de commande fournisseur (lib/uploadCommandeFournisseur.ts)
  BC_SIGNE: "BC-signe",
  BORDEREAU_LIVRAISON: "Bordereau-livraison",
  ATTESTATION_SERVICE_FAIT: "Attestation-service-fait",
  RAPPORT: "Rapport",
  AUTRE: "Document",
};

export function segmentNom(value: string, max = 40): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max) || "x";
}

async function referenceNommage(demandeBudgetId: string): Promise<string> {
  const demande = await prisma.demandeBudget.findUnique({
    where: { id: demandeBudgetId },
    select: { numero: true, proformas: { take: 1, select: { invoice: { select: { client: { select: { nom: true } } } } } } },
  });
  if (!demande) return segmentNom(demandeBudgetId);
  const client = demande.proformas[0]?.invoice.client?.nom;
  return client ? `${segmentNom(client, 30)}-${segmentNom(demande.numero)}` : segmentNom(demande.numero);
}

/** Nom affiché d'une pièce : date_campagne_document_montant[-n].ext */
export function nomNormalise(reference: string, nommage: NommageDocument, original: string, index = 0): string {
  const date = nommage.date.toISOString().slice(0, 10);
  const document = NOM_DOCUMENT[nommage.kind ?? "AUTRE"] ?? "Document";
  const montant = `${Math.round(nommage.montant)}F`;
  const ext = fileExtension(original);
  return `${date}_${reference}_${document}_${montant}${index > 0 ? `-${index + 1}` : ""}${ext ? `.${ext}` : ""}`;
}

/**
 * Sauvegarde les documents typés soumis dans un FormData (champs `documents_DEVIS`,
 * `documents_FACTURE`, etc. — voir components/DemandeBudgetForm.tsx) et retourne les lignes
 * prêtes pour `prisma.demandeBudgetAttachment.createMany()`.
 */
/**
 * Vérifie les documents typés d'un FormData SANS rien écrire : à appeler avant de créer ou de
 * modifier la demande en base, pour qu'un fichier refusé n'en laisse jamais une à moitié créée.
 */
export function assertTypedAttachmentsAllowed(formData: FormData): void {
  for (const type of DOCUMENT_UPLOAD_TYPES) {
    for (const file of formData.getAll(`documents_${type}`) as File[]) {
      if (file && file.size > 0) assertAllowedUpload(file);
    }
  }
}

export async function saveTypedDemandeBudgetAttachments(
  demandeBudgetId: string,
  formData: FormData,
  nommage: Omit<NommageDocument, "kind">
) {
  const rows: (SavedFile & { demandeBudgetId: string; kind: DocumentUploadType })[] = [];

  for (const type of DOCUMENT_UPLOAD_TYPES) {
    const files = (formData.getAll(`documents_${type}`) as File[]).filter((f) => f && f.size > 0);
    if (files.length === 0) continue;
    const saved = await saveDemandeBudgetFiles(demandeBudgetId, files, { ...nommage, kind: type });
    rows.push(...saved.map((f) => ({ demandeBudgetId, kind: type, ...f })));
  }

  return rows;
}

export async function saveDemandeBudgetFiles(
  demandeBudgetId: string,
  files: File[],
  nommage: NommageDocument
): Promise<SavedFile[]> {
  if (files.length === 0) return [];

  for (const file of files) {
    assertAllowedUpload(file);
    if (file.size > MAX_DEMANDE_BUDGET_FILE_SIZE_BYTES) {
      throw new Error(`Le fichier "${file.name}" dépasse la taille maximale autorisée (10 Mo).`);
    }
  }

  const uploadDir = path.join(process.cwd(), "public", "Upload", "DemandeBudget", demandeBudgetId);
  await mkdir(uploadDir, { recursive: true });

  const reference = await referenceNommage(demandeBudgetId);
  const saved: SavedFile[] = [];
  for (const [index, file] of files.entries()) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const nom = nomNormalise(reference, nommage, file.name, index);
    // Préfixe horodaté sur le disque seulement : deux envois du même jour ne s'écrasent pas.
    const filename = `${Date.now()}-${nom}`;
    await writeFile(path.join(uploadDir, filename), buffer);
    saved.push({
      url: `/Upload/DemandeBudget/${demandeBudgetId}/${filename}`,
      fileName: nom,
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
