import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { PDFFont, PDFPage, RGB } from "pdf-lib";
import { resolveTypeFournisseur } from "@/lib/typeFournisseur";

/**
 * PDF du bon de commande prestataire (bouton « Télécharger PDF » de la fiche du bon).
 *
 * Toute la mise en page est calculée à partir du texte RÉELLEMENT coupé en lignes : chaque bloc
 * (en-tête, encadré du prestataire, lignes du tableau, proformas) prend la hauteur de son texte le
 * plus long, et passe à la page suivante s'il ne tient plus (l'en-tête du tableau est alors répété).
 * Aucun texte ne peut donc en chevaucher un autre, quelle que soit sa longueur.
 */

export interface BonCommandePdfData {
  numero: string;
  dateCommande: string;
  totalHT: number;
  appliquerTva: boolean;
  tva: number;
  appliquerAib: boolean;
  montantAib: number;
  totalTTC: number;
  montantNet: number;
  fournisseur: {
    entreprise: string;
    nom: string | null;
    prenom: string | null;
    email: string | null;
    contact: string;
    adresse: string;
    typeFournisseur: string | null;
  };
  lignes: {
    designation: string;
    quantite: number;
    largeur: number | null;
    hauteur: number | null;
    surface: number | null;
    prixUnitaire: number;
    prixTotal: number;
  }[];
  proformas: { invoice: { numero: string; objet: string; client: { nom: string } | null } }[];
}

export interface BonCommandePdfEntreprise {
  nom: string;
  adresse: string;
  telephone: string;
  emailFinance: string;
  ifu: string;
}

const A4: [number, number] = [595, 842];
const MARGE = 40;
const BAS_PAGE = 56; // réservé au pied de page
const INTERLIGNE = 1.4;

const nettoyer = (t: string) => t.replace(/ /g, " ").replace(/ /g, " ");

export const formatMontantPdf = (montant: number) =>
  nettoyer(new Intl.NumberFormat("fr-BJ", { style: "currency", currency: "XOF" }).format(montant));

/**
 * Coupe un texte en lignes tenant dans `largeur` : par mots, et à l'intérieur d'un mot trop long
 * (référence, URL…) caractère par caractère. Les retours à la ligne saisis sont conservés.
 */
export function couperTexte(texte: string, font: PDFFont, taille: number, largeur: number): string[] {
  const mesure = (s: string) => font.widthOfTextAtSize(s, taille);
  const lignes: string[] = [];
  for (const paragraphe of texte.split(/\r?\n/)) {
    const mots = paragraphe.split(/\s+/).filter(Boolean);
    if (mots.length === 0) {
      lignes.push("");
      continue;
    }
    let courante = "";
    for (let mot of mots) {
      const essai = courante ? `${courante} ${mot}` : mot;
      if (mesure(essai) <= largeur) {
        courante = essai;
        continue;
      }
      if (courante) lignes.push(courante);
      courante = "";
      // Mot plus large que la colonne : coupé en morceaux.
      while (mesure(mot) > largeur) {
        let n = 1;
        while (n < mot.length && mesure(mot.slice(0, n + 1)) <= largeur) n++;
        lignes.push(mot.slice(0, n));
        mot = mot.slice(n);
      }
      courante = mot;
    }
    if (courante) lignes.push(courante);
  }
  return lignes.length > 0 ? lignes : [""];
}

