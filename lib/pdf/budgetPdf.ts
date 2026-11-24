// Impression d'un budget pour signature (procédure de paiement, section 4) : le chef de projet
// imprime le budget, la DG le signe, puis le scan signé est joint sur la plateforme (document
// « Budget signé ») avant la validation. Généré côté navigateur avec pdf-lib, comme le bon de
// commande fournisseur.
import type { PDFFont } from "pdf-lib";

export interface BudgetPdfEntreprise {
  nom: string;
  adresse: string;
  telephone: string;
  emailFinance: string;
  ifu: string;
}

export interface BudgetPdfData {
  numero: string;
  typeLabel: string;
  periode: string | null; // ex. "novembre 2026" (budget mensuel)
  createdAt: Date;
  demandeur: string;
  departement: string | null;
  pourLeCompteDe: string | null;
  contexteMotivation: string;
  proformas: { numero: string; client: string; objet: string }[];
  lignes: {
    designation: string;
    /** Département de la ligne (imprimé sous la désignation). */
    departement?: string | null;
    /** Détail facultatif de la ligne (imprimé sous la désignation). */
    detail?: string | null;
    /** Délai de la ligne déjà formaté (jj/mm/aaaa), ou null. */
    delai?: string | null;
    categorie: string;
    modePaiement: string;
    demande: number;
    accorde: number | null; // null = pas encore décidée
    retiree: boolean;
  }[];
  totauxParMode: { label: string; demande: number; accorde: number }[];
  /** Total par département (lignes non retirées). */
  totauxParDepartement?: { nom: string; demande: number; accorde: number }[];
  /** Libellé de la personne qui prépare (« Chef de projet » pour une campagne). */
  preparePar: string;
}

// Les polices standard de pdf-lib (WinAnsi) ne savent pas tout encoder : espaces fines, émojis…
function clean(text: string): string {
  return (text ?? "")
    .replace(/[  ]/g, " ")
    .replace(/[^\x20-\x7E -ÿ–—‘’“”…€Œœ]/g, "");
}

const montant = (n: number) => clean(`${new Intl.NumberFormat("fr-FR").format(Math.round(n))} F`);

