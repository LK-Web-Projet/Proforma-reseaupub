import type { Prisma } from "@prisma/client";
import { escapeHtml } from "./sendEmail";
import { notifier, texteBrut } from "@/lib/notifications/notifier";
import { resolveTypeFournisseur } from "@/lib/typeFournisseur";
import { getBudgetRecipients } from "@/lib/budgetDestinataires";
import prisma from "@/lib/prisma";

export type CommandeFournisseurForEmail = Prisma.CommandeFournisseurGetPayload<{
  include: { lignes: true; fournisseur: true };
}>;

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://proforma.reseaupub.com";
}

function formatXOF(value: number) {
  return `${new Intl.NumberFormat("fr-FR").format(value)} XOF`;
}

function buildLignesRows(lignes: CommandeFournisseurForEmail["lignes"]) {
  return lignes
    .map(
      (l, idx) => `
        <tr style="background:${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
          <td style="padding:10px 14px;border-bottom:1px solid #eef0f3;color:#1f2937;font-size:13px;">${escapeHtml(l.designation)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #eef0f3;color:#1f2937;font-size:13px;text-align:center;">${l.quantite}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #eef0f3;color:#1f2937;font-size:13px;text-align:right;">${formatXOF(Number(l.prixTotal))}</td>
        </tr>`
    )
    .join("");
}

function buildBaseHtml(opts: { title: string; intro: string; commande: CommandeFournisseurForEmail; footer?: string }) {
  const { title, intro, commande, footer } = opts;
  const url = `${getAppUrl()}/fournisseur/${commande.fournisseurId}/commandes/${commande.id}`;

  return `
  <div style="font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f8;padding:32px 0;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      <div style="background:#0f172a;padding:26px 30px;">
        <p style="margin:0;color:#94a3b8;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">Bons de Commande Prestataires &middot; Réseaupub</p>
        <h1 style="margin:8px 0 0;color:#ffffff;font-size:21px;">${title}</h1>
      </div>

      <div style="padding:26px 30px;">
        <p style="margin:0 0 20px;color:#334155;font-size:14px;line-height:1.5;">${intro}</p>

        <table style="width:100%;border-collapse:collapse;margin-bottom:22px;">
          <tr>
            <td style="padding:5px 0;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;width:160px;vertical-align:top;">N° Commande</td>
            <td style="padding:5px 0;color:#0f172a;font-size:14px;font-weight:700;">${escapeHtml(commande.numero)}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;vertical-align:top;">${escapeHtml(resolveTypeFournisseur(commande.fournisseur.typeFournisseur))}</td>
            <td style="padding:5px 0;color:#0f172a;font-size:13px;">${escapeHtml(commande.fournisseur.entreprise)}</td>
          </tr>
        </table>

        <p style="margin:0 0 10px;color:#0f172a;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Produits</p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #eef0f3;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#0f172a;">
              <th style="padding:10px 14px;text-align:left;color:#ffffff;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Désignation</th>
              <th style="padding:10px 14px;text-align:center;color:#ffffff;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Qté</th>
              <th style="padding:10px 14px;text-align:right;color:#ffffff;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${buildLignesRows(commande.lignes)}
          </tbody>
          <tfoot>
            <tr style="background:#eef2ff;">
              <td style="padding:10px 14px;color:#4338ca;font-size:13px;font-weight:700;" colspan="2">Montant Net</td>
              <td style="padding:10px 14px;color:#4338ca;font-size:13px;font-weight:700;text-align:right;">${formatXOF(Number(commande.montantNet))}</td>
            </tr>
          </tfoot>
        </table>

        ${footer ? `<div style="margin-top:24px;padding:14px 18px;background:#fef2f2;border-radius:10px;border:1px solid #fecaca;">
          <p style="margin:0;color:#991b1b;font-size:13px;line-height:1.5;">${footer}</p>
        </div>` : ""}

        <div style="margin-top:24px;text-align:center;">
          <a href="${url}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:700;">Voir le bon de commande</a>
        </div>
      </div>

      <div style="padding:16px 30px;background:#f8fafc;border-top:1px solid #eef0f3;">
        <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center;">Notification automatique &mdash; Réseaupub</p>
      </div>
    </div>
  </div>
  `;
}

export async function sendCommandeFournisseurCreeeNotification(commande: CommandeFournisseurForEmail) {
  // Même destinataires que la validation des budgets "admin" : rôles cochés
  // "canValidateBudgetMensuel" (Paramètres > Rôles) — remplace l'ancienne liste BUDGET_ADMIN_EMAILS.
  const recipients = await getBudgetRecipients("canValidateBudgetMensuel");
  if (recipients.length === 0) return;
  const intro = `Un nouveau bon de commande prestataire vient d'être créé (${escapeHtml(commande.fournisseur.entreprise)}). Imprimez-le pour signature : il sera validé une fois le scan signé joint.`;
  await notifier("BC_CREE", {
    to: recipients,
    subject: `Nouveau bon de commande prestataire ${commande.numero} à signer`,
    html: buildBaseHtml({ title: "🛒 Nouveau bon de commande prestataire", intro, commande }),
    message: texteBrut(intro),
    lien: `/fournisseur/${commande.fournisseurId}/commandes/${commande.id}`,
  });
}

