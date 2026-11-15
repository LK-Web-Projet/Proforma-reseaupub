import type { Prisma } from "@prisma/client";
import { sendEmail, escapeHtml } from "./sendEmail";
import { getBudgetRecipients, requiresValidationAdmin } from "@/lib/budgetAuth";
import { getEntrepriseConfig } from "@/lib/entreprise";

const plafondDelegue = async () => Number((await getEntrepriseConfig()).plafondValidationDeleguee);

export type DemandeBudgetForEmail = Prisma.DemandeBudgetGetPayload<{
  include: { lignes: true };
}>;

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://proforma.reseaupub.com";
}

const nf = (n: unknown) => new Intl.NumberFormat("fr-FR").format(Number(n));

/** Statut de validation d'une ligne, tel qu'affiché dans les e-mails (validation ligne par ligne). */
function libelleLigne(l: DemandeBudgetForEmail["lignes"][number]): string {
  switch (l.statutValidation) {
    case "ACCORDEE":
      return l.montantAccorde !== null && Number(l.montantAccorde) < Number(l.montant)
        ? `<span style="color:#c2410c;">accordé ${nf(l.montantAccorde)} XOF</span>${l.motifDecision ? ` — ${escapeHtml(l.motifDecision)}` : ""}`
        : '<span style="color:#15803d;">accordée</span>';
    case "A_CORRIGER":
      return `<span style="color:#c2410c;">à corriger</span>${l.motifDecision ? ` — ${escapeHtml(l.motifDecision)}` : ""}`;
    case "RETIREE":
      return '<span style="color:#64748b;">retirée</span>';
    default:
      return "";
  }
}

function buildLignesRows(lignes: DemandeBudgetForEmail["lignes"]) {
  return lignes
    .map(
      (l, idx) => `
        <tr style="background:${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
          <td style="padding:10px 14px;border-bottom:1px solid #eef0f3;color:#1f2937;font-size:13px;${l.statutValidation === "RETIREE" ? "text-decoration:line-through;color:#94a3b8;" : ""}">${escapeHtml(l.designation)}${libelleLigne(l) ? `<br/><span style="font-size:11px;">${libelleLigne(l)}</span>` : ""}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #eef0f3;color:#1f2937;font-size:13px;text-align:right;">${nf(l.montant)} XOF</td>
        </tr>`
    )
    .join("");
}

function buildBaseHtml(opts: { title: string; intro: string; demande: DemandeBudgetForEmail; footer?: string }) {
  const { title, intro, demande, footer } = opts;
  const url = `${getAppUrl()}/budget/demandes/${demande.id}`;

  return `
  <div style="font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f8;padding:32px 0;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      <div style="background:#0f172a;padding:26px 30px;">
        <p style="margin:0;color:#94a3b8;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">Demandes de Budget &middot; Réseaupub</p>
        <h1 style="margin:8px 0 0;color:#ffffff;font-size:21px;">${title}</h1>
      </div>

      <div style="padding:26px 30px;">
        <p style="margin:0 0 20px;color:#334155;font-size:14px;line-height:1.5;">${intro}</p>

        <table style="width:100%;border-collapse:collapse;margin-bottom:22px;">
          <tr>
            <td style="padding:5px 0;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;width:160px;vertical-align:top;">N° Demande</td>
            <td style="padding:5px 0;color:#0f172a;font-size:14px;font-weight:700;">${escapeHtml(demande.numero)}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;vertical-align:top;">Demandeur</td>
            <td style="padding:5px 0;color:#0f172a;font-size:13px;">${escapeHtml(demande.requesterName || demande.requesterEmail)}</td>
          </tr>
          ${demande.departement ? `<tr>
            <td style="padding:5px 0;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;vertical-align:top;">Département</td>
            <td style="padding:5px 0;color:#0f172a;font-size:13px;">${escapeHtml(demande.departement)}</td>
          </tr>` : ""}
          <tr>
            <td style="padding:5px 0;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;vertical-align:top;">Motif</td>
            <td style="padding:5px 0;color:#0f172a;font-size:13px;">${escapeHtml(demande.contexteMotivation)}</td>
          </tr>
        </table>

        <p style="margin:0 0 10px;color:#0f172a;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Produits / Dépenses</p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #eef0f3;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#0f172a;">
              <th style="padding:10px 14px;text-align:left;color:#ffffff;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Désignation</th>
              <th style="padding:10px 14px;text-align:right;color:#ffffff;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Montant</th>
            </tr>
          </thead>
          <tbody>
            ${buildLignesRows(demande.lignes)}
          </tbody>
          <tfoot>
            <tr style="background:#eef2ff;">
              <td style="padding:10px 14px;color:#4338ca;font-size:13px;font-weight:700;">Total</td>
              <td style="padding:10px 14px;color:#4338ca;font-size:13px;font-weight:700;text-align:right;">${new Intl.NumberFormat("fr-FR").format(Number(demande.montantTotal))} XOF</td>
            </tr>
          </tfoot>
        </table>

        ${footer ? `<div style="margin-top:24px;padding:14px 18px;background:#fef2f2;border-radius:10px;border:1px solid #fecaca;">
          <p style="margin:0;color:#991b1b;font-size:13px;line-height:1.5;">${footer}</p>
        </div>` : ""}

        <div style="margin-top:24px;text-align:center;">
          <a href="${url}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:700;">Voir la demande</a>
        </div>
      </div>

      <div style="padding:16px 30px;background:#f8fafc;border-top:1px solid #eef0f3;">
        <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center;">Notification automatique &mdash; Réseaupub</p>
      </div>
    </div>
  </div>
  `;
}

