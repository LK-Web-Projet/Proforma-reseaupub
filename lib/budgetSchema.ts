import { z } from "zod";
import { CategorieDepense, ModePaiementDemande, TypeBudget } from "@prisma/client";
import { JOURS_GRACE_CLOTURE_MENSUELLE } from "@/lib/budgetSuivi";

/**
 * Un budget mensuel ne peut viser qu'un mois en cours ou futur — ou le mois précédent pendant
 * le délai de grâce de clôture (sinon il serait clôturé automatiquement dès sa validation).
 */
export function moisMensuelAccepte(periode: Date, now = new Date()): boolean {
  const debutMoisCourant = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const debutMoisPrecedent = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1);
  const debutPeriode = Date.UTC(periode.getUTCFullYear(), periode.getUTCMonth(), 1);
  if (debutPeriode >= debutMoisCourant) return true;
  return debutPeriode === debutMoisPrecedent && now.getUTCDate() <= JOURS_GRACE_CLOTURE_MENSUELLE;
}

const ligneSchema = z.object({
  designation: z.string().min(1),
  montant: z.number().min(0),
  categorie: z.nativeEnum(CategorieDepense, { message: "Choisissez une catégorie pour chaque ligne." }),
});

/**
 * Validation commune à la création (POST /api/demandes-budget) et à la re-soumission
 * (POST /api/demandes-budget/[id]/resoumettre), avec les règles propres à chaque type :
 * - MENSUEL  : mois et service obligatoires ;
 * - CAMPAGNE : au moins une proforma liée (les dépenses lui seront imputées) ;
 * - TIERS    : bénéficiaire ("pour le compte de") obligatoire, proforma facultative.
 */
export const demandeBudgetSchema = z
  .object({
    type: z.nativeEnum(TypeBudget).default(TypeBudget.PONCTUEL),
    periodeMois: z.string().optional(),
    departement: z.string().optional(),
    contexteMotivation: z.string().min(1, "Le contexte et la motivation sont requis."),
    modePaiement: z.nativeEnum(ModePaiementDemande),
    typeDepense: z.string().min(1, "Le type de dépense est requis."),
    pourLeCompteDe: z.string().optional(),
    dateLimiteSouhaitee: z.string().optional(),
    bonCommandeId: z.string().optional(),
    proformaIds: z.array(z.string()).default([]),
    lignes: z.array(ligneSchema).min(1, "Ajoutez au moins une ligne de dépense."),
  })
  .superRefine((d, ctx) => {
    if (d.type === TypeBudget.MENSUEL) {
      if (!d.periodeMois) ctx.addIssue({ code: "custom", path: ["periodeMois"], message: "Le mois du budget mensuel est requis." });
      const periode = toPeriodeMois(d.periodeMois);
      if (periode && !moisMensuelAccepte(periode)) {
        ctx.addIssue({ code: "custom", path: ["periodeMois"], message: "Ce mois est terminé : un budget mensuel ne peut viser que le mois en cours ou un mois à venir." });
      }
      if (!d.departement) ctx.addIssue({ code: "custom", path: ["departement"], message: "Le service est requis pour un budget mensuel." });
    }
    if (d.type === TypeBudget.CAMPAGNE && d.proformaIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["proformaIds"], message: "Un budget de campagne doit être associé à au moins une proforma." });
    }
    if (d.type === TypeBudget.TIERS && !d.pourLeCompteDe?.trim()) {
      ctx.addIssue({ code: "custom", path: ["pourLeCompteDe"], message: "Indiquez pour le compte de quelle entreprise ou de quel client." });
    }
  });

export type DemandeBudgetInput = z.infer<typeof demandeBudgetSchema>;

/** Lit les champs du FormData envoyé par components/DemandeBudgetForm.tsx. */
export function parseDemandeBudgetFormData(formData: FormData) {
  const rawLignes = formData.get("lignes");
  const rawProformaIds = formData.get("proformaIds");
  return demandeBudgetSchema.safeParse({
    type: (formData.get("type") as string) || undefined,
    periodeMois: (formData.get("periodeMois") as string) || undefined,
    departement: (formData.get("departement") as string) || undefined,
    contexteMotivation: (formData.get("contexteMotivation") as string) || "",
    modePaiement: formData.get("modePaiement") as string,
    typeDepense: (formData.get("typeDepense") as string) || "",
    pourLeCompteDe: (formData.get("pourLeCompteDe") as string) || undefined,
    dateLimiteSouhaitee: (formData.get("dateLimiteSouhaitee") as string) || undefined,
    bonCommandeId: (formData.get("bonCommandeId") as string) || undefined,
    proformaIds: rawProformaIds ? JSON.parse(rawProformaIds as string) : [],
    lignes: rawLignes ? JSON.parse(rawLignes as string) : [],
  });
}

/** "2026-11" ou ISO → 1er jour du mois (UTC midi, pour éviter tout glissement de fuseau). */
export function toPeriodeMois(value: string | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1, 12));
}

/** Message lisible à partir d'une erreur zod (premier message trouvé). */
export function firstZodMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Données invalides.";
}
