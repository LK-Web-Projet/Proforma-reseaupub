import prisma from "@/lib/prisma";
import { escapeHtml } from "@/lib/email/sendEmail";
import type { JustificatifManquant } from "@/lib/email/demandeBudget";
import { getBudgetRecipients } from "@/lib/budgetAuth";
import { montantAccordeLigne } from "@/lib/budgetSuivi";
import { echeanceJustificatif, etatJustificatif } from "@/lib/justificatifs";
import { etatLiasse } from "@/lib/commandeFournisseurLiasse";
import { MODE_PAIEMENT_VALUES, modePaiementLabel } from "@/lib/budgetTypes";
import { notifier } from "@/lib/notifications/notifier";

// État du soir (procédure de paiement, sections 7 et 8) envoyé à la DG, comptables en copie :
//   1. par campagne ouverte : prévu, payé par moyen (espèces, MoMo, chèque, virement, carte), payé
//      du jour, reste à payer ;
//   2. justificatifs manquants (en retard d'abord) ;
//   3. avances fournisseurs non justifiées (liasse incomplète).
// Canal (email / application / les deux) : Paramètres > Notifications, événement ETAT_DU_SOIR.

const FUSEAU = "Africa/Porto-Novo";
const jourBenin = (d: Date) => new Intl.DateTimeFormat("fr-CA", { timeZone: FUSEAU }).format(d); // AAAA-MM-JJ

export async function listerJustificatifsManquants(maintenant = new Date()): Promise<JustificatifManquant[]> {
  const depenses = await prisma.budgetDepense.findMany({
    where: { annuleeAt: null, attachments: { none: {} } },
    orderBy: { createdAt: "asc" },
    include: {
      demandeBudget: { select: { id: true, numero: true } },
      ligne: { select: { designation: true } },
      cashRegister: { select: { name: true } },
    },
  });
  return depenses
    .map((d) => ({
      demandeId: d.demandeBudget.id,
      numero: d.demandeBudget.numero,
      designation: d.ligne.designation,
      nomReceveur: d.nomReceveur,
      montant: Number(d.montant),
      dateDepense: d.dateDepense,
      echeance: echeanceJustificatif(d.createdAt),
      enRetard: etatJustificatif({ createdAt: d.createdAt, nbJustificatifs: 0 }, maintenant) === "EN_RETARD",
      caisse: d.cashRegister.name,
      enregistrePar: d.createdByEmail,
      motifSansJustificatif: d.motifSansJustificatif,
    }))
    .sort((a, b) => Number(b.enRetard) - Number(a.enRetard) || a.echeance.getTime() - b.echeance.getTime());
}

export interface CampagneEtat {
  demandeId: string;
  numero: string;
  libelle: string; // client(s) / objet
  prevu: number; // accordé + dépassements approuvés
  paye: number;
  payeParMode: { mode: string; label: string; montant: number }[];
  payeDuJour: number;
  reste: number;
}

export interface AvanceNonJustifiee {
  demandeId: string;
  numeroBudget: string;
  commandeId: string;
  fournisseurId: string;
  numeroCommande: string;
  fournisseur: string;
  montant: number;
  dateDepense: Date;
  manquantes: string[];
}

export interface EtatSoir {
  jour: string;
  campagnes: CampagneEtat[];
  justificatifs: JustificatifManquant[];
  avancesNonJustifiees: AvanceNonJustifiee[];
}

