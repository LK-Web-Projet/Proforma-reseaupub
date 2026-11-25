/**
 * Départements : règles communes à l'écran et au serveur (nom en majuscules, postes, qui peut être
 * rattaché). Aucun accès à la base ici — utilisable partout.
 */
import { resolveTypeFournisseur } from "@/lib/typeFournisseur";

/** Nom d'un département : espaces superflus retirés, en MAJUSCULES (accents conservés). */
export function normaliserNomDepartement(nom: string): string {
  return nom.trim().replace(/\s+/g, " ").toLocaleUpperCase("fr-FR");
}

/** Code court : sans espaces, en majuscules (INFO, RH, DG…). Vide → null. */
export function normaliserCodeDepartement(code: string | null | undefined): string | null {
  const c = (code ?? "").replace(/\s+/g, "").toLocaleUpperCase("fr-FR");
  return c || null;
}

/** Postes d'un prestataire au sein de son département (liste à compléter au besoin). */
export const POSTES_DEPARTEMENT = [
  { value: "RESPONSABLE", label: "Responsable de département" },
  { value: "EQUIPE", label: "Équipe du département" },
  { value: "STAGIAIRE_PRO", label: "Stagiaire professionnel" },
  { value: "STAGIAIRE_ACADEMIQUE", label: "Stagiaire académique" },
  { value: "PONCTUEL", label: "Prestataire ponctuel" },
] as const;

export type PosteDepartement = (typeof POSTES_DEPARTEMENT)[number]["value"];

export const POSTE_RESPONSABLE: PosteDepartement = "RESPONSABLE";

export function isPosteDepartement(value: unknown): value is PosteDepartement {
  return POSTES_DEPARTEMENT.some((p) => p.value === value);
}

export function libellePoste(value: string | null | undefined): string {
  return POSTES_DEPARTEMENT.find((p) => p.value === value)?.label ?? (value ? value : "Sans poste");
}

export const COULEURS_POSTE: Record<PosteDepartement, string> = {
  RESPONSABLE: "bg-indigo-50 text-indigo-700 border-indigo-200",
  EQUIPE: "bg-sky-50 text-sky-700 border-sky-200",
  STAGIAIRE_PRO: "bg-amber-50 text-amber-800 border-amber-200",
  STAGIAIRE_ACADEMIQUE: "bg-yellow-50 text-yellow-800 border-yellow-200",
  PONCTUEL: "bg-gray-50 text-gray-600 border-gray-200",
};

/**
 * Seuls les prestataires internes et externes peuvent être rattachés à un département — jamais un
 * « Fournisseur ». (Un prestataire sans type est compté comme interne, comme partout ailleurs.)
 */
export function peutAvoirDepartement(typeFournisseur: string | null | undefined): boolean {
  return resolveTypeFournisseur(typeFournisseur) !== "Fournisseur";
}

/** Libellé court d'un département : son code s'il en a un, sinon son nom. */
export function libelleCourtDepartement(d: { nom: string; code?: string | null } | null | undefined): string {
  if (!d) return "Sans département";
  return d.code || d.nom;
}

export const SANS_DEPARTEMENT = "Sans département";

/** Département tel que renvoyé par GET /api/departements (liste de choix). */
export interface DepartementOption {
  id: string;
  nom: string;
  code: string | null;
  couleur: string | null;
  actif: boolean;
}

/**
 * Totaux d'un budget par département (lignes retirées exclues) : demandé, accordé, consommé.
 * `consommeParLigne` : dépenses non annulées par ligne.
 */
export function totauxParDepartement<
  L extends {
    id: string;
    montant: number | string;
    statutValidation: string;
    montantAccorde?: number | string | null;
    departement?: { id: string; nom: string; code?: string | null; couleur?: string | null } | null;
  },
>(lignes: L[], consommeParLigne: Map<string, number> = new Map()) {
  const parDep = new Map<
    string,
    { id: string | null; nom: string; code: string | null; couleur: string | null; nbLignes: number; demande: number; accorde: number; consomme: number }
  >();
  for (const l of lignes) {
    if (l.statutValidation === "RETIREE") continue;
    const cle = l.departement?.id ?? "__aucun__";
    const t =
      parDep.get(cle) ??
      {
        id: l.departement?.id ?? null,
        nom: l.departement?.nom ?? SANS_DEPARTEMENT,
        code: l.departement?.code ?? null,
        couleur: l.departement?.couleur ?? null,
        nbLignes: 0,
        demande: 0,
        accorde: 0,
        consomme: 0,
      };
    t.nbLignes += 1;
    t.demande += Number(l.montant);
    if (l.statutValidation === "ACCORDEE") t.accorde += Number(l.montantAccorde ?? l.montant);
    t.consomme += consommeParLigne.get(l.id) ?? 0;
    parDep.set(cle, t);
  }
  return [...parDep.values()].sort((a, b) => b.demande - a.demande);
}