export async function genererBonCommandePdf(
  commande: BonCommandePdfData,
  entreprise: BonCommandePdfEntreprise,
  options: { includeClient: boolean; includeObjet: boolean }
): Promise<Uint8Array> {
  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");

  const doc = await PDFDocument.create();
  const gras = await doc.embedFont(StandardFonts.HelveticaBold);
  const normal = await doc.embedFont(StandardFonts.Helvetica);

  const rose = rgb(0.937, 0.043, 0.325); // #ef0b53
  const roseClair = rgb(1, 0.955, 0.965);
  const gris = rgb(0.42, 0.45, 0.5);
  const grisBordure = rgb(0.88, 0.89, 0.91);
  const noir = rgb(0.1, 0.1, 0.12);
  const blanc = rgb(1, 1, 1);

  const [largeurPage, hauteurPage] = A4;
  const largeurUtile = largeurPage - 2 * MARGE;

  // Helvetica standard (WinAnsi) : un caractère non représentable (emoji, flèche…) ferait échouer
  // tout le PDF ; il est remplacé par « ? ».
  const cacheCar = new Map<string, boolean>();
  const sur = (t: string) =>
    Array.from(nettoyer(t ?? ""))
      .map((c) => {
        if (c === "\n" || c === "\r") return c;
        if (!cacheCar.has(c)) {
          try {
            normal.encodeText(c);
            cacheCar.set(c, true);
          } catch {
            cacheCar.set(c, false);
          }
        }
        return cacheCar.get(c) ? c : "?";
      })
      .join("");

  const couper = (t: string, font: PDFFont, taille: number, largeur: number) => couperTexte(sur(t), font, taille, largeur);
  const hauteurLignes = (n: number, taille: number) => n * taille * INTERLIGNE;

  /** Dessine des lignes dont la PREMIÈRE commence sous `haut` ; renvoie le bas du bloc. */
  const ecrire = (
    p: PDFPage,
    lignes: string[],
    opts: { x: number; haut: number; taille: number; font: PDFFont; couleur: RGB; largeur?: number; droite?: boolean; opacite?: number }
  ) => {
    const pas = opts.taille * INTERLIGNE;
    lignes.forEach((l, i) => {
      const x = opts.droite && opts.largeur ? opts.x + opts.largeur - opts.font.widthOfTextAtSize(l, opts.taille) : opts.x;
      p.drawText(l, {
        x,
        y: opts.haut - (pas - opts.taille) / 2 - opts.taille * 0.8 - i * pas,
        size: opts.taille,
        font: opts.font,
        color: opts.couleur,
        opacity: opts.opacite,
      });
    });
    return opts.haut - lignes.length * pas;
  };

  const type = resolveTypeFournisseur(commande.fournisseur.typeFournisseur);
  const dateStr = nettoyer(format(new Date(commande.dateCommande), "dd MMMM yyyy", { locale: fr }));

  // ── Pages ──────────────────────────────────────────────────────────────────
  let page = doc.addPage(A4);
  let y = hauteurPage;

  const nouvellePage = () => {
    page = doc.addPage(A4);
    // Bandeau de rappel en haut des pages suivantes.
    page.drawRectangle({ x: 0, y: hauteurPage - 34, width: largeurPage, height: 34, color: rose });
    page.drawText(sur(`BON DE COMMANDE N° ${commande.numero} (suite)`), {
      x: MARGE,
      y: hauteurPage - 22,
      size: 10,
      font: gras,
      color: blanc,
    });
    y = hauteurPage - 34 - 20;
  };

  /** Passe à la page suivante si `hauteur` ne tient plus ; renvoie true si une page a été ajoutée. */
  const place = (hauteur: number) => {
    if (y - hauteur >= BAS_PAGE) return false;
    nouvellePage();
    return true;
  };

  // ── En-tête ────────────────────────────────────────────────────────────────
  const largeurEmetteur = 210;
  const xEmetteur = largeurPage - MARGE - largeurEmetteur;
  const largeurTitre = xEmetteur - MARGE - 20;

  const emetteur: { lignes: string[]; font: PDFFont; taille: number }[] = [
    { lignes: couper(entreprise.nom.toUpperCase(), gras, 11, largeurEmetteur), font: gras, taille: 11 },
    { lignes: couper(entreprise.adresse, normal, 8.5, largeurEmetteur), font: normal, taille: 8.5 },
    { lignes: couper(`IFU : ${entreprise.ifu}`, normal, 8.5, largeurEmetteur), font: normal, taille: 8.5 },
    { lignes: couper(`Tél : ${entreprise.telephone}`, normal, 8.5, largeurEmetteur), font: normal, taille: 8.5 },
    { lignes: couper(`Email : ${entreprise.emailFinance}`, normal, 8.5, largeurEmetteur), font: normal, taille: 8.5 },
  ];
  const titre: { lignes: string[]; font: PDFFont; taille: number; ecart: number }[] = [
    { lignes: couper("BON DE COMMANDE", gras, 20, largeurTitre), font: gras, taille: 20, ecart: 2 },
    { lignes: couper(type.toUpperCase(), gras, 12, largeurTitre), font: gras, taille: 12, ecart: 10 },
    { lignes: couper(`N° ${commande.numero}`, gras, 10, largeurTitre), font: gras, taille: 10, ecart: 1 },
    { lignes: couper(`Date : ${dateStr}`, normal, 9.5, largeurTitre), font: normal, taille: 9.5, ecart: 0 },
  ];
  const hEmetteur = emetteur.reduce((s, b) => s + hauteurLignes(b.lignes.length, b.taille), 0) + 4;
  const hTitre = titre.reduce((s, b) => s + hauteurLignes(b.lignes.length, b.taille) + b.ecart, 0);
  const padBandeau = 28;
  const hBandeau = Math.max(hEmetteur, hTitre) + 2 * padBandeau;

  page.drawRectangle({ x: 0, y: hauteurPage - hBandeau, width: largeurPage, height: hBandeau, color: rose });
  let yTitre = hauteurPage - padBandeau;
  for (const b of titre) {
    yTitre = ecrire(page, b.lignes, { x: MARGE, haut: yTitre, taille: b.taille, font: b.font, couleur: blanc }) - b.ecart;
  }
  let yEm = hauteurPage - padBandeau;
  emetteur.forEach((b, i) => {
    yEm = ecrire(page, b.lignes, { x: xEmetteur, haut: yEm, taille: b.taille, font: b.font, couleur: blanc, opacite: i === 0 ? 1 : 0.9 }) - (i === 0 ? 4 : 0);
  });
  y = hauteurPage - hBandeau - 26;

  // ── Encadré du prestataire ───────────────────────────────────────────────────
  const padBoite = 12;
  const largeurTexteBoite = largeurUtile - 2 * padBoite;
  const f = commande.fournisseur;
  const nomContact = `${f.prenom ?? ""} ${f.nom ?? ""}`.trim();
  const infos: { lignes: string[]; font: PDFFont; taille: number; couleur: RGB }[] = [
    { lignes: couper(f.entreprise, gras, 12, largeurTexteBoite), font: gras, taille: 12, couleur: noir },
    ...(nomContact ? [{ lignes: couper(nomContact, normal, 9.5, largeurTexteBoite), font: normal, taille: 9.5, couleur: gris }] : []),
    ...(f.adresse ? [{ lignes: couper(f.adresse, normal, 9.5, largeurTexteBoite), font: normal, taille: 9.5, couleur: gris }] : []),
    ...(f.email ? [{ lignes: couper(`Email : ${f.email}`, normal, 9.5, largeurTexteBoite), font: normal, taille: 9.5, couleur: gris }] : []),
    ...(f.contact ? [{ lignes: couper(`Tél : ${f.contact}`, normal, 9.5, largeurTexteBoite), font: normal, taille: 9.5, couleur: gris }] : []),
  ];
  const hTitreBoite = 20;
  const hInfos = infos.reduce((s, b) => s + hauteurLignes(b.lignes.length, b.taille), 0) + 4;
  const hBoite = hTitreBoite + hInfos + 2 * padBoite;
  place(hBoite);
  page.drawRectangle({ x: MARGE, y: y - hBoite, width: largeurUtile, height: hBoite, color: roseClair });
  page.drawRectangle({ x: MARGE, y: y - hTitreBoite, width: largeurUtile, height: hTitreBoite, color: rose });
  page.drawText(sur(type.toUpperCase()), { x: MARGE + padBoite, y: y - 14, size: 9, font: gras, color: blanc });
  let yInfos = y - hTitreBoite - padBoite;
  infos.forEach((b, i) => {
    yInfos = ecrire(page, b.lignes, { x: MARGE + padBoite, haut: yInfos, taille: b.taille, font: b.font, couleur: b.couleur }) - (i === 0 ? 4 : 0);
  });
  y -= hBoite + 26;

  // ── Tableau des lignes ──────────────────────────────────────────────────────
  // Largeurs : 515 pt au total ; la désignation prend la place restante.
  const colonnes = [
    { titre: "Désignation", largeur: 189, droite: false },
    { titre: "Dim. (L × H) cm", largeur: 70, droite: false },
    { titre: "Surface", largeur: 54, droite: true },
    { titre: "Qté", largeur: 36, droite: true },
    { titre: "Prix unitaire", largeur: 80, droite: true },
    { titre: "Total", largeur: 86, droite: true },
  ];
  const padX = 6;
  const padY = 7;
  const tailleCellule = 9;
  const tailleEntete = 8.5;
  const xCol = colonnes.reduce<number[]>((acc, c, i) => [...acc, i === 0 ? MARGE : acc[i - 1] + colonnes[i - 1].largeur], []);

  const enteteTableau = () => {
    const lignes = colonnes.map((c) => couper(c.titre, gras, tailleEntete, c.largeur - 2 * padX));
    const h = Math.max(...lignes.map((l) => hauteurLignes(l.length, tailleEntete))) + 2 * padY;
    place(h + 30); // jamais un en-tête seul en bas de page
    page.drawRectangle({ x: MARGE, y: y - h, width: largeurUtile, height: h, color: rose });
    colonnes.forEach((c, i) =>
      ecrire(page, lignes[i], { x: xCol[i] + padX, haut: y - padY, taille: tailleEntete, font: gras, couleur: blanc, largeur: c.largeur - 2 * padX, droite: c.droite })
    );
    y -= h;
  };

  enteteTableau();
  commande.lignes.forEach((ligne, idx) => {
    const cellules = [
      ligne.designation,
      ligne.largeur && ligne.hauteur ? `${ligne.largeur} × ${ligne.hauteur}` : "-",
      ligne.surface ? `${Number(ligne.surface).toFixed(2)} m²` : "-",
      String(ligne.quantite),
      formatMontantPdf(Number(ligne.prixUnitaire)),
      formatMontantPdf(Number(ligne.prixTotal)),
    ].map((t, i) => couper(t, i === 5 ? gras : normal, tailleCellule, colonnes[i].largeur - 2 * padX));
    const h = Math.max(...cellules.map((l) => hauteurLignes(l.length, tailleCellule))) + 2 * padY;
    if (place(h)) enteteTableau();
    page.drawRectangle({ x: MARGE, y: y - h, width: largeurUtile, height: h, color: idx % 2 === 0 ? blanc : roseClair });
    page.drawRectangle({ x: MARGE, y: y - h, width: largeurUtile, height: 0.6, color: grisBordure });
    colonnes.forEach((c, i) =>
      ecrire(page, cellules[i], {
        x: xCol[i] + padX,
        haut: y - padY,
        taille: tailleCellule,
        font: i === 5 ? gras : normal,
        couleur: noir,
        largeur: c.largeur - 2 * padX,
        droite: c.droite,
      })
    );
    y -= h;
  });
  page.drawRectangle({ x: MARGE, y, width: largeurUtile, height: 1.2, color: rose });
  y -= 22;

  // ── Récapitulatif ──────────────────────────────────────────────────────────
  const largeurRecap = 240;
  const xRecap = largeurPage - MARGE - largeurRecap;
  const recap: { libelle: string; valeur: string; gras?: boolean }[] = [
    { libelle: "Total HT", valeur: formatMontantPdf(Number(commande.totalHT)) },
    { libelle: commande.appliquerTva ? "TVA (18 %)" : "TVA (non appliquée)", valeur: formatMontantPdf(Number(commande.tva)) },
    { libelle: "Total TTC", valeur: formatMontantPdf(Number(commande.totalTTC)), gras: true },
    { libelle: commande.appliquerAib ? "AIB (3 %)" : "AIB (non appliqué)", valeur: `- ${formatMontantPdf(Number(commande.montantAib))}` },
  ];
  const pasRecap = 18;
  const hNet = 30;
  place(recap.length * pasRecap + 10 + hNet);
  for (const r of recap) {
    const font = r.gras ? gras : normal;
    page.drawText(sur(r.libelle), { x: xRecap + 10, y: y - 12, size: 9.5, font, color: noir });
    const v = sur(r.valeur);
    page.drawText(v, { x: xRecap + largeurRecap - 10 - font.widthOfTextAtSize(v, 9.5), y: y - 12, size: 9.5, font, color: noir });
    page.drawRectangle({ x: xRecap, y: y - pasRecap, width: largeurRecap, height: 0.6, color: grisBordure });
    y -= pasRecap;
  }
  y -= 10;
  page.drawRectangle({ x: xRecap, y: y - hNet, width: largeurRecap, height: hNet, color: rose });
  page.drawText("MONTANT NET", { x: xRecap + 10, y: y - 19, size: 10.5, font: gras, color: blanc });
  const net = sur(formatMontantPdf(Number(commande.montantNet)));
  page.drawText(net, { x: xRecap + largeurRecap - 10 - gras.widthOfTextAtSize(net, 11), y: y - 19, size: 11, font: gras, color: blanc });
  y -= hNet + 28;

  // ── Proforma(s) associée(s) ──────────────────────────────────────────────────
  if (commande.proformas.length > 0) {
    place(40);
    page.drawText("Proforma(s) associée(s)", { x: MARGE, y: y - 10, size: 9.5, font: gras, color: noir });
    y -= 20;
    for (const p of commande.proformas) {
      const details: string[] = [];
      if (options.includeClient && p.invoice.client?.nom) details.push(p.invoice.client.nom);
      if (options.includeObjet && p.invoice.objet) details.push(p.invoice.objet);
      const texte = details.length > 0 ? `${p.invoice.numero} — ${details.join(" · ")}` : p.invoice.numero;
      const lignes = couper(texte, normal, 9, largeurUtile - 14);
      place(hauteurLignes(lignes.length, 9) + 4);
      page.drawRectangle({ x: MARGE, y: y - hauteurLignes(lignes.length, 9), width: 2.5, height: hauteurLignes(lignes.length, 9), color: rose });
      y = ecrire(page, lignes, { x: MARGE + 12, haut: y, taille: 9, font: normal, couleur: gris }) - 6;
    }
  }

  // ── Pied de page (toutes les pages) ──────────────────────────────────────────
  const pages = doc.getPages();
  const genere = `Document généré le ${format(new Date(), "dd/MM/yyyy à HH:mm")}`;
  pages.forEach((p, i) => {
    p.drawRectangle({ x: MARGE, y: 42, width: largeurUtile, height: 0.6, color: grisBordure });
    p.drawText(genere, { x: MARGE, y: 28, size: 8, font: normal, color: gris });
    const droite = sur(`${commande.numero}  ·  Page ${i + 1} / ${pages.length}`);
    p.drawText(droite, { x: largeurPage - MARGE - normal.widthOfTextAtSize(droite, 8), y: 28, size: 8, font: normal, color: gris });
  });

  return doc.save();
}