const TYPE_LABELS: Record<string, string> = {
  MENSUEL: "budget mensuel",
  PONCTUEL: "budget ponctuel",
  CAMPAGNE: "budget de campagne",
  TIERS: "budget pour un tiers",
};

/**
 * Notifie les valideurs compétents selon la matrice d'approbation (lib/budgetAuth.ts) :
 * l'admin (canValidateBudgetMensuel) pour un budget mensuel ou au-dessus du plafond délégué,
 * sinon les rôles "canValidateBudget" (Assistant-Direction).
 */
export async function sendDemandeSoumiseNotification(demande: DemandeBudgetForEmail, plafond: number) {
  const recipients = await getBudgetRecipients(
    requiresValidationAdmin(demande, plafond) ? "canValidateBudgetMensuel" : "canValidateBudget"
  );
  if (recipients.length === 0) return;
  await sendEmail({
    to: recipients,
    subject: `Nouvelle demande de budget ${demande.numero} à valider`,
    html: buildBaseHtml({
      title: "📝 Nouvelle demande de budget",
      intro: `Une nouvelle demande (${TYPE_LABELS[demande.type] ?? "budget"}) vient d'être soumise et attend votre validation.`,
      demande,
    }),
  });
}

export async function sendDemandeValideeNotification(demande: DemandeBudgetForEmail) {
  const recipients = await getBudgetRecipients("canPayBudget");
  if (recipients.length === 0) return;
  await sendEmail({
    to: recipients,
    subject: `Demande de budget ${demande.numero} validée — à traiter`,
    html: buildBaseHtml({
      title: "✅ Demande de budget validée",
      intro: `La demande de budget <strong>${escapeHtml(demande.numero)}</strong> a été validée${demande.validatedByEmail ? ` par ${escapeHtml(demande.validatedByEmail)}` : ""}. Vous pouvez désormais enregistrer les dépenses ligne par ligne.`,
      demande,
    }),
  });
}

const fmt = (n: number) => `${new Intl.NumberFormat("fr-FR").format(n)} XOF`;

