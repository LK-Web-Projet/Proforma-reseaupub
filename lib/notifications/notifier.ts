import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email/sendEmail";
import { CANAL_PAR_DEFAUT, type CanalNotificationValue, type EvenementNotification } from "./evenements";

/**
 * Point d'entrée UNIQUE de toutes les notifications de l'application (budgets, proformas,
 * fournisseurs, état du soir). Selon le canal choisi par l'admin pour l'événement :
 * - EMAIL    : l'email part, rien dans l'application ;
 * - APP      : une notification dans la cloche pour chaque destinataire qui a un compte — une
 *              adresse sans compte (liste de diffusion, externe) reçoit tout de même l'email ;
 * - LES_DEUX : les deux (par défaut).
 * Une erreur sur l'un des canaux n'empêche jamais l'autre.
 */
export interface NotificationAEnvoyer {
  to: string | string[];
  cc?: string | string[];
  subject: string; // objet de l'email = titre de la notification
  html: string;
  message: string; // texte court affiché dans la cloche
  lien?: string; // chemin interne, ex. /budget/demandes/<id>
}

const CACHE_MS = 60_000;
let cache: { at: number; canaux: Map<string, CanalNotificationValue> } | null = null;

export async function canalPour(evenement: EvenementNotification): Promise<CanalNotificationValue> {
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    const prefs = await prisma.notificationPreference.findMany();
    cache = { at: Date.now(), canaux: new Map(prefs.map((p) => [p.evenement, p.canal as CanalNotificationValue])) };
  }
  return cache.canaux.get(evenement) ?? CANAL_PAR_DEFAUT;
}

/** À appeler après une modification des préférences (prise en compte immédiate sur ce serveur). */
export function viderCacheCanaux() {
  cache = null;
}

const liste = (v: string | string[] | undefined) => (v ? (Array.isArray(v) ? v : [v]) : []);
const normaliser = (emails: string[]) => Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)));

/** Supprime les balises d'un fragment HTML (intro d'email) pour le texte de la cloche. */
export function texteBrut(html: string, max = 500): string {
  const texte = html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return texte.length > max ? `${texte.slice(0, max - 1)}…` : texte;
}

export async function notifier(evenement: EvenementNotification, n: NotificationAEnvoyer): Promise<void> {
  const to = normaliser(liste(n.to));
  const cc = normaliser(liste(n.cc)).filter((e) => !to.includes(e));
  const tous = [...to, ...cc];
  if (tous.length === 0) return;

  const canal = await canalPour(evenement);
  let avecCompte = new Set<string>();

  if (canal !== "EMAIL") {
    try {
      const users = await prisma.user.findMany({
        where: { active: true, email: { in: tous, mode: "insensitive" } },
        select: { email: true },
      });
      avecCompte = new Set(users.map((u) => u.email.toLowerCase()));
      if (avecCompte.size > 0) {
        await prisma.notification.createMany({
          data: Array.from(avecCompte).map((destinataireEmail) => ({
            destinataireEmail,
            evenement,
            titre: n.subject.slice(0, 200),
            message: n.message.slice(0, 1000),
            lien: n.lien ?? null,
          })),
        });
      }
    } catch (error) {
      console.error(`[notifications] Échec de l'enregistrement (${evenement}) :`, error);
    }
  }

  // Email : canal EMAIL / LES_DEUX ; en APP, seulement les adresses sans compte dans l'application.
  const emailTo = canal === "APP" ? to.filter((e) => !avecCompte.has(e)) : to;
  const emailCc = canal === "APP" ? cc.filter((e) => !avecCompte.has(e)) : cc;
  if (emailTo.length === 0 && emailCc.length === 0) return;
  await sendEmail({
    to: emailTo.length > 0 ? emailTo : emailCc,
    cc: emailTo.length > 0 && emailCc.length > 0 ? emailCc : undefined,
    subject: n.subject,
    html: n.html,
  });
}
