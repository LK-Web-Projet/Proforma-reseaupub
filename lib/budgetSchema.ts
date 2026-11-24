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
  // Département de la ligne : obligatoire (vérifié existant et actif par la route).
  departementId: z.string({ message: "Choisissez le département de chaque ligne." }).min(1, "Choisissez le département de chaque ligne."),
  montant: z.number().min(0),
  categorie: z.nativeEnum(CategorieDepense, { message: "Choisissez une catégorie pour chaque ligne." }),
  // Moyen de paiement prévu pour la ligne ; absent = celui de la demande (voir lignesAvecMode).
  modePaiement: z.nativeEnum(ModePaiementDemande).optional(),
  // Précisions facultatives (texte libre) et délai propre à la ligne ("AAAA-MM-JJ" ou ISO).
  detail: z.string().trim().max(2000, "Le détail d'une ligne est limité à 2000 caractères.").optional(),
  dateLimite: z
    .string()
    .optional()
    .refine((v) => !v || toDateJour(v) !== null, "Le délai d'une ligne n'est pas une date valide."),
});

/**
 * Validation commune à la création (POST /api/demandes-budget) et à la re-soumission
 * (POST /api/demandes-budget/[id]/resoumettre), avec les règles propres à chaque type :
 * - MENSUEL  : mois obligatoire (le département est porté par chaque ligne) ;
 * - CAMPAGNE : sa proforma, une seule (les dépenses lui seront imputées) ;
 * - TIERS    : bénéficiaire ("pour le compte de") obligatoire, proforma facultative (une au plus).
 */
export const demandeBudgetSchema = z
  .object({
    type: z.nativeEnum(TypeBudget).default(TypeBudget.PONCTUEL),
    periodeMois: z.string().optional(),
    departement: z.string().optional(),
    contexteMotivation: z.string().min(1, "Le contexte et la motivation sont requis."),
    // Moyen « principal » : le formulaire l'envoie, déduit des lignes (celui du plus gros montant).
    modePaiement: z.nativeEnum(ModePaiementDemande),
    // Type de dépense et bon de commande associé : plus saisis dans le formulaire (facultatifs ;
    // absents à la re-soumission → la valeur déjà enregistrée est conservée).
    typeDepense: z.string().trim().optional(),
    pourLeCompteDe: z.string().optional(),
    dateLimiteSouhaitee: z.string().optional(),
    bonCommandeId: z.string().optional(),
    // Une seule proforma par budget (tableau conservé pour la compatibilité : 0 ou 1 élément).
    proformaIds: z.array(z.string()).max(1, "Un budget n'est associé qu'à une seule proforma.").default([]),
    lignes: z.array(ligneSchema).min(1, "Ajoutez au moins une ligne de dépense."),
  })
  .superRefine((d, ctx) => {
    if (d.type === TypeBudget.MENSUEL) {
      if (!d.periodeMois) ctx.addIssue({ code: "custom", path: ["periodeMois"], message: "Le mois du budget mensuel est requis." });
      const periode = toPeriodeMois(d.periodeMois);
      if (periode && !moisMensuelAccepte(periode)) {
        ctx.addIssue({ code: "custom", path: ["periodeMois"], message: "Ce mois est terminé : un budget mensuel ne peut viser que le mois en cours ou un mois à venir." });
      }
    }
    if (d.type === TypeBudget.CAMPAGNE && d.proformaIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["proformaIds"], message: "Un budget de campagne doit être associé à sa proforma." });
    }
    if (d.type === TypeBudget.TIERS && !d.pourLeCompteDe?.trim()) {
      ctx.addIssue({ code: "custom", path: ["pourLeCompteDe"], message: "Indiquez pour le compte de quelle entreprise ou de quel client." });
    }
  });

export type DemandeBudgetInput = z.infer<typeof demandeBudgetSchema>;

/**
 * Lignes prêtes à créer : chaque ligne porte son moyen de paiement (celui de la demande par défaut),
 * son détail (vide → null) et son délai (date du jour, à midi UTC).
 */
export function lignesAvecMode(data: DemandeBudgetInput) {
  return data.lignes.map((l) => ({
    ...l,
    modePaiement: l.modePaiement ?? data.modePaiement,
    detail: l.detail ? l.detail : null,
    dateLimite: toDateJour(l.dateLimite),
  }));
}

/** "2026-12-15" ou ISO → ce jour à midi UTC (pas de glissement de fuseau à l'affichage). */
export function toDateJour(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return Number.isNaN(date.getTime()) || date.getUTCDate() !== Number(match[3]) ? null : date;
}

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
    typeDepense: (formData.get("typeDepense") as string) || undefined,
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
