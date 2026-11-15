import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { cloturerBudgetsMensuelsEchus } from "@/lib/budgetSuivi";
import { construireEtatSoir, envoyerEtatSoir } from "@/lib/rapports/etatSoir";

/**
 * Minuterie interne : l'application déclenche elle-même ses tâches à heure fixe, sans crontab.
 * Démarrée par instrumentation.ts UNIQUEMENT si SCHEDULER_ENABLED=true (à mettre seulement dans le
 * .env du serveur de production : la base locale étant celle de la production, un poste de
 * développement ne doit jamais envoyer l'état du soir).
 *
 * Toutes les 5 minutes, l'heure du Bénin est comparée aux échéances ; chaque exécution prend
 * d'abord un verrou en base (TacheExecution, clé unique « tâche:jour ») : une seule exécution par
 * jour, même avec plusieurs instances ou après un redémarrage. Une tâche en retard (serveur arrêté
 * à l'heure prévue) s'exécute au démarrage suivant, le même jour.
 */

const FUSEAU = "Africa/Porto-Novo";
const INTERVALLE_MS = 5 * 60_000;

interface Tache {
  nom: string;
  heure: number; // à partir de cette heure (heure du Bénin)
  joursOuvresSeulement: boolean;
  executer: () => Promise<string>;
}

const TACHES: Tache[] = [
  {
    nom: "cloture-mensuels",
    heure: 6,
    joursOuvresSeulement: false,
    executer: async () => {
      const clotures = await cloturerBudgetsMensuelsEchus(prisma);
      return `${clotures.length} budget(s) mensuel(s) clôturé(s)`;
    },
  },
  {
    nom: "etat-soir",
    heure: 19,
    joursOuvresSeulement: true,
    executer: async () => {
      const etat = await construireEtatSoir();
      const envoi = await envoyerEtatSoir(etat);
      return `${envoi.envoye ? "envoyé" : "rien à envoyer"} — ${etat.campagnes.length} campagne(s), ${etat.justificatifs.length} justificatif(s), ${etat.avancesNonJustifiees.length} avance(s)`;
    },
  },
];

/** Jour (AAAA-MM-JJ), heure et jour de la semaine (0 = dimanche) au Bénin. */
export function maintenantBenin(d = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: FUSEAU,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(d);
  const v = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const jours = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return { jour: `${v("year")}-${v("month")}-${v("day")}`, heure: Number(v("hour")), jourSemaine: jours.indexOf(v("weekday")) };
}

/** Clé du verrou si la tâche est due maintenant, sinon null. */
export function cleSiDue(tache: Tache, d = new Date()): string | null {
  const { jour, heure, jourSemaine } = maintenantBenin(d);
  if (tache.joursOuvresSeulement && (jourSemaine === 0 || jourSemaine === 6)) return null;
  if (heure < tache.heure) return null;
  return `${tache.nom}:${jour}`;
}

/**
 * Prend le verrou (insert de la clé) : true si cette instance doit exécuter, false si déjà fait.
 */
export async function prendreVerrou(cle: string): Promise<boolean> {
  try {
    await prisma.tacheExecution.create({ data: { cle } });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
}

async function tick() {
  for (const tache of TACHES) {
    const cle = cleSiDue(tache);
    if (!cle) continue;
    try {
      if (!(await prendreVerrou(cle))) continue;
      // Pas de nouvel essai automatique en cas d'échec (évite un envoi en double si l'erreur
      // survient après l'envoi) : l'échec est consigné, la route d'intégration permet un renvoi.
      let resultat: string;
      try {
        resultat = await tache.executer();
      } catch (error) {
        resultat = `échec : ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[planificateur] ${cle} en échec :`, error);
      }
      await prisma.tacheExecution.update({ where: { cle }, data: { resultat: resultat.slice(0, 500) } });
      console.log(`[planificateur] ${cle} : ${resultat}`);
    } catch (error) {
      console.error(`[planificateur] ${cle} :`, error);
    }
  }
}

const globalPlanif = globalThis as unknown as { __planificateurDemarre?: boolean };

export function demarrerPlanificateur() {
  if (globalPlanif.__planificateurDemarre) return; // une seule minuterie par processus (rechargements en dev)
  globalPlanif.__planificateurDemarre = true;
  console.log("[planificateur] démarré (clôture des mensuels à 6 h, état du soir à 19 h les jours ouvrés, heure du Bénin)");
  setTimeout(() => void tick(), 30_000); // premier passage peu après le démarrage (rattrapage du jour)
  setInterval(() => void tick(), INTERVALLE_MS).unref?.();
}
