import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { isPosteDepartement, libellePoste, peutAvoirDepartement, POSTE_RESPONSABLE } from "@/lib/departements";
import { nomPrestataire } from "@/lib/departementsServeur";
import { toDateJour } from "@/lib/budgetSchema";

class RattachementError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const schema = z.object({
  // null = retirer le prestataire de son département.
  departementId: z.string().min(1).nullable(),
  poste: z.string().nullable().optional(),
  dateEffet: z.string().refine((v) => toDateJour(v) !== null, "La date du changement est requise."),
  motif: z.string().trim().max(500, "Le motif est limité à 500 caractères.").optional(),
});

/**
 * POST /api/fournisseurs/[id]/departement — rattache un prestataire à un département (ou l'en
 * retire) et fixe son poste ; chaque changement est ajouté à l'historique. Règles :
 *  - jamais un « Fournisseur » (seuls les prestataires internes et externes) ;
 *  - un poste est obligatoire dès qu'il y a un département ;
 *  - un seul responsable actif par département ;
 *  - un département désactivé n'accueille plus de nouveau prestataire.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const droits = await requirePermission("fournisseurs.affecterDepartement");
  if (droits instanceof NextResponse) return droits;
  const { id } = await params;

  const validation = schema.safeParse(await request.json().catch(() => null));
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }
  const { departementId, motif } = validation.data;
  const poste = departementId ? validation.data.poste ?? null : null;
  const dateEffet = toDateJour(validation.data.dateEffet)!;

  try {
    const auteur = await prisma.user.findUnique({ where: { id: droits.userId }, select: { nom: true } });

    const resultat = await prisma.$transaction(async (tx) => {
      const prestataire = await tx.fournisseur.findUnique({
        where: { id },
        select: { id: true, entreprise: true, typeFournisseur: true, departementId: true, posteDepartement: true },
      });
      if (!prestataire) throw new RattachementError("Prestataire introuvable.", 404);
      if (!peutAvoirDepartement(prestataire.typeFournisseur)) {
        throw new RattachementError("Un fournisseur ne se rattache pas à un département : seuls les prestataires internes et externes le peuvent.");
      }

      if (departementId) {
        if (!poste || !isPosteDepartement(poste)) throw new RattachementError("Choisissez le poste du prestataire dans ce département.");
        const departement = await tx.departement.findUnique({ where: { id: departementId }, select: { nom: true, actif: true } });
        if (!departement) throw new RattachementError("Département introuvable.", 404);
        if (!departement.actif && departementId !== prestataire.departementId) {
          throw new RattachementError(`Le département « ${departement.nom} » est désactivé.`);
        }
        if (poste === POSTE_RESPONSABLE) {
          const autre = await tx.fournisseur.findFirst({
            where: { departementId, posteDepartement: POSTE_RESPONSABLE, actif: true, id: { not: id } },
            select: { entreprise: true, nom: true, prenom: true },
          });
          if (autre) {
            throw new RattachementError(
              `${nomPrestataire(autre)} est déjà responsable du département « ${departement.nom} » : changez d'abord son poste.`,
              409
            );
          }
        }
      }

      if (prestataire.departementId === departementId && prestataire.posteDepartement === poste) {
        throw new RattachementError("Aucun changement : le prestataire a déjà ce département et ce poste.");
      }

      const misAJour = await tx.fournisseur.update({
        where: { id },
        data: { departementId, posteDepartement: poste },
        include: { departement: { select: { id: true, nom: true, code: true } } },
      });
      await tx.fournisseurDepartementHistorique.create({
        data: {
          fournisseurId: id,
          ancienDepartementId: prestataire.departementId,
          nouveauDepartementId: departementId,
          ancienPoste: prestataire.posteDepartement,
          nouveauPoste: poste,
          dateEffet,
          motif: motif || null,
          auteurEmail: droits.email,
          auteurNom: auteur?.nom ?? null,
        },
      });
      return misAJour;
    });

    return NextResponse.json({
      departement: resultat.departement,
      posteDepartement: resultat.posteDepartement,
      message: resultat.departement
        ? `Rattaché à ${resultat.departement.nom} (${libellePoste(resultat.posteDepartement)}).`
        : "Prestataire retiré de son département.",
    });
  } catch (error) {
    if (error instanceof RattachementError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error(`Erreur lors du rattachement du prestataire ${id} :`, error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
