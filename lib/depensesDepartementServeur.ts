import { OperationType, Prisma, StatutDemandeBudget, StatutDepassement, StatutLigneBudget } from "@prisma/client";
import { montantAccordeLigne } from "@/lib/budgetSuivi";
import { BUDGET_ANNULATION_SELECT, isEcritureBudgetAnnulee, isInternalTransferOut } from "@/lib/dashboardReporting";
import {
  decalerMois,
  listeMois,
  moisCle,
  SANS_DEPARTEMENT,
  type DepenseDepartement,
  type HorsBudgetMois,
  type PrevuDepartement,
  type RapportDepensesDepartement,
} from "@/lib/depensesDepartement";

type Db = Prisma.TransactionClient;

/** Nombre maximal de mois affichés d'un coup. */
const MOIS_MAX = 24;
const STATUTS_BUDGET_RETENUS = [
  StatutDemandeBudget.VALIDEE,
  StatutDemandeBudget.VALIDATION_PARTIELLE,
  StatutDemandeBudget.EN_COURS,
  StatutDemandeBudget.PAYEE,
];

const cleMois = (v: string | null) => (v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : null);
const debutMois = (cle: string) => {
  const [a, m] = cle.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, 1));
};

/** Département d'une ligne ; anciennes lignes : celui du budget entier (en majuscules), sinon « Sans département ». */
function departementLigne(ligne: { departement: { nom: string } | null }, budget: { departement: string | null }): string {
  if (ligne.departement) return ligne.departement.nom;
  const texte = budget.departement?.trim();
  return texte ? texte.toLocaleUpperCase("fr-FR") : SANS_DEPARTEMENT;
}

/**
 * Données du rapport « Dépenses par département » de `from` à `to` ("yyyy-MM", déjà contrôlés et
 * bornés par l'appelant). Le mois qui précède `from` est chargé aussi, pour la comparaison.
 */