/** Demande de dépassement → administrateurs (seuls habilités à l'approuver). */
export async function sendDepassementDemandeNotification(
  demande: DemandeBudgetForEmail,
  opts: { designation: string; montant: number; motif: string; auteur: string }
) {
  const recipients = await getBudgetRecipients("canValidateBudgetMensuel");
  if (recipients.length === 0) return;
  await sendEmail({
    to: recipients,
    subject: `Demande de dépassement sur le budget ${demande.numero}`,
    html: buildBaseHtml({
      title: "⚠️ Demande de dépassement de budget",
      intro: `<strong>${escapeHtml(opts.auteur)}</strong> demande un dépassement de <strong>${fmt(opts.montant)}</strong> sur la ligne « ${escapeHtml(opts.designation)} ».<br/>Motif : <em>${escapeHtml(opts.motif)}</em>`,
      demande,
    }),
  });
}

/** Décision sur un dépassement → auteur de la demande de dépassement et demandeur du budget. */
export async function sendDepassementDecisionNotification(
  demande: DemandeBudgetForEmail,
  opts: { designation: string; montant: number; approuve: boolean; motifRejet?: string | null; demandeParEmail: string }
) {
  const to = Array.from(new Set([opts.demandeParEmail, demande.requesterEmail].map((e) => e.toLowerCase())));
  await sendEmail({
    to,
    subject: `Dépassement ${opts.approuve ? "approuvé" : "refusé"} — budget ${demande.numero}`,
    html: buildBaseHtml({
      title: opts.approuve ? "✅ Dépassement approuvé" : "❌ Dépassement refusé",
      intro: `Le dépassement de <strong>${fmt(opts.montant)}</strong> sur la ligne « ${escapeHtml(opts.designation)} » a été ${opts.approuve ? "approuvé : le plafond de la ligne est augmenté d'autant" : "refusé"}.`,
      demande,
      footer: !opts.approuve && opts.motifRejet ? `Motif du refus : ${escapeHtml(opts.motifRejet)}` : undefined,
    }),
  });
}

/** Alerte de consommation d'une ligne (80 % ou 100 %) → demandeur et administrateurs. */
export async function sendAlerteConsommationNotification(
  demande: DemandeBudgetForEmail,
  opts: { designation: string; seuil: 80 | 100; consomme: number; plafond: number }
) {
  const admins = await getBudgetRecipients("canValidateBudgetMensuel");
  const to = Array.from(new Set([demande.requesterEmail, ...admins].map((e) => e.toLowerCase())));
  await sendEmail({
    to,
    subject: `Budget ${demande.numero} : ligne « ${opts.designation} » consommée à ${opts.seuil} %`,
    html: buildBaseHtml({
      title: opts.seuil === 100 ? "🔴 Ligne de budget épuisée" : "🟠 Ligne de budget consommée à 80 %",
      intro: `La ligne « ${escapeHtml(opts.designation)} » est consommée à hauteur de <strong>${fmt(opts.consomme)}</strong> sur <strong>${fmt(opts.plafond)}</strong>.${opts.seuil === 100 ? " Toute nouvelle dépense sur cette ligne nécessite un dépassement approuvé par l'administrateur." : ""}`,
      demande,
    }),
  });
}

/** Annulation d'une dépense → demandeur et comptables. */
export async function sendDepenseAnnuleeNotification(
  demande: DemandeBudgetForEmail,
  opts: { designation: string; montant: number; motif: string; auteur: string }
) {
  const comptables = await getBudgetRecipients("canPayBudget");
  const to = Array.from(new Set([demande.requesterEmail, ...comptables].map((e) => e.toLowerCase())));
  await sendEmail({
    to,
    subject: `Dépense annulée sur le budget ${demande.numero}`,
    html: buildBaseHtml({
      title: "↩️ Dépense annulée",
      intro: `<strong>${escapeHtml(opts.auteur)}</strong> a annulé une dépense de <strong>${fmt(opts.montant)}</strong> sur la ligne « ${escapeHtml(opts.designation)} ». Une contre-écriture a été passée au journal de caisse.`,
      demande,
      footer: `Motif : ${escapeHtml(opts.motif)}`,
    }),
  });
}

