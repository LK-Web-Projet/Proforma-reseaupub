import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { TypeBudget } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getEntrepriseConfig } from "@/lib/entreprise";
import { typeValideParAdmin } from "@/lib/budgetTypes";

/**
 * Droits du circuit budget de l'utilisateur connecté. Ils viennent UNIQUEMENT des cases
 * cochées sur son rôle (Paramètres > Rôles) — aucun nom de rôle ni aucune liste d'emails
 * n'est codé en dur, pour que ces droits puissent changer de main sans toucher au code :
 * - canValidateMensuel : valide les budgets mensuels, de campagne et tout budget au-dessus du
 *   plafond délégué (rôle "Admin" en pratique) ; seul à pouvoir ouvrir un commentaire de ligne ;
 * - canValidate : valide les budgets ponctuels et pour tiers jusqu'au plafond (rôle "Assistant-Direction") ;
 * - canPay : enregistre les dépenses dans le journal de caisse (rôle "Comptable") ;
 * - canSaisirCaisse : saisie directe au journal de caisse, hors budget (opérations manuelles,
 *   transferts, caisses, dépenses imputées à une proforma).
 * Relu en base à chaque appel : décocher une case prend effet immédiatement.
 */
export interface BudgetCapabilities {
  userId: string;
  email: string;
  name: string | null;
  canValidateMensuel: boolean;
  canValidate: boolean;
  canPay: boolean;
  canSaisirCaisse: boolean;
  /** Petites dépenses hors bon (accueil) : espèces, jusqu'à plafondPetiteDepense. */
  canPetiteDepense: boolean;
  plafond: number;
  plafondPetiteDepense: number;
}

export async function getBudgetCapabilities(): Promise<BudgetCapabilities | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const clerkUser = await currentUser();
  const [dbUser, config] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, include: { role: true } }),
    getEntrepriseConfig(),
  ]);

  const email = (dbUser?.email ?? clerkUser?.emailAddresses[0]?.emailAddress ?? "").toLowerCase();
  if (!email) return null;

  const name =
    dbUser?.nom ||
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
    null;

  const role = dbUser && dbUser.active ? dbUser.role : null;

  return {
    userId,
    email,
    name,
    canValidateMensuel: !!role?.canValidateBudgetMensuel,
    canValidate: !!role?.canValidateBudget,
    canPay: !!role?.canPayBudget,
    canSaisirCaisse: !!role?.canSaisirCaisse,
    canPetiteDepense: !!role?.canSaisirPetiteDepense,
    plafond: Number(config.plafondValidationDeleguee),
    plafondPetiteDepense: Number(config.plafondPetiteDepense),
  };
}

/** Identité Clerk de l'utilisateur connecté (utilisée aussi par les bons de commande fournisseur). */
export async function getCurrentUserIdentity(): Promise<{ email: string | null; name: string | null }> {
  const user = await currentUser();
  if (!user) return { email: null, name: null };
  const email = user.emailAddresses[0]?.emailAddress ?? null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || null;
  return { email, name };
}

/** Vrai si l'utilisateur intervient dans le circuit (voit toutes les demandes, pas seulement les siennes). */
export function isImpliqueBudget(caps: BudgetCapabilities): boolean {
  return caps.canValidateMensuel || caps.canValidate || caps.canPay || caps.canPetiteDepense;
}

/**
 * Petite dépense (droit « accueil », sans le droit comptable) : hors bon de commande et hors
 * facture, en espèces, au plus plafondPetiteDepense. Renvoie le motif de refus, sinon null.
 * Le comptable (canPay) n'est pas concerné.
 */
export function refusPetiteDepense(
  caps: BudgetCapabilities,
  d: { montant: number; modePaiement: string; commandeId?: string | null; factureFournisseurId?: string | null }
): string | null {
  if (caps.canPay) return null;
  if (!caps.canPetiteDepense) return "Réservé au comptable habilité à enregistrer les dépenses.";
  if (d.commandeId || d.factureFournisseurId) return "Le paiement d'un bon de commande ou d'une facture est réservé au comptable.";
  if (d.modePaiement !== "ESPECES") return "Les petites dépenses se règlent en espèces.";
  if (d.montant > caps.plafondPetiteDepense + 0.005) {
    return `Montant au-dessus du maximum des petites dépenses (${caps.plafondPetiteDepense.toLocaleString("fr-FR")} FCFA) : faites-la enregistrer par le comptable.`;
  }
  return null;
}

export function isSameEmail(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

/**
 * Un budget doit-il remonter au niveau "admin" (canValidateMensuel) ? Oui pour tout budget
 * mensuel ou de campagne (TYPES_VALIDATION_ADMIN), et pour tout autre budget dont le montant
 * dépasse le plafond délégué.
 */
export function requiresValidationAdmin(demande: { type: TypeBudget; montantTotal: unknown }, plafond: number): boolean {
  return typeValideParAdmin(demande.type) || Number(demande.montantTotal) > plafond;
}

/**
 * Matrice d'approbation : renvoie null si l'utilisateur peut valider/rejeter cette demande,
 * sinon le motif du refus. Personne ne valide sa propre demande (séparation des tâches).
 */
export function refusValidation(
  caps: BudgetCapabilities,
  demande: { type: TypeBudget; montantTotal: unknown; requesterEmail: string }
): string | null {
  if (isSameEmail(caps.email, demande.requesterEmail)) {
    return "Vous ne pouvez pas valider ou rejeter votre propre demande.";
  }
  if (requiresValidationAdmin(demande, caps.plafond)) {
    if (!caps.canValidateMensuel) {
      return demande.type === "MENSUEL"
        ? "Les budgets mensuels sont validés par l'administrateur."
        : demande.type === "CAMPAGNE"
          ? "Les budgets de campagne sont validés par l'administrateur."
          : `Ce budget dépasse le plafond de validation déléguée (${caps.plafond.toLocaleString("fr-FR")} FCFA) : il doit être validé par l'administrateur.`;
    }
    return null;
  }
  if (!caps.canValidate && !caps.canValidateMensuel) {
    return "Vous n'avez pas le droit de valider les demandes de budget.";
  }
  return null;
}

/** Garde de route : utilisateur authentifié, renvoie ses droits budget ou une réponse 401. */
export async function requireBudgetUser(): Promise<BudgetCapabilities | NextResponse> {
  const caps = await getBudgetCapabilities();
  if (!caps) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  return caps;
}

/**
 * Garde des routes du journal de caisse (saisie hors budget) : réservée aux rôles portant le
 * droit « Saisir au journal de caisse ». Renvoie les droits, ou une réponse 401/403.
 */
export async function requireCaisseUser(): Promise<BudgetCapabilities | NextResponse> {
  const caps = await getBudgetCapabilities();
  if (!caps) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  if (!caps.canSaisirCaisse) {
    return NextResponse.json(
      { error: "Vous n'avez pas le droit de saisir au journal de caisse. Les dépenses passent par le circuit budget." },
      { status: 403 }
    );
  }
  return caps;
}

// Déplacé dans un module sans Clerk (chargé par la minuterie interne) ; réexporté ici.
export { getBudgetRecipients, type BudgetFlag } from "@/lib/budgetDestinataires";
