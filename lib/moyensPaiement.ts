/**
 * Moyens de paiement (Finance → Moyens de paiement) : règles communes à l'écran et au serveur.
 * Aucun accès à la base ici — utilisable partout.
 *
 * Un moyen a un `code` stable (ESPECES, VIREMENT… pour les 6 moyens d'origine) : c'est lui qui est
 * enregistré sur les budgets, les lignes, les dépenses et les encaissements. Chaque moyen est lié à
 * des caisses : au paiement, seules les caisses VISIBLES liées au moyen choisi sont proposées, et un
 * moyen sans caisse liée ne permet aucun paiement.
 */
import { z } from "zod";
import { modePaiementLabel } from "@/lib/budgetTypes";

/** Code du moyen « Espèces » (petites dépenses de l'accueil). */
export const CODE_ESPECES = "ESPECES";

export interface CaisseLiee {
  id: number;
  name: string;
  view: boolean;
}

export interface MoyenPaiementOption {
  id: string;
  code: string;
  nom: string;
  description: string | null;
  ordre: number;
  actif: boolean;
  /** Caisses liées (toutes, y compris masquées) ; absent si l'utilisateur ne paie jamais rien. */
  caisses?: CaisseLiee[];
}

/** Nom affiché d'un moyen : depuis la liste chargée, sinon le libellé d'origine, sinon le code. */
export function libelleMoyen(code: string | null | undefined, moyens?: readonly Pick<MoyenPaiementOption, "code" | "nom">[] | null): string {
  if (!code) return "—";
  return moyens?.find((m) => m.code === code)?.nom ?? modePaiementLabel(code);
}

/** Caisses proposées pour un moyen : liées à ce moyen ET visibles. Aucun lien = aucune caisse. */
export function caissesProposees(moyens: readonly MoyenPaiementOption[], code: string | null | undefined): CaisseLiee[] {
  const moyen = moyens.find((m) => m.code === code);
  return (moyen?.caisses ?? []).filter((c) => c.view).sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

/**
 * Moyens proposés dans une liste de choix : les actifs, plus le moyen déjà choisi s'il a été
 * désactivé entre-temps (pour qu'une ancienne ligne garde son moyen).
 */
export function moyensProposes(moyens: readonly MoyenPaiementOption[], ...dejaChoisis: (string | null | undefined)[]): MoyenPaiementOption[] {
  return moyens.filter((m) => m.actif || dejaChoisis.includes(m.code));
}

/** Code généré depuis le nom à la création : « Orange Money » → ORANGE_MONEY. */
export function codeMoyenDepuisNom(nom: string): string {
  const code = nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
  return code || "MOYEN";
}

/** Nom d'un moyen : espaces superflus retirés (la casse saisie est conservée). */
export function normaliserNomMoyen(nom: string): string {
  return nom.trim().replace(/\s+/g, " ");
}

/** Création / modification d'un moyen de paiement (seul le nom est obligatoire). */
export const moyenPaiementSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(2, "Le nom du moyen de paiement est requis (2 caractères au moins).")
    .max(60, "Le nom est limité à 60 caractères.")
    .transform(normaliserNomMoyen),
  description: z
    .string()
    .trim()
    .max(500, "La description est limitée à 500 caractères.")
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  ordre: z
    .union([z.number(), z.string()])
    .optional()
    .transform((v) => (v === undefined || v === "" ? 0 : Number(v)))
    .refine((v) => Number.isInteger(v) && v >= 0 && v <= 999, "L'ordre d'affichage est un nombre entier entre 0 et 999."),
  caisseIds: z
    .array(z.number().int().positive())
    .max(100)
    .optional()
    .transform((v) => [...new Set(v ?? [])]),
});

export type MoyenPaiementInput = z.infer<typeof moyenPaiementSchema>;

/** Code d'un moyen reçu dans une requête (budget, dépense, encaissement). */
export const codeMoyenSchema = z
  .string({ error: "Choisissez le moyen de paiement." })
  .trim()
  .min(1, "Choisissez le moyen de paiement.")
  .max(40, "Moyen de paiement inconnu.");