export async function chargerRapportDepensesDepartement(db: Db, from: string, to: string): Promise<RapportDepensesDepartement> {
  const moisComparaison = decalerMois(from, -1);

  const debut = debutMois(moisComparaison); // inclus (mois de comparaison)
  const debutAffiche = debutMois(from);
  const fin = debutMois(decalerMois(to, 1)); // exclu
  const fenetre = { gte: debut, lt: fin };
  const periodeAffichee = { gte: debutAffiche, lt: fin };

  const [departements, depenses, anciens, budgetsDuMois, ecritures, caisses] = await Promise.all([
    db.departement.findMany({
      orderBy: { nom: "asc" },
      select: { id: true, nom: true, couleur: true, enveloppeMensuelle: true, actif: true },
    }),
    // Dépenses réelles (non annulées), datées du jour où l'argent est sorti.
    db.budgetDepense.findMany({
      where: { annuleeAt: null, dateDepense: fenetre },
      orderBy: { dateDepense: "asc" },
      select: {
        id: true,
        montant: true,
        dateDepense: true,
        nomReceveur: true,
        modePaiement: true,
        source: true,
        ligne: { select: { designation: true, categorie: true, departement: { select: { nom: true } } } },
        demandeBudget: { select: { id: true, numero: true, departement: true } },
      },
    }),
    // Budgets payés avant le suivi par dépenses : aucune dépense détaillée, l'accordé compte comme
    // dépensé à la date de paiement (sinon de validation, sinon de création).
    db.demandeBudget.findMany({
      where: {
        statut: StatutDemandeBudget.PAYEE,
        clotureeAt: null,
        depenses: { none: {} },
        OR: [
          { datePaiement: fenetre },
          { datePaiement: null, validatedAt: fenetre },
          { datePaiement: null, validatedAt: null, createdAt: fenetre },
        ],
      },
      select: {
        id: true,
        numero: true,
        departement: true,
        datePaiement: true,
        validatedAt: true,
        createdAt: true,
        lignes: {
          select: { id: true, designation: true, categorie: true, montant: true, montantAccorde: true, statutValidation: true, departement: { select: { nom: true } } },
        },
      },
    }),
    // Prévu : budgets retenus rattachés aux mois affichés (même règle que le suivi budgétaire).
    db.demandeBudget.findMany({
      where: {
        statut: { in: STATUTS_BUDGET_RETENUS },
        OR: [
          { periodeMois: periodeAffichee },
          { periodeMois: null, validatedAt: periodeAffichee },
          { periodeMois: null, validatedAt: null, createdAt: periodeAffichee },
        ],
      },
      select: {
        departement: true,
        periodeMois: true,
        validatedAt: true,
        createdAt: true,
        lignes: {
          where: { statutValidation: StatutLigneBudget.ACCORDEE },
          select: { id: true, montant: true, montantAccorde: true, statutValidation: true, departement: { select: { nom: true } } },
        },
        depassements: { where: { statut: StatutDepassement.APPROUVE }, select: { ligneId: true, montant: true } },
      },
    }),
    // Sorties de caisse de la période, pour isoler celles qui ne sont rattachées à aucun budget.
    db.cashJournal.findMany({
      where: { type: OperationType.DEPENSE, date_operation: periodeAffichee },
      select: { id: true, libelle: true, montant: true, date_operation: true, isApportDeCaisse: true, ...BUDGET_ANNULATION_SELECT },
    }),
    db.cashRegister.findMany({ select: { id: true } }),
  ]);

  const lignesDepenses: DepenseDepartement[] = depenses.map((d) => ({
    id: d.id,
    date: d.dateDepense.toISOString(),
    mois: moisCle(d.dateDepense),
    departement: departementLigne(d.ligne, d.demandeBudget),
    categorie: d.ligne.categorie,
    montant: Number(d.montant),
    budgetId: d.demandeBudget.id,
    budgetNumero: d.demandeBudget.numero,
    ligne: d.ligne.designation,
    receveur: d.nomReceveur,
    moyen: d.modePaiement,
    source: d.source,
  }));
  for (const b of anciens) {
    const date = b.datePaiement ?? b.validatedAt ?? b.createdAt;
    for (const l of b.lignes) {
      const montant = montantAccordeLigne(l);
      if (montant <= 0) continue;
      lignesDepenses.push({
        id: `ancien-${l.id}`,
        date: date.toISOString(),
        mois: moisCle(date),
        departement: departementLigne(l, b),
        categorie: l.categorie,
        montant,
        budgetId: b.id,
        budgetNumero: b.numero,
        ligne: l.designation,
        receveur: null,
        moyen: null,
        source: "ANCIEN",
      });
    }
  }
  lignesDepenses.sort((a, b) => a.date.localeCompare(b.date));

  const prevus = new Map<string, PrevuDepartement>();
  for (const b of budgetsDuMois) {
    const mois = moisCle(b.periodeMois ?? b.validatedAt ?? b.createdAt);
    for (const l of b.lignes) {
      const departement = departementLigne(l, b);
      const depasse = b.depassements.filter((x) => x.ligneId === l.id).reduce((s, x) => s + Number(x.montant), 0);
      const cle = `${mois}|${departement}`;
      const p = prevus.get(cle) ?? { mois, departement, prevu: 0 };
      p.prevu += montantAccordeLigne(l) + depasse;
      prevus.set(cle, p);
    }
  }

  // Hors budget : ni dépense de budget (même annulée), ni transfert vers une autre caisse, ni apport.
  const toutesCaisses = new Set(caisses.map((c) => c.id));
  const horsBudget = new Map<string, HorsBudgetMois>();
  for (const e of ecritures) {
    if (e.budgetDepense || isEcritureBudgetAnnulee(e) || e.isApportDeCaisse || isInternalTransferOut(e.libelle, toutesCaisses)) continue;
    const mois = moisCle(e.date_operation);
    const h = horsBudget.get(mois) ?? { mois, montant: 0, nb: 0 };
    h.montant += Number(e.montant);
    h.nb += 1;
    horsBudget.set(mois, h);
  }

  const reponse: RapportDepensesDepartement = {
    from,
    to,
    mois: listeMois(from, to),
    moisComparaison,
    departements: departements.map((d) => ({
      ...d,
      enveloppeMensuelle: d.enveloppeMensuelle === null ? null : Number(d.enveloppeMensuelle),
    })),
    depenses: lignesDepenses,
    prevus: [...prevus.values()],
    horsBudget: [...horsBudget.values()],
  };
  return reponse;
}

/** Période demandée : 6 derniers mois par défaut, ordre rétabli, au plus MOIS_MAX mois. */
export function periodeRapport(fromBrut: string | null, toBrut: string | null, maintenant: Date = new Date()): { from: string; to: string } {
  let to = cleMois(toBrut) ?? moisCle(maintenant);
  let from = cleMois(fromBrut) ?? decalerMois(to, -5);
  if (from > to) [from, to] = [to, from];
  if (listeMois(from, to).length > MOIS_MAX) from = decalerMois(to, -(MOIS_MAX - 1));
  return { from, to };
}