export async function construireEtatSoir(maintenant = new Date()): Promise<EtatSoir> {
  const jour = jourBenin(maintenant);

  const budgets = await prisma.demandeBudget.findMany({
    where: { type: "CAMPAGNE", statut: { in: ["VALIDATION_PARTIELLE", "VALIDEE", "EN_COURS"] } },
    orderBy: { numero: "asc" },
    include: {
      lignes: true,
      depenses: { where: { annuleeAt: null }, select: { montant: true, modePaiement: true, dateDepense: true, createdAt: true } },
      depassements: { where: { statut: "APPROUVE" }, select: { montant: true } },
      proformas: { select: { invoice: { select: { numero: true, objet: true, client: { select: { nom: true } } } } } },
    },
  });
  const campagnes: CampagneEtat[] = budgets.map((b) => {
    const prevu = b.lignes.reduce((s, l) => s + montantAccordeLigne(l), 0) + b.depassements.reduce((s, x) => s + Number(x.montant), 0);
    const parMode = new Map<string, number>();
    let payeDuJour = 0;
    for (const d of b.depenses) {
      parMode.set(d.modePaiement, (parMode.get(d.modePaiement) ?? 0) + Number(d.montant));
      if (jourBenin(d.createdAt) === jour) payeDuJour += Number(d.montant);
    }
    const paye = Array.from(parMode.values()).reduce((s, v) => s + v, 0);
    const connus: readonly string[] = MODE_PAIEMENT_VALUES;
    const ordre = [...connus.filter((m) => parMode.has(m)), ...Array.from(parMode.keys()).filter((m) => !connus.includes(m))];
    const clients = Array.from(new Set(b.proformas.map((p) => p.invoice.client.nom)));
    return {
      demandeId: b.id,
      numero: b.numero,
      libelle: clients.length > 0 ? `${clients.join(", ")} — ${b.proformas[0].invoice.objet}` : b.pourLeCompteDe ?? b.contexteMotivation.slice(0, 60),
      prevu,
      paye,
      payeParMode: ordre.map((mode) => ({ mode, label: modePaiementLabel(mode), montant: parMode.get(mode)! })),
      payeDuJour,
      reste: Math.max(prevu - paye, 0),
    };
  });

  const avances = await prisma.budgetDepense.findMany({
    where: { annuleeAt: null, nature: "AVANCE", commandeId: { not: null } },
    orderBy: { dateDepense: "asc" },
    include: {
      demandeBudget: { select: { id: true, numero: true } },
      commande: {
        select: {
          id: true,
          numero: true,
          fournisseurId: true,
          fournisseur: { select: { entreprise: true } },
          documents: { select: { kind: true } },
          factures: { select: { pieceJointe: true, status: true } },
        },
      },
    },
  });
  const avancesNonJustifiees: AvanceNonJustifiee[] = avances.flatMap((a) => {
    if (!a.commande) return [];
    const liasse = etatLiasse(a.commande.documents, a.commande.factures);
    if (liasse.complete) return [];
    return [{
      demandeId: a.demandeBudget.id,
      numeroBudget: a.demandeBudget.numero,
      commandeId: a.commande.id,
      fournisseurId: a.commande.fournisseurId,
      numeroCommande: a.commande.numero,
      fournisseur: a.commande.fournisseur.entreprise,
      montant: Number(a.montant),
      dateDepense: a.dateDepense,
      manquantes: liasse.manquantes,
    }];
  });

  return { jour, campagnes, justificatifs: await listerJustificatifsManquants(maintenant), avancesNonJustifiees };
}

const nf = (n: number) => `${new Intl.NumberFormat("fr-FR").format(Math.round(n))} F`;
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || "https://proforma.reseaupub.com";
const th = (t: string, droite = false) =>
  `<th style="padding:7px 9px;text-align:${droite ? "right" : "left"};color:#fff;font-size:10px;text-transform:uppercase;">${t}</th>`;
const td = (t: string, opts: { droite?: boolean; style?: string } = {}) =>
  `<td style="padding:7px 9px;border-bottom:1px solid #eef0f3;font-size:12px;${opts.droite ? "text-align:right;white-space:nowrap;" : ""}${opts.style ?? ""}">${t}</td>`;
const titre = (t: string) => `<p style="margin:22px 0 8px;color:#0f172a;font-size:13px;font-weight:700;text-transform:uppercase;">${t}</p>`;