/** Validation ligne par ligne : une ligne est renvoyée au demandeur pour correction. */
export async function sendLigneACorrigerNotification(
  demande: DemandeBudgetForEmail,
  opts: { designation: string; motif: string; auteur: string }
) {
  await sendEmail({
    to: demande.requesterEmail,
    subject: `Budget ${demande.numero} : une ligne est à corriger`,
    html: buildBaseHtml({
      title: "✏️ Ligne à corriger",
      intro: `<strong>${escapeHtml(opts.auteur)}</strong> demande une correction sur la ligne « ${escapeHtml(opts.designation)} » :<br/><em>${escapeHtml(opts.motif)}</em><br/>Depuis la fiche du budget, modifiez la ligne (elle repartira en validation) ou retirez-la du budget. Les lignes déjà accordées restent utilisables.`,
      demande,
    }),
  });
}

/** Validation ligne par ligne : une ligne corrigée par le demandeur repart en validation. */
export async function sendLigneCorrigeeNotification(demande: DemandeBudgetForEmail, opts: { designation: string; auteur: string }) {
  const recipients = await getBudgetRecipients(
    requiresValidationAdmin(demande, await plafondDelegue()) ? "canValidateBudgetMensuel" : "canValidateBudget"
  );
  if (recipients.length === 0) return;
  await sendEmail({
    to: recipients,
    subject: `Budget ${demande.numero} : ligne corrigée, à valider`,
    html: buildBaseHtml({
      title: "🔁 Ligne corrigée",
      intro: `<strong>${escapeHtml(opts.auteur)}</strong> a corrigé la ligne « ${escapeHtml(opts.designation)} ». Elle attend de nouveau votre validation.`,
      demande,
    }),
  });
}

/** Prévient le demandeur qu'un commentaire a été ouvert sur une ligne de son budget. */
export async function sendCommentaireLigneNotification(
  demande: DemandeBudgetForEmail,
  opts: { designation: string; auteur: string; contenu: string }
) {
  await sendEmail({
    to: demande.requesterEmail,
    subject: `Commentaire sur votre demande de budget ${demande.numero}`,
    html: buildBaseHtml({
      title: "💬 Nouveau commentaire",
      intro: `<strong>${escapeHtml(opts.auteur)}</strong> a commenté la ligne « ${escapeHtml(opts.designation)} » :<br/><em>${escapeHtml(opts.contenu)}</em><br/>Vous pouvez répondre depuis la fiche de la demande.`,
      demande,
    }),
  });
}

export async function sendDemandeRejeteeNotification(demande: DemandeBudgetForEmail) {
  await sendEmail({
    to: demande.requesterEmail,
    subject: `Demande de budget ${demande.numero} rejetée`,
    html: buildBaseHtml({
      title: "❌ Demande de budget rejetée",
      intro: `Votre demande de budget <strong>${escapeHtml(demande.numero)}</strong> a été rejetée.`,
      demande,
      footer: demande.rejectionReason ? `Motif du rejet : ${escapeHtml(demande.rejectionReason)}` : undefined,
    }),
  });
}

export interface JustificatifManquant {
  demandeId: string;
  numero: string;
  designation: string;
  nomReceveur: string;
  montant: number;
  dateDepense: Date;
  echeance: Date;
  enRetard: boolean;
  caisse: string;
  enregistrePar: string;
  motifSansJustificatif: string | null;
}

/**
 * État du soir (procédure de paiement, section 7) : liste des dépenses de budget sans
 * justificatif, les dépenses en retard (24 h ouvrées dépassées) en rouge et en tête.
 * Destinataires : la DG (droit « valider les budgets mensuels »), comptables en copie.
 */
