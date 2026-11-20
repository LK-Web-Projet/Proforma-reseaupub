import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { peut, type DroitsServeur } from "@/lib/authz";

/**
 * Portée des proformas : sans le droit « Voir toutes les proformas », un utilisateur ne voit que
 * les siennes — celles qu'il a créées, ou dont il est l'un des commerciaux (rapprochement par
 * email : Gestionnaire.email = email du compte). Renvoie le filtre Prisma à ajouter, ou null si
 * l'utilisateur voit tout.
 */
export function filtrePorteeProformas(droits: DroitsServeur): Prisma.InvoiceWhereInput | null {
  if (peut(droits, "proforma.voirTout")) return null;
  return {
    OR: [
      { createdById: droits.userId },
      { gestionnaires: { some: { gestionnaire: { email: { equals: droits.email, mode: "insensitive" } } } } },
    ],
  };
}

/** Vrai si la proforma `invoiceId` est dans la portée de l'utilisateur. */
export async function proformaDansPortee(
  tx: Prisma.TransactionClient,
  droits: DroitsServeur,
  invoiceId: string
): Promise<boolean> {
  const filtre = filtrePorteeProformas(droits);
  if (!filtre) return true;
  const n = await tx.invoice.count({ where: { AND: [{ id: invoiceId }, filtre] } });
  return n > 0;
}

/** Réponse 403 si la proforma est hors de la portée de l'utilisateur, sinon null. */
export async function refusHorsPortee(droits: DroitsServeur, invoiceId: string): Promise<NextResponse | null> {
  if (await proformaDansPortee(prisma, droits, invoiceId)) return null;
  return NextResponse.json(
    { error: "Cette proforma n'est pas dans votre portée (vous ne voyez que les vôtres)." },
    { status: 403 }
  );
}
