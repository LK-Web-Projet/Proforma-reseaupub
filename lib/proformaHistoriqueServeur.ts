import { Prisma } from "@prisma/client";
import type { ActionProforma } from "@/lib/proformaHistorique";

type Db = Prisma.TransactionClient;

export interface AuteurHistorique {
  email?: string | null;
  nom?: string | null;
}

/**
 * Ajoute une ligne à l'historique d'une proforma. À appeler dans la même transaction que l'action
 * quand il y en a une : l'historique ne garde que ce qui a vraiment été enregistré.
 */
export async function journaliserProforma(
  db: Db,
  invoiceId: string,
  action: ActionProforma,
  details: string,
  auteur?: AuteurHistorique | null,
  donnees?: Prisma.InputJsonValue
) {
  await db.invoiceHistorique.create({
    data: {
      invoiceId,
      action,
      details: details.slice(0, 2000),
      donnees: donnees ?? undefined,
      auteurEmail: auteur?.email?.toLowerCase() ?? null,
      auteurNom: auteur?.nom ?? null,
    },
  });
}

/** Nom et e-mail d'un utilisateur (identifiant Clerk) pour l'historique. */
export async function auteurDepuisUtilisateur(db: Db, userId: string | null | undefined): Promise<AuteurHistorique | null> {
  if (!userId) return null;
  const u = await db.user.findUnique({ where: { id: userId }, select: { email: true, nom: true } });
  return u ? { email: u.email, nom: u.nom } : null;
}