export async function sendJustificatifsManquantsNotification(items: JustificatifManquant[]) {
  if (items.length === 0) return { envoye: false, destinataires: 0 };
  const [dg, comptables] = await Promise.all([
    getBudgetRecipients("canValidateBudgetMensuel"),
    getBudgetRecipients("canPayBudget"),
  ]);
  if (dg.length === 0) return { envoye: false, destinataires: 0 };
  const cc = comptables.filter((e) => !dg.includes(e));

  const enRetard = items.filter((i) => i.enRetard);
  const dateFr = (d: Date) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "Africa/Porto-Novo" }).format(d);
  const dateHeureFr = (d: Date) =>
    new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Porto-Novo" }).format(d);

  const lignes = items
    .map(
      (i, idx) => `
        <tr style="background:${i.enRetard ? "#fef2f2" : idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
          <td style="padding:8px 10px;border-bottom:1px solid #eef0f3;font-size:12px;white-space:nowrap;">
            <a href="${getAppUrl()}/budget/demandes/${i.demandeId}" style="color:#4f46e5;text-decoration:none;font-weight:700;">${escapeHtml(i.numero)}</a>
          </td>
          <td style="padding:8px 10px;border-bottom:1px solid #eef0f3;font-size:12px;color:#1f2937;">
            ${escapeHtml(i.designation)}<br/><span style="color:#64748b;">${escapeHtml(i.nomReceveur)} · ${escapeHtml(i.caisse)}</span>
            ${i.motifSansJustificatif ? `<br/><span style="color:#64748b;font-style:italic;">Motif déclaré : ${escapeHtml(i.motifSansJustificatif)}</span>` : ""}
          </td>
          <td style="padding:8px 10px;border-bottom:1px solid #eef0f3;font-size:12px;text-align:right;white-space:nowrap;">${nf(i.montant)} XOF</td>
          <td style="padding:8px 10px;border-bottom:1px solid #eef0f3;font-size:12px;white-space:nowrap;color:${i.enRetard ? "#b91c1c" : "#334155"};font-weight:${i.enRetard ? 700 : 400};">
            ${i.enRetard ? "En retard" : "Attendu"}<br/><span style="font-weight:400;">${i.enRetard ? "depuis" : "avant"} le ${dateHeureFr(i.echeance)}</span>
          </td>
        </tr>`
    )
    .join("");

  const total = items.reduce((s, i) => s + i.montant, 0);
  const html = `
  <div style="font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f8;padding:32px 0;">
    <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      <div style="background:#0f172a;padding:24px 28px;">
        <p style="margin:0;color:#94a3b8;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">État du soir &middot; Réseaupub</p>
        <h1 style="margin:8px 0 0;color:#ffffff;font-size:20px;">Justificatifs manquants — ${dateFr(new Date())}</h1>
      </div>
      <div style="padding:24px 28px;">
        <p style="margin:0 0 18px;color:#334155;font-size:14px;line-height:1.5;">
          <strong>${items.length}</strong> dépense(s) de budget n'ont pas encore de justificatif, pour <strong>${nf(total)} XOF</strong>.
          ${enRetard.length > 0 ? `<br/><span style="color:#b91c1c;font-weight:700;">${enRetard.length} sont en retard</span> (justificatif attendu sous 24 h ouvrées).` : ""}
        </p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #eef0f3;">
          <thead>
            <tr style="background:#0f172a;">
              <th style="padding:8px 10px;text-align:left;color:#ffffff;font-size:11px;text-transform:uppercase;">Budget</th>
              <th style="padding:8px 10px;text-align:left;color:#ffffff;font-size:11px;text-transform:uppercase;">Dépense</th>
              <th style="padding:8px 10px;text-align:right;color:#ffffff;font-size:11px;text-transform:uppercase;">Montant</th>
              <th style="padding:8px 10px;text-align:left;color:#ffffff;font-size:11px;text-transform:uppercase;">Justificatif</th>
            </tr>
          </thead>
          <tbody>${lignes}</tbody>
        </table>
        <div style="margin-top:22px;text-align:center;">
          <a href="${getAppUrl()}/budget/demandes" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:700;">Ouvrir les budgets</a>
        </div>
      </div>
      <div style="padding:14px 28px;background:#f8fafc;border-top:1px solid #eef0f3;">
        <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center;">Envoi automatique chaque soir &mdash; Réseaupub</p>
      </div>
    </div>
  </div>`;

  await sendEmail({
    to: dg,
    cc: cc.length > 0 ? cc : undefined,
    subject: `Justificatifs manquants : ${items.length} dépense(s)${enRetard.length > 0 ? `, dont ${enRetard.length} en retard` : ""}`,
    html,
  });
  return { envoye: true, destinataires: dg.length + cc.length };
}
