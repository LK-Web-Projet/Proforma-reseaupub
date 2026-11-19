import { mkdir, writeFile } from "fs/promises";
import path from "path";
import prisma from "@/lib/prisma";
import { assertAllowedUpload } from "@/lib/uploadSecurity";
import { nomNormalise, segmentNom, type SavedFile } from "@/lib/uploadDemandeBudget";

const TAILLE_MAX = 10 * 1024 * 1024; // 10 Mo, comme les pièces de budget

/**
 * Enregistre les pièces de la liasse d'un bon de commande dans public/Upload/CommandeFournisseur/<id>/
 * (fichiers accessibles seulement connecté, voir middleware.ts), nommées
 * date_campagne_document_montant : « campagne » = client de la proforma liée (ou prestataire) + numéro du BC.
 */
/**
 * `precision` complète le nom normalisé : libellé d'un document « Autre » ; pour une proforma
 * fournisseur, le nom du fournisseur du bon est utilisé par défaut.
 */
export async function saveCommandeFiles(commandeId: string, files: File[], kind: string, precision?: string): Promise<SavedFile[]> {
  if (files.length === 0) return [];
  for (const file of files) {
    assertAllowedUpload(file);
    if (file.size > TAILLE_MAX) throw new Error(`Le fichier "${file.name}" dépasse la taille maximale autorisée (10 Mo).`);
  }
  const commande = await prisma.commandeFournisseur.findUniqueOrThrow({
    where: { id: commandeId },
    select: {
      numero: true,
      montantNet: true,
      fournisseur: { select: { entreprise: true } },
      proformas: { take: 1, select: { invoice: { select: { client: { select: { nom: true } } } } } },
    },
  });
  const campagne = commande.proformas[0]?.invoice.client?.nom ?? commande.fournisseur.entreprise;
  const reference = `${segmentNom(campagne, 30)}-${segmentNom(commande.numero)}`;

  const dossier = path.join(process.cwd(), "public", "Upload", "CommandeFournisseur", commandeId);
  await mkdir(dossier, { recursive: true });
  const saved: SavedFile[] = [];
  for (const [index, file] of files.entries()) {
    const precisionNom = precision || (kind === "PROFORMA_FOURNISSEUR" ? commande.fournisseur.entreprise : undefined);
    const nom = nomNormalise(reference, { date: new Date(), montant: Number(commande.montantNet), kind, precision: precisionNom }, file.name, index);
    const filename = `${Date.now()}-${nom}`;
    await writeFile(path.join(dossier, filename), Buffer.from(await file.arrayBuffer()));
    saved.push({ url: `/Upload/CommandeFournisseur/${commandeId}/${filename}`, fileName: nom, fileType: file.type });
  }
  return saved;
}
