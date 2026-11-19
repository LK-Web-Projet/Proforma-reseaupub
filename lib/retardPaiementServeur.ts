import type { EntrepriseConfig } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getEntrepriseConfig } from "@/lib/entreprise";
import { getBudgetRecipients } from "@/lib/budgetDestinataires";
import { escapeHtml } from "@/lib/email/sendEmail";
import { notifier, texteBrut } from "@/lib/notifications/notifier";
import { resolveTypeFournisseur } from "@/lib/typeFournisseur";
import { etatEcheance, type DelaisPaiement } from "@/lib/retardPaiement";

/** Délais de paiement réglés dans Paramètres > Rôles. */
export function delaisDepuisConfig(
  config: Pick<EntrepriseConfig, "delaiPaiementFournisseur" | "delaiPaiementInterne" | "delaiPaiementExterne">
): DelaisPaiement {
  return {
    fournisseur: config.delaiPaiementFournisseur,
    interne: config.delaiPaiementInterne,
    externe: config.delaiPaiementExterne,
  };
}

export async function getDelaisPaiement(): Promise<DelaisPaiement> {
  return delaisDepuisConfig(await getEntrepriseConfig());
}

const formatXOF = (v: number) => `${new Intl.NumberFormat("fr-FR").format(v)} XOF`;
const formatDate = (iso: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC" }).format(new Date(iso));

/**
 * Tâche planifiée (chaque jour ouvré, le matin) : les factures prestataires qui viennent de passer
 * en retard — pas encore notifiées — sont signalées en UNE notification aux comptables (ils paient)
 * et à la direction, puis marquées notifiées (retardNotifieAt) pour ne pas être renvoyées chaque jour.
 * Le signal visuel (ligne rouge, bouton clignotant) reste, lui, affiché tant que la facture est due.
 */
export async function notifierRetardsPaiement(maintenant: Date = new Date()): Promise<string> {
  const delais = await getDelaisPaiement();
  const candidates = await prisma.factureFournisseur.findMany({
    where: { status: "EN_ATTENTE", retardNotifieAt: null },
    select: {
      id: true,
      reference: true,
      montant: true,
      date: true,
      status: true,
      fournisseur: { select: { id: true, entreprise: true, typeFournisseur: true } },
    },
  });

  const enRetard = candidates
    .map((f) => ({ f, etat: etatEcheance(f, f.fournisseur.typeFournisseur, delais, maintenant) }))
    .filter((x): x is { f: (typeof candidates)[number]; etat: NonNullable<typeof x.etat> } => !!x.etat?.enRetard)
    .sort((a, b) => b.etat.joursRetard - a.etat.joursRetard);
  if (enRetard.length === 0) return "aucune nouvelle facture en retard";

  const [comptables, direction] = await Promise.all([
    getBudgetRecipients("canPayBudget"),
    getBudgetRecipients("canValidateBudgetMensuel"),
  ]);
  const to = Array.from(new Set([...comptables, ...direction].map((e) => e.toLowerCase())));

  if (to.length > 0) {
    const total = enRetard.reduce((s, x) => s + Number(x.f.montant), 0);
    const lignes = enRetard
      .map(
        ({ f, etat }, i) => `
        <tr style="background:${i % 2 === 0 ? "#ffffff" : "#fef2f2"};">
          <td style="padding:9px 12px;border-bottom:1px solid #fee2e2;font-size:13px;color:#1f2937;">${escapeHtml(f.fournisseur.entreprise)}<br><span style="color:#64748b;font-size:11px;">${escapeHtml(resolveTypeFournisseur(f.fournisseur.typeFournisseur))} · délai ${etat.delai} j</span></td>
          <td style="padding:9px 12px;border-bottom:1px solid #fee2e2;font-size:13px;color:#1f2937;">${escapeHtml(f.reference)}</td>
          <td style="padding:9px 12px;border-bottom:1px solid #fee2e2;font-size:13px;color:#1f2937;white-space:nowrap;">${formatDate(etat.echeance)}</td>
          <td style="padding:9px 12px;border-bottom:1px solid #fee2e2;font-size:13px;color:#b91c1c;font-weight:700;white-space:nowrap;">${etat.joursRetard} j</td>
          <td style="padding:9px 12px;border-bottom:1px solid #fee2e2;font-size:13px;color:#1f2937;text-align:right;white-space:nowrap;">${formatXOF(Number(f.montant))}</td>
        </tr>`
      )
      .join("");
    const intro =
      enRetard.length === 1
        ? `La facture ${escapeHtml(enRetard[0].f.reference)} de ${escapeHtml(enRetard[0].f.fournisseur.entreprise)} a dépassé son délai de paiement (${enRetard[0].etat.joursRetard} j de retard, ${formatXOF(Number(enRetard[0].f.montant))}).`
        : `${enRetard.length} factures prestataires ont dépassé leur délai de paiement (${formatXOF(total)} au total).`;
    const url = `${process.env.NEXT_PUBLIC_APP_URL || "https://proforma.reseaupub.com"}/fournisseur/factures?retard=1`;
    const html = `
  <div style="font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f8;padding:32px 0;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
      <div style="background:#991b1b;padding:24px 30px;">
        <p style="margin:0;color:#fecaca;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">Factures prestataires &middot; Réseaupub</p>
        <h1 style="margin:8px 0 0;color:#ffffff;font-size:21px;">⏰ Paiement en retard</h1>
      </div>
      <div style="padding:24px 30px;">
        <p style="margin:0 0 18px;color:#334155;font-size:14px;line-height:1.5;">${intro}</p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #fee2e2;">
          <tr style="background:#fee2e2;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#7f1d1d;text-transform:uppercase;">Prestataire</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#7f1d1d;text-transform:uppercase;">Facture</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#7f1d1d;text-transform:uppercase;">Échéance</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;color:#7f1d1d;text-transform:uppercase;">Retard</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;color:#7f1d1d;text-transform:uppercase;">Montant</th>
          </tr>
          ${lignes}
        </table>
        <p style="margin:22px 0 0;"><a href="${url}" style="display:inline-block;background:#b91c1c;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600;">Voir les factures en retard</a></p>
        <p style="margin:16px 0 0;color:#64748b;font-size:12px;">Délais : Fournisseur ${delais.fournisseur} j · Prestataire interne ${delais.interne} j · Prestataire externe ${delais.externe} j (Paramètres &gt; Rôles).</p>
      </div>
    </div>
  </div>`;
    await notifier("FACTURE_PRESTATAIRE_RETARD", {
      to,
      subject:
        enRetard.length === 1
          ? `Facture ${enRetard[0].f.reference} en retard de paiement (${enRetard[0].f.fournisseur.entreprise})`
          : `${enRetard.length} factures prestataires en retard de paiement`,
      html,
      message: texteBrut(intro),
      lien: "/fournisseur/factures?retard=1",
    });
  }

  await prisma.factureFournisseur.updateMany({
    where: { id: { in: enRetard.map((x) => x.f.id) } },
    data: { retardNotifieAt: maintenant },
  });
  return `${enRetard.length} facture(s) en retard notifiée(s)${to.length === 0 ? " (aucun destinataire)" : ""}`;
}
