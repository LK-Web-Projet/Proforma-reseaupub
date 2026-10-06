import type { Prisma } from "@prisma/client";
import { sendEmail, escapeHtml } from "./sendEmail";

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
        <p style="margin:0;color:#94a3b8;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">Bons de Commande Fournisseurs &middot; Réseaupub</p>
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
            <td style="padding:5px 0;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;vertical-align:top;">Fournisseur</td>
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

function adminRecipients(): string[] {
  return (process.env.BUDGET_ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);
}

export async function sendCommandeFournisseurCreeeNotification(commande: CommandeFournisseurForEmail) {
  const recipients = adminRecipients();
  if (recipients.length === 0) return;
  await sendEmail({
    to: recipients,
    subject: `Nouveau bon de commande fournisseur ${commande.numero} à valider`,
    html: buildBaseHtml({
      title: "🛒 Nouveau bon de commande fournisseur",
      intro: `Un nouveau bon de commande fournisseur vient d'être créé et attend votre validation.`,
      commande,
    }),
  });
}
