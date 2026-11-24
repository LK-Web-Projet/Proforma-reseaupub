import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

type Db = Prisma.TransactionClient;

/** Nom affiché d'un prestataire : « Entreprise (Prénom Nom) », ou l'entreprise seule. */
export function nomPrestataire(p: { entreprise: string; nom: string | null; prenom: string | null }): string {
  const personne = [p.prenom, p.nom].filter(Boolean).join(" ").trim();
  return personne && personne.toLowerCase() !== p.entreprise.toLowerCase() ? `${p.entreprise} (${personne})` : p.entreprise;
}

/** 409 lisible si le nom ou le code d'un département existe déjà ; null pour toute autre erreur. */
export function reponseDoublonDepartement(error: unknown): NextResponse | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const champs = (error.meta?.target as string[] | string | undefined) ?? [];
    const surCode = Array.isArray(champs) ? champs.includes("code") : String(champs).includes("code");
    return NextResponse.json(
      { error: surCode ? "Ce code court est déjà utilisé par un autre département." : "Un département porte déjà ce nom." },
      { status: 409 }
    );
  }
  return null;
}

/**
 * Vérifie les départements choisis sur des lignes de budget : chacun doit exister et être actif —
 * sauf s'il était déjà sur ce budget (`dejaUtilises`, re-soumission ou correction : un département
 * désactivé entre-temps reste accepté sur les lignes qui l'avaient). Renvoie le message d'erreur,
 * ou null si tout est correct.
 */
export async function erreurDepartementsLignes(
  db: Db,
  ids: string[],
  dejaUtilises: Set<string> = new Set()
): Promise<string | null> {
  const uniques = [...new Set(ids)];
  if (uniques.length === 0) return null;
  const trouves = await db.departement.findMany({ where: { id: { in: uniques } }, select: { id: true, nom: true, actif: true } });
  if (trouves.length !== uniques.length) return "Un département choisi n'existe plus : rechargez la page.";
  const inactif = trouves.find((d) => !d.actif && !dejaUtilises.has(d.id));
  if (inactif) return `Le département « ${inactif.nom} » est désactivé : choisissez-en un autre.`;
  return null;
}

/** Début (inclus) et fin (exclue) d'un mois, en UTC. */
export function bornesMois(annee: number, mois0: number): { debut: Date; fin: Date } {
  return { debut: new Date(Date.UTC(annee, mois0, 1)), fin: new Date(Date.UTC(annee, mois0 + 1, 1)) };
}
