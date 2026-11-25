import { z } from "zod";
import { normaliserCodeDepartement, normaliserNomDepartement } from "@/lib/departements";

const texteFacultatif = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

/** Création / modification d'un département (seul le nom est obligatoire ; il est mis en majuscules). */
export const departementSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(2, "Le nom du département est requis (2 caractères au moins).")
    .max(80, "Le nom du département est limité à 80 caractères.")
    .transform(normaliserNomDepartement),
  code: z
    .string()
    .trim()
    .max(12, "Le code court est limité à 12 caractères.")
    .optional()
    .nullable()
    .transform((v) => normaliserCodeDepartement(v)),
  description: texteFacultatif(1000, "La description est limitée à 1000 caractères."),
  emailContact: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => v === null || z.string().email().safeParse(v).success, "L'e-mail de contact n'est pas valide."),
  telephone: texteFacultatif(40, "Le téléphone est limité à 40 caractères."),
  codeAnalytique: texteFacultatif(40, "Le code analytique est limité à 40 caractères."),
  couleur: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^#[0-9a-fA-F]{6}$/.test(v), "La couleur doit être au format #RRGGBB."),
  enveloppeMensuelle: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => (v === undefined || v === null || v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "L'enveloppe mensuelle doit être un montant positif."),
});

export type DepartementInput = z.infer<typeof departementSchema>;