function construireHtml(etat: EtatSoir): string {
  const dateFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeZone: FUSEAU }).format(new Date(`${etat.jour}T12:00:00Z`));
  const campagnes = etat.campagnes.length
    ? `<table style="width:100%;border-collapse:collapse;border:1px solid #eef0f3;"><thead><tr style="background:#0f172a;">${th("Campagne")}${th("Prévu", true)}${th("Payé (par moyen)", true)}${th("Aujourd'hui", true)}${th("Reste", true)}</tr></thead><tbody>${etat.campagnes
        .map(
          (c) =>
            `<tr>${td(`<a href="${appUrl()}/budget/demandes/${c.demandeId}" style="color:#4f46e5;font-weight:700;text-decoration:none;">${escapeHtml(c.numero)}</a><br/><span style="color:#64748b;">${escapeHtml(c.libelle)}</span>`)}${td(nf(c.prevu), { droite: true })}${td(
              `<strong>${nf(c.paye)}</strong>${c.payeParMode.map((m) => `<br/><span style="color:#64748b;">${escapeHtml(m.label)} : ${nf(m.montant)}</span>`).join("")}`,
              { droite: true }
            )}${td(c.payeDuJour ? nf(c.payeDuJour) : "—", { droite: true })}${td(nf(c.reste), { droite: true, style: c.reste === 0 ? "color:#b91c1c;" : "" })}</tr>`
        )
        .join("")}</tbody></table>`
    : `<p style="color:#64748b;font-size:13px;">Aucune campagne en cours.</p>`;

  const justifs = etat.justificatifs.length
    ? `<table style="width:100%;border-collapse:collapse;border:1px solid #eef0f3;"><thead><tr style="background:#0f172a;">${th("Budget")}${th("Dépense")}${th("Montant", true)}${th("Échéance")}</tr></thead><tbody>${etat.justificatifs
        .map(
          (j) =>
            `<tr style="${j.enRetard ? "background:#fef2f2;" : ""}">${td(`<a href="${appUrl()}/budget/demandes/${j.demandeId}" style="color:#4f46e5;text-decoration:none;">${escapeHtml(j.numero)}</a>`)}${td(`${escapeHtml(j.designation)}<br/><span style="color:#64748b;">${escapeHtml(j.nomReceveur)} · ${escapeHtml(j.caisse)}</span>`)}${td(nf(j.montant), { droite: true })}${td(
              `${j.enRetard ? "<strong>En retard</strong> depuis" : "Avant"} le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: FUSEAU }).format(j.echeance)}`,
              { style: j.enRetard ? "color:#b91c1c;" : "" }
            )}</tr>`
        )
        .join("")}</tbody></table>`
    : `<p style="color:#15803d;font-size:13px;">Aucun justificatif manquant.</p>`;

  const avances = etat.avancesNonJustifiees.length
    ? `<table style="width:100%;border-collapse:collapse;border:1px solid #eef0f3;"><thead><tr style="background:#0f172a;">${th("Bon de commande")}${th("Montant", true)}${th("Manque")}</tr></thead><tbody>${etat.avancesNonJustifiees
        .map(
          (a) =>
            `<tr style="background:#fef2f2;">${td(`<a href="${appUrl()}/fournisseur/${a.fournisseurId}/commandes/${a.commandeId}" style="color:#4f46e5;text-decoration:none;">${escapeHtml(a.numeroCommande)}</a><br/><span style="color:#64748b;">${escapeHtml(a.fournisseur)} · budget ${escapeHtml(a.numeroBudget)}</span>`)}${td(nf(a.montant), { droite: true })}${td(escapeHtml(a.manquantes.join(", ")), { style: "color:#b91c1c;" })}</tr>`
        )
        .join("")}</tbody></table>`
    : `<p style="color:#15803d;font-size:13px;">Aucune avance non justifiée.</p>`;

  return `
  <div style="font-family:'Segoe UI',Arial,sans-serif;background:#f4f6f8;padding:28px 0;">
    <div style="max-width:720px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;">
      <div style="background:#0f172a;padding:22px 26px;">
        <p style="margin:0;color:#94a3b8;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">État du soir &middot; Réseaupub</p>
        <h1 style="margin:8px 0 0;color:#fff;font-size:19px;">${escapeHtml(dateFr)}</h1>
      </div>
      <div style="padding:6px 26px 24px;">
        ${titre(`Campagnes en cours (${etat.campagnes.length})`)}${campagnes}
        ${titre(`Justificatifs manquants (${etat.justificatifs.length}, dont ${etat.justificatifs.filter((j) => j.enRetard).length} en retard)`)}${justifs}
        ${titre(`Avances fournisseurs non justifiées (${etat.avancesNonJustifiees.length})`)}${avances}
      </div>
      <div style="padding:12px 26px;background:#f8fafc;border-top:1px solid #eef0f3;">
        <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center;">Envoi automatique les jours ouvrés à 19 h &mdash; Réseaupub</p>
      </div>
    </div>
  </div>`;
}

/** Envoie l'état du soir (rien s'il n'y a ni campagne en cours, ni justificatif manquant, ni avance à justifier). */
export async function envoyerEtatSoir(etat: EtatSoir): Promise<{ envoye: boolean; destinataires: number }> {
  if (etat.campagnes.length === 0 && etat.justificatifs.length === 0 && etat.avancesNonJustifiees.length === 0) {
    return { envoye: false, destinataires: 0 };
  }
  const [dg, comptables] = await Promise.all([getBudgetRecipients("canValidateBudgetMensuel"), getBudgetRecipients("canPayBudget")]);
  if (dg.length === 0) return { envoye: false, destinataires: 0 };
  const cc = comptables.filter((e) => !dg.includes(e));
  const enRetard = etat.justificatifs.filter((j) => j.enRetard).length;
  await notifier("ETAT_DU_SOIR", {
    to: dg,
    cc,
    subject: `État du soir — ${etat.campagnes.length} campagne(s), ${etat.justificatifs.length} justificatif(s) manquant(s)${enRetard ? ` dont ${enRetard} en retard` : ""}`,
    html: construireHtml(etat),
    message: `${etat.campagnes.length} campagne(s) en cours, payé aujourd'hui : ${nf(etat.campagnes.reduce((s, c) => s + c.payeDuJour, 0))}. ${etat.justificatifs.length} justificatif(s) manquant(s) (${enRetard} en retard), ${etat.avancesNonJustifiees.length} avance(s) non justifiée(s).`,
    lien: "/budget/demandes",
  });
  return { envoye: true, destinataires: dg.length + cc.length };
}
