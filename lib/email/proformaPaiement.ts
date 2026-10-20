import { prisma } from "@/lib/prisma";
import { sendEmail, escapeHtml } from "./sendEmail";

interface ProduitLigne {
  designation: string;
  quantite: number;
}

interface InvoiceForPaiementEmail {
  id: string;
  numero: string;
  objet: string;
  totalTTC: number;
  devise: string;
  client: { nom: string };
  produits: ProduitLigne[];
}

interface PaiementNotificationData {
  invoice: InvoiceForPaiementEmail;
  montantPaye: number;
  resteAPayer: number;
  margeBrute: number;
}

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://proforma.reseaupub.com";
}

function formatMontant(value: number, devise: string) {
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(value))} ${devise}`;
}

/** Les destinataires sont les comptes Admin réels de l'app (rôle avec canManageUsers), pas une liste d'emails en dur. */
async function adminRecipients(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { active: true, role: { canManageUsers: true } },
    select: { email: true },
  });
  return admins.map((a) => a.email).filter(Boolean);
}

function buildProduitsRows(produits: ProduitLigne[]) {
  return produits
    .map(
      (p, idx) => `
        <tr style="background:${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
          <td style="padding:10px 14px;border-bottom:1px solid #eef0f3;color:#1f2937;font-size:13px;">${escapeHtml(p.designation)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #eef0f3;color:#1f2937;font-size:13px;text-align:center;">${p.quantite}</td>
        </tr>`
    )
    .join("");
}

function buildEmailHtml({ invoice, montantPaye, resteAPayer, margeBrute }: PaiementNotificationData) {
  const totalTTC = invoice.totalTTC;
  const devise = invoice.devise;
  const montantEncaisseTotal = totalTTC - resteAPayer;
  const pourcentage = totalTTC > 0 ? Math.min(100, Math.round((montantEncaisseTotal / totalTTC) * 1000) / 10) : 0;
  const margeColor = margeBrute >= 0 ? "#4338ca" : "#991b1b";
  const margeBg = margeBrute >= 0 ? "#eef2ff" : "#fef2f2";
  const url = `${getAppUrl()}/facture/${invoice.id}`;

  return `
  <div style="font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f8;padding:32px 0;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      <div style="background:linear-gradient(135deg,#16a34a,#15803d);padding:26px 30px;">
        <p style="margin:0;color:#dcfce7;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">Paiement reçu &middot; Réseaupub</p>
        <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;">🎊 Paiement réalisé !</h1>
      </div>

      <div style="padding:26px 30px;">
        <p style="margin:0 0 20px;color:#334155;font-size:14px;line-height:1.5;">
          Un paiement vient d'être enregistré sur la proforma <strong style="color:#0f172a;">${escapeHtml(invoice.numero)}</strong>. 🎉
        </p>

        <table style="width:100%;border-collapse:collapse;margin-bottom:22px;">
          <tr>
            <td style="padding:5px 0;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;width:160px;vertical-align:top;">N° Proforma</td>
            <td style="padding:5px 0;color:#0f172a;font-size:14px;font-weight:700;">${escapeHtml(invoice.numero)}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;vertical-align:top;">Objet</td>
            <td style="padding:5px 0;color:#0f172a;font-size:14px;">${escapeHtml(invoice.objet)}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;vertical-align:top;">Client</td>
            <td style="padding:5px 0;color:#0f172a;font-size:14px;font-weight:700;">${escapeHtml(invoice.client.nom)}</td>
          </tr>
        </table>

        <p style="margin:0 0 10px;color:#0f172a;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Produits / Prestations</p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #eef0f3;border-radius:8px;overflow:hidden;margin-bottom:22px;">
          <thead>
            <tr style="background:#0f172a;">
              <th style="padding:10px 14px;text-align:left;color:#ffffff;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Désignation</th>
              <th style="padding:10px 14px;text-align:center;color:#ffffff;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Qté</th>
            </tr>
          </thead>
          <tbody>
            ${buildProduitsRows(invoice.produits)}
          </tbody>
        </table>

        <table style="width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden;">
          <tr style="background:#ffffff;">
            <td style="padding:12px 14px;color:#475569;font-size:13px;">Total de la proforma</td>
            <td style="padding:12px 14px;color:#0f172a;font-size:14px;font-weight:700;text-align:right;">${formatMontant(totalTTC, devise)}</td>
          </tr>
          <tr style="background:#f8fafc;">
            <td style="padding:12px 14px;color:#475569;font-size:13px;">Total payé</td>
            <td style="padding:12px 14px;color:#0f172a;font-size:14px;font-weight:700;text-align:right;">${formatMontant(montantEncaisseTotal, devise)}</td>
          </tr>
          <tr style="background:#f0fdf4;">
            <td style="padding:12px 14px;color:#166534;font-size:13px;font-weight:700;">Payé à l'instant</td>
            <td style="padding:12px 14px;color:#166534;font-size:15px;font-weight:700;text-align:right;">${formatMontant(montantPaye, devise)}</td>
          </tr>
          <tr style="background:#ffffff;">
            <td style="padding:12px 14px;color:#475569;font-size:13px;">Payé à</td>
            <td style="padding:12px 14px;color:#0f172a;font-size:14px;font-weight:700;text-align:right;">${pourcentage}%</td>
          </tr>
          <tr style="background:#fef2f2;">
            <td style="padding:12px 14px;color:#b91c1c;font-size:13px;font-weight:700;">Reste à payer</td>
            <td style="padding:12px 14px;color:#b91c1c;font-size:15px;font-weight:700;text-align:right;">${formatMontant(resteAPayer, devise)}</td>
          </tr>
          <tr style="background:${margeBg};">
            <td style="padding:12px 14px;color:${margeColor};font-size:13px;font-weight:700;">Marge brute (proforma)</td>
            <td style="padding:12px 14px;color:${margeColor};font-size:15px;font-weight:700;text-align:right;">${formatMontant(margeBrute, devise)}</td>
          </tr>
        </table>

        <div style="margin-top:24px;text-align:center;">
          <a href="${url}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:700;">Voir la proforma</a>
        </div>
      </div>

      <div style="padding:16px 30px;background:#f8fafc;border-top:1px solid #eef0f3;">
        <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center;">Notification automatique &mdash; Réseaupub</p>
      </div>
    </div>
  </div>
  `;
}

export async function sendProformaPaiementNotification(data: PaiementNotificationData) {
  const recipients = await adminRecipients();
  if (recipients.length === 0) return;
  await sendEmail({
    to: recipients,
    subject: `🎊 Paiement reçu — Proforma ${data.invoice.numero} (${data.invoice.client.nom})`,
    html: buildEmailHtml(data),
  });
}
