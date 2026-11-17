import type { Prisma } from "@prisma/client";
import { notifier } from "@/lib/notifications/notifier";

export type ValidatedInvoice = Prisma.InvoiceGetPayload<{
  include: {
    client: true;
    produits: { include: { produit: true } };
    gestionnaires: { include: { gestionnaire: true } };
  };
}>;

const NOTIFICATION_RECIPIENTS = [
  "info@reseaupub.com",
  "finance@reseaupub.com",
  "karamatouagbetou@reseaupub.com",
  "commercial@reseaupub.com",
  "partenariat@reseaupub.com",
  "informatique@reseaupub.com",
  "reseaupub01@gmail.com",
];

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDuree(p: ValidatedInvoice["produits"][number]) {
  if (!p.includeduree || !p.duree) return "-";
  return `${p.duree} ${p.uniteDuree ?? ""}`.trim();
}

function buildProduitsRows(produits: ValidatedInvoice["produits"]) {
  return produits
    .map(
      (p, idx) => `
        <tr style="background:${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">
          <td style="padding:10px 14px;border-bottom:1px solid #eef0f3;color:#1f2937;font-size:13px;">${escapeHtml(
            p.designation
          )}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #eef0f3;color:#1f2937;font-size:13px;text-align:center;">${escapeHtml(
            p.quantite
          )}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #eef0f3;color:#64748b;font-size:12px;text-align:center;">${escapeHtml(
            formatDuree(p)
          )}</td>
        </tr>`
    )
    .join("");
}

function buildEmailHtml(facture: ValidatedInvoice) {
  const gestionnaireNames =
    facture.gestionnaires
      .map((g) => `${g.gestionnaire.prenom} ${g.gestionnaire.nom}`)
      .join(", ") || "Non assigné";

  const dateValidation = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return `
  <div style="font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f8;padding:32px 0;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      <div style="background:#0f172a;padding:26px 30px;">
        <p style="margin:0;color:#94a3b8;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">Notification interne &middot; Réseaupub</p>
        <h1 style="margin:8px 0 0;color:#ffffff;font-size:21px;">✅ Proforma validée</h1>
      </div>

      <div style="padding:26px 30px;">
        <p style="margin:0 0 20px;color:#334155;font-size:14px;line-height:1.5;">
          La proforma <strong style="color:#0f172a;">${escapeHtml(
            facture.numero
          )}</strong> a été <strong style="color:#4f46e5;">validée</strong> le ${dateValidation}. Merci d'en prendre connaissance et de préparer le suivi nécessaire.
        </p>

        <table style="width:100%;border-collapse:collapse;margin-bottom:22px;">
          <tr>
            <td style="padding:5px 0;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;width:150px;vertical-align:top;">N° Proforma</td>
            <td style="padding:5px 0;color:#0f172a;font-size:14px;font-weight:700;">${escapeHtml(facture.numero)}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;vertical-align:top;">Objet</td>
            <td style="padding:5px 0;color:#0f172a;font-size:14px;">${escapeHtml(facture.objet)}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;vertical-align:top;">Client</td>
            <td style="padding:5px 0;color:#0f172a;font-size:14px;font-weight:700;">${escapeHtml(facture.client?.nom)}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;vertical-align:top;">Contact client</td>
            <td style="padding:5px 0;color:#0f172a;font-size:13px;">
              ${escapeHtml(facture.client?.email || "Email non renseigné")}${
    facture.client?.telephone ? ` &middot; ${escapeHtml(facture.client.telephone)}` : ""
  }
            </td>
          </tr>
          ${
            facture.client?.adresse
              ? `<tr>
                  <td style="padding:5px 0;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;vertical-align:top;">Adresse</td>
                  <td style="padding:5px 0;color:#0f172a;font-size:13px;">${escapeHtml(facture.client.adresse)}</td>
                </tr>`
              : ""
          }
          <tr>
            <td style="padding:5px 0;color:#64748b;font-size:11px;font-weight:700;text-transform:uppercase;vertical-align:top;">Gestionnaire</td>
            <td style="padding:5px 0;color:#0f172a;font-size:13px;">${escapeHtml(gestionnaireNames)}</td>
          </tr>
        </table>

        <p style="margin:0 0 10px;color:#0f172a;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Produits / Prestations proposés</p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #eef0f3;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#0f172a;">
              <th style="padding:10px 14px;text-align:left;color:#ffffff;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Désignation</th>
              <th style="padding:10px 14px;text-align:center;color:#ffffff;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Quantité</th>
              <th style="padding:10px 14px;text-align:center;color:#ffffff;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Durée</th>
            </tr>
          </thead>
          <tbody>
            ${buildProduitsRows(facture.produits)}
          </tbody>
        </table>

        <div style="margin-top:24px;padding:14px 18px;background:#eef2ff;border-radius:10px;border:1px solid #e0e7ff;">
          <p style="margin:0;color:#4338ca;font-size:12px;line-height:1.5;">
            ℹ️ Les montants ne sont pas inclus dans cette notification. Consultez la fiche de la proforma dans l'application pour le détail financier complet.
          </p>
        </div>
      </div>

      <div style="padding:16px 30px;background:#f8fafc;border-top:1px solid #eef0f3;">
        <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center;">Notification automatique &mdash; Réseaupub</p>
      </div>
    </div>
  </div>
  `;
}

// Passe désormais par notifier (donc par sendEmail et l'interrupteur EMAIL_DISABLED) : même email
// qu'avant (adresse d'envoi en destinataire, liste de diffusion en copie), et une notification dans
// l'application pour les adresses de la liste qui ont un compte.
export async function sendProformaValidatedNotification(facture: ValidatedInvoice) {
  await notifier("PROFORMA_VALIDEE", {
    to: process.env.EMAIL_FROM ?? NOTIFICATION_RECIPIENTS[0],
    cc: NOTIFICATION_RECIPIENTS,
    subject: `${facture.client?.nom ?? "Client"} - Commande validée - Proforma ${facture.numero} - ${facture.objet}`,
    html: buildEmailHtml(facture),
    message: `La proforma ${facture.numero} (${facture.client?.nom ?? "client"} — ${facture.objet}) a été validée par le client.`,
    lien: `/facture/${facture.id}`,
  });
}
