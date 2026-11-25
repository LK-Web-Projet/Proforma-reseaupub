import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getBudgetRecipients } from "@/lib/budgetDestinataires";
import { escapeHtml } from "@/lib/email/sendEmail";
import { notifier, texteBrut } from "@/lib/notifications/notifier";
import { etatPiecesProforma } from "@/lib/proformaPieces";
import { journaliserProforma } from "@/lib/proformaHistoriqueServeur";
import { fcfa } from "@/lib/proformaHistorique";

const formatDate = (iso: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC" }).format(new Date(iso));

/**
 * Tâche du matin (jours ouvrés, 8 h) : les factures normalisées envoyées au client dont l'échéance
 * (date d'envoi + délai de relance) est atteinte, sur une proforma qui n'est pas soldée, et pas
 * encore notifiées, sont signalées en UNE notification aux comptables et à la direction (choix 6b),
 * puis marquées notifiées (relanceNotifieeAt) pour ne pas être renvoyées chaque jour. Le signal rouge
 * reste affiché à l'écran tant que le paiement est dû.
 */
/** Factures normalisées dont l'échéance est atteinte, pas encore notifiées (les plus en retard d'abord). */
export async function relancesEchues(db: Prisma.TransactionClient, maintenant: Date = new Date()) {
  const candidates = await db.documentProforma.findMany({
    where: {
      type: "FACTURE_NORMALISEE",
      dateEnvoiClient: { not: null },
      relanceNotifieeAt: null,
      invoice: { statut: { notIn: ["Annuler", "Archiver", "Solde", "Brouillon"] }, resteAPayer: { gt: 0 } },
    },
    select: {
      id: true,
      numeroFacture: true,
      precision: true,
      dateEnvoiClient: true,
      delaiRelanceJours: true,
      invoice: {
        select: {
          id: true,
          numero: true,
          objet: true,
          statut: true,
          resteAPayer: true,
          client: { select: { nom: true } },
          _count: { select: { paiements: { where: { type: "PAIEMENT" } } } },
        },
      },
    },
  });

  return candidates
    .map((d) => {
      const etat = etatPiecesProforma(
        { statut: d.invoice.statut, resteAPayer: Number(d.invoice.resteAPayer), aRecette: d.invoice._count.paiements > 0, documents: [{ ...d, type: "FACTURE_NORMALISEE" }] },
        maintenant
      );
      return { d, relance: etat.relances.find((r) => r.documentId === d.id) };
    })
    .filter((x): x is { d: (typeof candidates)[number]; relance: NonNullable<typeof x.relance> } => !!x.relance?.enRetard)
    .sort((a, b) => a.relance.joursRestants - b.relance.joursRestants);
}

export async function notifierRelancesProforma(maintenant: Date = new Date()): Promise<string> {
  const echues = await relancesEchues(prisma, maintenant);
  if (echues.length === 0) return "aucun paiement client à réclamer";

  const [comptables, direction] = await Promise.all([getBudgetRecipients("canPayBudget"), getBudgetRecipients("canValidateBudgetMensuel")]);
  const to = Array.from(new Set([...comptables, ...direction].map((e) => e.toLowerCase())));

  if (to.length > 0) {
    const total = echues.reduce((s, x) => s + Number(x.d.invoice.resteAPayer), 0);
    const lignes = echues
      .map(
        ({ d, relance }, i) => `
        <tr style="background:${i % 2 === 0 ? "#ffffff" : "#fef2f2"};">
          <td style="padding:9px 12px;border-bottom:1px solid #fee2e2;font-size:13px;color:#1f2937;">${escapeHtml(d.invoice.client.nom)}<br><span style="color:#64748b;font-size:11px;">${escapeHtml(d.invoice.numero)} · ${escapeHtml(d.invoice.objet)}</span></td>
          <td style="padding:9px 12px;border-bottom:1px solid #fee2e2;font-size:13px;color:#1f2937;">${escapeHtml(relance.libelle)}<br><span style="color:#64748b;font-size:11px;">envoyée le ${formatDate(d.dateEnvoiClient!.toISOString())} · ${d.delaiRelanceJours ?? 30} j</span></td>
          <td style="padding:9px 12px;border-bottom:1px solid #fee2e2;font-size:13px;color:#b91c1c;font-weight:700;white-space:nowrap;">${formatDate(relance.echeance)}</td>
          <td style="padding:9px 12px;border-bottom:1px solid #fee2e2;font-size:13px;color:#1f2937;text-align:right;white-space:nowrap;">${fcfa(Number(d.invoice.resteAPayer))}</td>
        </tr>`
      )
      .join("");
    const premier = echues[0].d.invoice;
    const intro =
      echues.length === 1
        ? `Le paiement de la proforma ${escapeHtml(premier.numero)} (${escapeHtml(premier.client.nom)}) est à réclamer : l'échéance de la facture normalisée est atteinte, il reste ${fcfa(Number(premier.resteAPayer))} à encaisser.`
        : `${echues.length} factures normalisées ont atteint leur échéance de paiement (${fcfa(total)} restant à encaisser au total).`;
    const url = `${process.env.NEXT_PUBLIC_APP_URL || "https://proforma.reseaupub.com"}/facture?alerte=reclamer`;
    const html = `
  <div style="font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f8;padding:32px 0;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      <div style="background:#991b1b;padding:24px 30px;">
        <p style="margin:0;color:#fecaca;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">Proformas &middot; Réseaupub</p>
        <h1 style="margin:8px 0 0;color:#ffffff;font-size:21px;">📣 Paiement client à réclamer</h1>
      </div>
      <div style="padding:24px 30px;">
        <p style="margin:0 0 18px;color:#334155;font-size:14px;line-height:1.5;">${intro}</p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #fee2e2;">
          <tr style="background:#fee2e2;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#7f1d1d;text-transform:uppercase;">Client / proforma</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#7f1d1d;text-transform:uppercase;">Facture</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#7f1d1d;text-transform:uppercase;">Échéance</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;color:#7f1d1d;text-transform:uppercase;">Reste à payer</th>
          </tr>
          ${lignes}
        </table>
        <p style="margin:22px 0 0;"><a href="${url}" style="display:inline-block;background:#b91c1c;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;">Voir les paiements à réclamer</a></p>
      </div>
    </div>
  </div>`;
    await notifier("PROFORMA_RELANCE_PAIEMENT", {
      to,
      subject: echues.length === 1 ? `Paiement à réclamer : proforma ${premier.numero} (${premier.client.nom})` : `${echues.length} paiements clients à réclamer`,
      html,
      message: texteBrut(intro),
      lien: echues.length === 1 ? `/facture/${premier.id}` : "/facture?alerte=reclamer",
    });
  }

  for (const { d, relance } of echues) {
    await prisma.documentProforma.update({ where: { id: d.id }, data: { relanceNotifieeAt: maintenant } });
    await journaliserProforma(
      prisma,
      d.invoice.id,
      "RELANCE_NOTIFIEE",
      `Échéance de paiement atteinte (${relance.libelle}, ${formatDate(relance.echeance)}) : comptables et direction prévenus — reste ${fcfa(Number(d.invoice.resteAPayer))}`,
      { nom: "Système" },
      { documentId: d.id, echeance: relance.echeance }
    );
  }
  return `${echues.length} paiement(s) client à réclamer notifié(s)${to.length === 0 ? " (aucun destinataire)" : ""}`;
}