/** Bon de commande signé et validé par la DG → comptables (ils pourront payer avance et solde). */
export async function sendCommandeFournisseurValideeNotification(commande: CommandeFournisseurForEmail) {
  const recipients = await getBudgetRecipients("canPayBudget");
  if (recipients.length === 0) return;
  const intro = `Le bon de commande ${escapeHtml(commande.numero)} (${escapeHtml(commande.fournisseur.entreprise)}) est signé et validé : l'avance peut être payée depuis la ligne de budget associée.`;
  await notifier("BC_VALIDE", {
    to: recipients,
    subject: `Bon de commande ${commande.numero} validé`,
    html: buildBaseHtml({ title: "✅ Bon de commande validé", intro, commande }),
    message: texteBrut(intro),
    lien: `/fournisseur/${commande.fournisseurId}/commandes/${commande.id}`,
  });
}

/** Contexte budgétaire d'un bon rattaché à une ligne : budget, demandeur et proforma(s) de la campagne. */
async function contexteBudgetCommande(commande: CommandeFournisseurForEmail) {
  if (!commande.ligneBudgetId) return null;
  const ligne = await prisma.demandeBudgetLigne.findUnique({
    where: { id: commande.ligneBudgetId },
    select: {
      designation: true,
      demandeBudget: {
        select: {
          numero: true,
          requesterEmail: true,
          proformas: { select: { invoice: { select: { numero: true, objet: true, client: { select: { nom: true } } } } } },
        },
      },
    },
  });
  if (!ligne) return null;
  const proformas = ligne.demandeBudget.proformas.map((p) => `${p.invoice.numero} (${p.invoice.client.nom} — ${p.invoice.objet})`);
  return { ligne: ligne.designation, budget: ligne.demandeBudget.numero, demandeur: ligne.demandeBudget.requesterEmail, proformas };
}

/**
 * Bon de commande rattaché à une ligne de budget accordée : validé d'office et « émis pour
 * exécution ». Prévient le demandeur du budget, les comptables et la direction.
 */
export async function sendCommandeEmiseNotification(commande: CommandeFournisseurForEmail) {
  const ctx = await contexteBudgetCommande(commande);
  const [comptables, direction] = await Promise.all([getBudgetRecipients("canPayBudget"), getBudgetRecipients("canValidateBudgetMensuel")]);
  const to = Array.from(new Set([...(ctx ? [ctx.demandeur] : []), ...comptables, ...direction].map((e) => e.toLowerCase())));
  if (to.length === 0) return;
  const activite = ctx?.proformas.length
    ? ` pour l'exécution de l'activité liée à la proforma ${escapeHtml(ctx.proformas.join(", "))}`
    : ctx ? ` pour l'exécution de la ligne « ${escapeHtml(ctx.ligne)} » du budget ${escapeHtml(ctx.budget)}` : "";
  const intro = `Le bon de commande ${escapeHtml(commande.numero)} a été émis${activite} (${escapeHtml(commande.fournisseur.entreprise)}). Il est validé : la ligne de budget est accordée.`;
  await notifier("BC_EMIS", {
    to,
    subject: `Bon de commande ${commande.numero} émis${ctx?.proformas.length ? ` — proforma ${ctx.proformas.map((p) => p.split(" ")[0]).join(", ")}` : ""}`,
    html: buildBaseHtml({
      title: "📤 Bon de commande émis",
      intro,
      commande,
      footer: "Le scan du bon de commande signé n'est pas encore joint : aucun paiement ne sera possible avant.",
    }),
    message: texteBrut(intro),
    lien: `/fournisseur/${commande.fournisseurId}/commandes/${commande.id}`,
  });
}

/** Bon validé d'office mais scan signé manquant : à imprimer, faire signer et joindre. */
export async function sendCommandeScanAJoindreNotification(commande: CommandeFournisseurForEmail) {
  const ctx = await contexteBudgetCommande(commande);
  const direction = await getBudgetRecipients("canValidateBudgetMensuel");
  const to = Array.from(new Set([...(ctx ? [ctx.demandeur] : []), ...direction].map((e) => e.toLowerCase())));
  if (to.length === 0) return;
  const intro = `Le bon de commande ${escapeHtml(commande.numero)} (${escapeHtml(commande.fournisseur.entreprise)}) est émis mais son scan signé n'est pas joint. Imprimez-le, faites-le signer par la Direction générale, puis joignez le scan sur la fiche du bon. Aucun paiement n'est possible avant.`;
  await notifier("BC_SCAN_A_JOINDRE", {
    to,
    subject: `Bon de commande ${commande.numero} : scan signé à joindre`,
    html: buildBaseHtml({ title: "✍️ Scan du bon de commande signé à joindre", intro, commande }),
    message: texteBrut(intro),
    lien: `/fournisseur/${commande.fournisseurId}/commandes/${commande.id}`,
  });
}
