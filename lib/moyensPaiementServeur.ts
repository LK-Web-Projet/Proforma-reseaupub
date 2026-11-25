import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { codeMoyenDepuisNom } from "@/lib/moyensPaiement";

type Db = Prisma.TransactionClient;

/** 409 lisible si le nom d'un moyen existe déjà ; null pour toute autre erreur. */
export function reponseDoublonMoyen(error: unknown): NextResponse | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return NextResponse.json({ error: "Un moyen de paiement porte déjà ce nom." }, { status: 409 });
  }
  return null;
}

/** Code libre pour un nouveau moyen : tiré du nom, suffixé (_2, _3…) s'il est déjà pris. */
export async function codeMoyenLibre(db: Db, nom: string): Promise<string> {
  const base = codeMoyenDepuisNom(nom);
  const pris = new Set(
    (await db.moyenPaiement.findMany({ where: { code: { startsWith: base } }, select: { code: true } })).map((m) => m.code)
  );
  if (!pris.has(base)) return base;
  for (let i = 2; ; i++) {
    const code = `${base}_${i}`;
    if (!pris.has(code)) return code;
  }
}

/** Vérifie que les caisses à lier existent. Renvoie le message d'erreur, ou null. */
export async function erreurCaisses(db: Db, caisseIds: number[]): Promise<string | null> {
  if (caisseIds.length === 0) return null;
  const n = await db.cashRegister.count({ where: { id: { in: caisseIds } } });
  return n === caisseIds.length ? null : "Une caisse choisie n'existe plus : rechargez la page.";
}

/**
 * Vérifie les moyens choisis sur un budget ou ses lignes : chacun doit exister et être actif — sauf
 * s'il était déjà sur ce budget (`dejaUtilises` : re-soumission, correction, reconduction).
 * Renvoie le message d'erreur, ou null si tout est correct.
 */
export async function erreurMoyensPaiement(
  db: Db,
  codes: (string | null | undefined)[],
  dejaUtilises: Set<string> = new Set()
): Promise<string | null> {
  const uniques = [...new Set(codes.filter((c): c is string => !!c))];
  if (uniques.length === 0) return null;
  const trouves = await db.moyenPaiement.findMany({ where: { code: { in: uniques } }, select: { code: true, nom: true, actif: true } });
  if (trouves.length !== uniques.length) return "Un moyen de paiement choisi n'existe plus : rechargez la page.";
  const inactif = trouves.find((m) => !m.actif && !dejaUtilises.has(m.code));
  if (inactif) return `Le moyen de paiement « ${inactif.nom} » est désactivé : choisissez-en un autre.`;
  return null;
}

/**
 * Règle du paiement (encaissement ou dépense saisis sur la plateforme) : le moyen existe et est
 * actif, la caisse est visible et liée à ce moyen. Un moyen sans caisse liée ne permet aucun
 * paiement. Renvoie le message d'erreur, ou null. (Les paiements envoyés par CampTrack ne sont pas
 * soumis à cette règle : CampTrack choisit lui-même sa caisse.)
 */
export async function erreurMoyenEtCaisse(db: Db, code: string | null | undefined, cashRegisterId: number): Promise<string | null> {
  if (!code) return "Choisissez le moyen de paiement.";
  const moyen = await db.moyenPaiement.findUnique({
    where: { code },
    select: { nom: true, actif: true, caisses: { select: { cashRegisterId: true } } },
  });
  if (!moyen) return "Moyen de paiement inconnu : rechargez la page.";
  if (!moyen.actif) return `Le moyen de paiement « ${moyen.nom} » est désactivé.`;
  const caisse = await db.cashRegister.findUnique({ where: { id: cashRegisterId }, select: { name: true, view: true } });
  if (!caisse) return "Caisse introuvable.";
  if (!caisse.view) return `La caisse « ${caisse.name} » est masquée : elle ne peut pas recevoir de paiement.`;
  if (moyen.caisses.length === 0) {
    return `Aucune caisse n'est liée au moyen « ${moyen.nom} » : liez-en une dans Finance → Moyens de paiement.`;
  }
  if (!moyen.caisses.some((c) => c.cashRegisterId === cashRegisterId)) {
    return `La caisse « ${caisse.name} » n'est pas liée au moyen « ${moyen.nom} ».`;
  }
  return null;
}