export async function generateBudgetPdf(data: BudgetPdfData, entreprise: BudgetPdfEntreprise): Promise<Uint8Array> {
  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");

  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  const primary = rgb(0.937, 0.043, 0.325); // #ef0b53, charte Réseaupub
  const light = rgb(1, 0.95, 0.96);
  const gray = rgb(0.45, 0.45, 0.45);
  const black = rgb(0, 0, 0);
  const white = rgb(1, 1, 1);

  const W = 595;
  const H = 842;
  const M = 40; // marge
  let page = doc.addPage([W, H]);
  let y = H;

  /** Coupe un texte en lignes tenant dans `maxWidth`. */
  const wrap = (text: string, font: PDFFont, size: number, maxWidth: number): string[] => {
    const lignes: string[] = [];
    for (const paragraphe of clean(text).split(/\r?\n/)) {
      let courante = "";
      for (const mot of paragraphe.split(/\s+/).filter(Boolean)) {
        const essai = courante ? `${courante} ${mot}` : mot;
        if (font.widthOfTextAtSize(essai, size) <= maxWidth) {
          courante = essai;
        } else {
          if (courante) lignes.push(courante);
          courante = mot;
        }
      }
      lignes.push(courante);
    }
    return lignes;
  };

  const text = (t: string, x: number, yy: number, size = 9, font: PDFFont = fontRegular, color = black) =>
    page.drawText(clean(t), { x, y: yy, size, font, color });

  const textRight = (t: string, xRight: number, yy: number, size = 9, font: PDFFont = fontRegular, color = black) => {
    const c = clean(t);
    page.drawText(c, { x: xRight - font.widthOfTextAtSize(c, size), y: yy, size, font, color });
  };

  // ── En-tête (première page) ────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: H - 110, width: W, height: 110, color: primary });
  text(clean(`BUDGET — ${data.typeLabel.toUpperCase()}`), M, H - 45, 17, fontBold, white);
  text(`N° ${data.numero}${data.periode ? ` | ${data.periode}` : ""}`, M, H - 68, 10, fontRegular, white);
  text(
    `Établi le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(data.createdAt)}`,
    M,
    H - 84,
    9,
    fontRegular,
    white
  );
  textRight(entreprise.nom.toUpperCase(), W - M, H - 40, 11, fontBold, white);
  textRight(entreprise.adresse, W - M, H - 55, 8, fontRegular, white);
  textRight(`IFU : ${entreprise.ifu}`, W - M, H - 67, 8, fontRegular, white);
  textRight(`Tél : ${entreprise.telephone}`, W - M, H - 79, 8, fontRegular, white);
  textRight(entreprise.emailFinance, W - M, H - 91, 8, fontRegular, white);
  y = H - 135;

  // ── Informations ──────────────────────────────────────────────────────────
  const infos: [string, string][] = [["Demandeur", data.demandeur]];
  if (data.departement) infos.push(["Service", data.departement]);
  if (data.pourLeCompteDe) infos.push(["Pour le compte de", data.pourLeCompteDe]);
  for (const p of data.proformas) infos.push(["Proforma", `${p.numero} — ${p.client} — ${p.objet}`]);
  for (const [label, valeur] of infos) {
    text(`${label} :`, M, y, 9, fontBold, gray);
    const lignes = wrap(valeur, fontRegular, 9, W - 2 * M - 110);
    lignes.forEach((l, i) => text(l, M + 110, y - i * 12, 9));
    y -= 12 * lignes.length + 3;
  }
  y -= 4;
  text("Contexte et motivation :", M, y, 9, fontBold, gray);
  y -= 13;
  for (const l of wrap(data.contexteMotivation, fontRegular, 9, W - 2 * M).slice(0, 8)) {
    text(l, M, y, 9);
    y -= 12;
  }
  y -= 10;

  // ── Tableau des lignes ────────────────────────────────────────────────────
  const cols = [
    { titre: "Désignation", x: M, w: 205 },
    { titre: "Catégorie", x: M + 205, w: 80 },
    { titre: "Moyen", x: M + 285, w: 75 },
    { titre: "Demandé", x: M + 360, w: 78, right: true },
    { titre: "Accordé", x: M + 438, w: 77, right: true },
  ];
  const enTeteTableau = () => {
    page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 20, color: primary });
    for (const c of cols) {
      if (c.right) textRight(c.titre, c.x + c.w - 4, y, 9, fontBold, white);
      else text(c.titre, c.x + 4, y, 9, fontBold, white);
    }
    y -= 22;
  };
  const nouvellePage = () => {
    page = doc.addPage([W, H]);
    y = H - 50;
    text(`Budget ${data.numero} (suite)`, M, y, 10, fontBold, primary);
    y -= 24;
  };

  enTeteTableau();
  data.lignes.forEach((l, idx) => {
    const lignesDesignation = wrap(l.designation, fontRegular, 9, cols[0].w - 8);
    // Sous la désignation, en petit : le délai puis le détail (limité à 6 lignes pour la mise en page).
    const complements: string[] = [];
    if (l.retiree) complements.push("(retirée)");
    if (l.departement) complements.push(`Département : ${l.departement}`);
    if (l.delai) complements.push(`Délai : ${l.delai}`);
    if (l.detail?.trim()) {
      const lignesDetail = wrap(l.detail.trim(), fontRegular, 7, cols[0].w - 8).filter(Boolean);
      complements.push(...lignesDetail.slice(0, 6));
      if (lignesDetail.length > 6) complements[complements.length - 1] += " …";
    }
    const hauteur = Math.max(18, lignesDesignation.length * 11 + complements.length * 9 + 7);
    if (y - hauteur < 230) {
      nouvellePage();
      enTeteTableau();
    }
    page.drawRectangle({ x: M, y: y - hauteur + 12, width: W - 2 * M, height: hauteur, color: idx % 2 === 0 ? white : light });
    const couleur = l.retiree ? gray : black;
    lignesDesignation.forEach((t, i) => text(t, cols[0].x + 4, y - i * 11, 9, fontRegular, couleur));
    complements.forEach((t, i) => text(t, cols[0].x + 4, y - lignesDesignation.length * 11 - i * 9 + 2, 7, fontRegular, gray));
    text(l.categorie, cols[1].x + 4, y, 8, fontRegular, couleur);
    text(l.modePaiement, cols[2].x + 4, y, 8, fontRegular, couleur);
    textRight(montant(l.demande), cols[3].x + cols[3].w - 4, y, 9, fontRegular, couleur);
    textRight(l.accorde === null ? "—" : montant(l.accorde), cols[4].x + cols[4].w - 4, y, 9, fontRegular, couleur);
    y -= hauteur;
  });

  // ── Totaux ────────────────────────────────────────────────────────────────
  const totalDemande = data.lignes.filter((l) => !l.retiree).reduce((s, l) => s + l.demande, 0);
  const totalAccorde = data.lignes.reduce((s, l) => s + (l.accorde ?? 0), 0);
  y -= 4;
  page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 20, color: light });
  text("TOTAL", M + 4, y, 10, fontBold);
  textRight(montant(totalDemande), cols[3].x + cols[3].w - 4, y, 10, fontBold);
  textRight(totalAccorde > 0 ? montant(totalAccorde) : "—", cols[4].x + cols[4].w - 4, y, 10, fontBold);
  y -= 30;

  // Total prévu par moyen de paiement (section 4, point 5).
  if (data.totauxParMode.length > 0) {
    if (y < 260) nouvellePage();
    text("Total prévu par moyen de paiement", M, y, 10, fontBold, primary);
    y -= 16;
    for (const t of data.totauxParMode) {
      text(t.label, M + 4, y, 9);
      textRight(montant(t.demande), cols[3].x + cols[3].w - 4, y, 9);
      textRight(t.accorde > 0 ? montant(t.accorde) : "—", cols[4].x + cols[4].w - 4, y, 9);
      y -= 14;
    }
    y -= 10;
  }

  // Total par département (chaque ligne porte son département).
  const parDepartement = data.totauxParDepartement ?? [];
  if (parDepartement.length > 0) {
    if (y < 260) nouvellePage();
    text("Total par département", M, y, 10, fontBold, primary);
    y -= 16;
    for (const t of parDepartement) {
      if (y < 200) nouvellePage();
      text(t.nom, M + 4, y, 9);
      textRight(montant(t.demande), cols[3].x + cols[3].w - 4, y, 9);
      textRight(t.accorde > 0 ? montant(t.accorde) : "—", cols[4].x + cols[4].w - 4, y, 9);
      y -= 14;
    }
    y -= 10;
  }

  // ── Signatures ────────────────────────────────────────────────────────────
  if (y < 190) nouvellePage();
  const blocs = [
    { titre: `Préparé par — ${data.preparePar}`, nom: data.demandeur },
    { titre: "Vérifié — Comptable", nom: "" },
    { titre: "Approuvé — Direction générale", nom: "" },
  ];
  const largeur = (W - 2 * M - 20) / 3;
  const hautBloc = 110;
  const yBloc = Math.min(y, 200);
  blocs.forEach((b, i) => {
    const x = M + i * (largeur + 10);
    page.drawRectangle({ x, y: yBloc - hautBloc, width: largeur, height: hautBloc, borderColor: gray, borderWidth: 0.8 });
    wrap(b.titre, fontBold, 8, largeur - 12).forEach((t, k) => text(t, x + 6, yBloc - 14 - k * 10, 8, fontBold));
    if (b.nom) text(b.nom, x + 6, yBloc - 40, 8, fontRegular, gray);
    text("Nom, date et signature", x + 6, yBloc - hautBloc + 8, 7, fontRegular, gray);
  });

  // ── Pied de page sur chaque page ──────────────────────────────────────────
  const pages = doc.getPages();
  const genere = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date());
  pages.forEach((p, i) => {
    p.drawText(clean(`Document généré le ${genere} — à signer puis joindre en scan (« Budget signé »)`), {
      x: M,
      y: 25,
      size: 7,
      font: fontRegular,
      color: gray,
    });
    const num = clean(`${data.numero} — page ${i + 1}/${pages.length}`);
    p.drawText(num, { x: W - M - fontRegular.widthOfTextAtSize(num, 7), y: 25, size: 7, font: fontRegular, color: gray });
  });

  return doc.save();
}
