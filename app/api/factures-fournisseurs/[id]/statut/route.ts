import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getDroits, peut, reponseMigrationManquante, requireAnyPage } from "@/lib/authz";
import { isStatutFacture } from "@/lib/factureStatut";
import { appliquerStatutFacture, controlerStatutFacture, StatutFactureError, type DemandeStatutFacture } from "@/lib/factureStatutServeur";
import { describeFsError, saveFactureFournisseurPieceJointe } from "@/lib/uploadFactureFournisseur";

const texte = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : null);

/**
 * GET /api/factures-fournisseurs/[id]/statut — historique des changements de statut faits à la main
 * (du plus récent au plus ancien), et le paiement hors plateforme en cours s'il y en a un.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const refus = await requireAnyPage(["fournisseurs"]);
  if (refus) return refus;
  const { id } = await params;
  try {
    const facture = await prisma.factureFournisseur.findUnique({
      where: { id },
      select: {
        id: true,
        reference: true,
        status: true,
        paiementManuelDate: true,
        paiementManuelPreuve: true,
        paiementManuelReference: true,
        paiementManuelParEmail: true,
        paiementManuelMoyen: { select: { code: true, nom: true } },
        historiqueStatut: {
          orderBy: { createdAt: "desc" },
          include: { moyenPaiement: { select: { nom: true } } },
        },
      },
    });
    if (!facture) return NextResponse.json({ message: "Facture introuvable." }, { status: 404 });
    return NextResponse.json(facture);
  } catch (error) {
    const migration = reponseMigrationManquante(error);
    if (migration) return migration;
    console.error("Erreur lors de la lecture de l'historique de la facture :", error);
    return NextResponse.json({ message: "Erreur interne du serveur" }, { status: 500 });
  }
}

/**
 * POST /api/factures-fournisseurs/[id]/statut — changer le statut à la main (FormData) :
 * `statut` (EN_ATTENTE | PAYEE | ANNULEE), et pour « payée » sans paiement : `modePaiement`,
 * `datePaiement`, `preuve` (fichier) obligatoires, `reference` facultative ; `motif` facultatif.
 * Règles : lib/factureStatut.ts et lib/factureStatutServeur.ts. Chaque changement est historisé.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const droits = await getDroits();
  if (droits instanceof NextResponse) return droits;
  if (!droits.pages.includes("fournisseurs")) {
    return NextResponse.json({ message: "La page Prestataires n'est pas ouverte à votre rôle." }, { status: 403 });
  }
  const { id } = await params;

  try {
    const formData = await request.formData();
    const cible = texte(formData.get("statut"));
    if (!isStatutFacture(cible)) return NextResponse.json({ message: "Statut inconnu." }, { status: 400 });
    const preuve = formData.get("preuve");
    const demande: DemandeStatutFacture = {
      cible,
      modePaiement: texte(formData.get("modePaiement")),
      datePaiement: texte(formData.get("datePaiement")),
      reference: texte(formData.get("reference"))?.slice(0, 200) ?? null,
      motif: texte(formData.get("motif"))?.slice(0, 500) ?? null,
      preuve: preuve instanceof File ? preuve : null,
    };
    const utilisateur = await prisma.user.findUnique({ where: { id: droits.userId }, select: { nom: true } });
    const auteur = { email: droits.email, nom: utilisateur?.nom ?? null, peut: (cle: string) => peut(droits, cle) };

    const facture = await prisma.$transaction(
      async (tx) => {
        const controle = await controlerStatutFacture(tx, id, demande, auteur);
        const preuveUrl = cible === "PAYEE" && demande.preuve ? await saveFactureFournisseurPieceJointe(demande.preuve) : null;
        return appliquerStatutFacture(tx, controle, demande, auteur, preuveUrl);
      },
      { timeout: 20000 }
    );
    return NextResponse.json(facture);
  } catch (error) {
    if (error instanceof StatutFactureError) return NextResponse.json({ message: error.message }, { status: error.status });
    const migration = reponseMigrationManquante(error);
    if (migration) return migration;
    const fs = describeFsError(error);
    if (fs) return NextResponse.json({ message: fs }, { status: 500 });
    console.error("Erreur lors du changement de statut de la facture :", error);
    return NextResponse.json({ message: "Erreur interne du serveur" }, { status: 500 });
  }
}
