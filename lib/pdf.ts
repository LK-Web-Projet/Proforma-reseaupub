import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from "pdf-lib";
import { Invoice, InvoiceProduit, Client, Devise } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import writtenNumber from "written-number";

// Type local pour éviter les dépendances de cache du client Prisma généré
type EntrepriseConfig = {
  id: string;
  nom: string;
  slogan: string | null;
  adresse: string;
  telephone: string;
  email: string;
  emailFinance: string;
  siteWeb: string | null;
  ifu: string;
  rccm: string | null;
  nomDirecteur: string;
  logoPath: string;
  updatedAt: Date;
};

export type InvoiceWithDetails = Invoice & {
  client: Client | null;
  produits: InvoiceProduit[];
  devise: Devise;
};

const colorPrimary = rgb(0.937, 0.043, 0.325); // #ef0b53
const colorLight = rgb(1, 0.95, 0.96);

const cleanText = (text: string) => {
  return text.replace(/\u202f/g, " ").replace(/\u00a0/g, " ");
};

const formatNumber = (num: number) => {
  return cleanText(new Intl.NumberFormat("fr-FR").format(num).replace(/\s/g, ' '));
};

function getLines(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const allLines: string[] = [];
  const paragraphs = text.split('\n'); // Split by explicit newlines first

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') { // Handle empty lines (e.g., consecutive \n\n)
      allLines.push('');
      continue;
    }
    const words = paragraph.split(' ');
    let currentLine = '';

    for (const word of words) {
      const prospectiveLine = currentLine + (currentLine === '' ? '' : ' ') + word;
      const width = font.widthOfTextAtSize(prospectiveLine, fontSize);

      if (width > maxWidth) {
        allLines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = prospectiveLine;
      }
    }
    allLines.push(currentLine);
  }
  return allLines;
}

interface WrappedLabeledParagraph {
  labelText: string;
  labelWidth: number;
  lines: string[];
}

// Découpe un paragraphe "Label : reste du texte" en lignes, en réservant la largeur du
// label (en gras) uniquement sur la première ligne — les lignes suivantes utilisent toute la largeur.
function wrapLabeledParagraph(
  boldFont: PDFFont,
  font: PDFFont,
  label: string,
  rest: string,
  fontSize: number,
  maxWidth: number
): WrappedLabeledParagraph {
  const labelText = `${label} `;
  const labelWidth = boldFont.widthOfTextAtSize(labelText, fontSize);
  const words = rest.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const availableWidth = lines.length === 0 ? maxWidth - labelWidth : maxWidth;
    const prospectiveLine = currentLine === '' ? word : `${currentLine} ${word}`;
    const width = font.widthOfTextAtSize(prospectiveLine, fontSize);

    if (width > availableWidth && currentLine !== '') {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = prospectiveLine;
    }
  }
  lines.push(currentLine);

  return { labelText, labelWidth, lines };
}

// Dessine un paragraphe pré-découpé par wrapLabeledParagraph, avec le label en gras suivi
// du reste du texte en police normale sur la même ligne, aligné à gauche.
function drawLabeledParagraph(
  page: PDFPage,
  boldFont: PDFFont,
  font: PDFFont,
  paragraph: WrappedLabeledParagraph,
  x: number,
  y: { value: number },
  fontSize: number,
  lineHeight: number
) {
  paragraph.lines.forEach((line, index) => {
    if (index === 0) {
      page.drawText(cleanText(paragraph.labelText), { x, y: y.value, size: fontSize, font: boldFont, color: rgb(0, 0, 0) });
      page.drawText(cleanText(line), { x: x + paragraph.labelWidth, y: y.value, size: fontSize, font, color: rgb(0, 0, 0) });
    } else {
      page.drawText(cleanText(line), { x, y: y.value, size: fontSize, font, color: rgb(0, 0, 0) });
    }
    y.value -= lineHeight;
  });
}

export async function generateInvoicePdf(
  facture: InvoiceWithDetails,
  entreprise: EntrepriseConfig
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([600, 800]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  const y = { value: height - 50 };
  const pageMargin = 40;
  const footerHeight = 50;

  let pageCount = 1;

  const checkNewPage = async (heightNeeded: number) => {
    if (y.value - heightNeeded < footerHeight) {
      drawFooter(page, pageCount, font, width);
      page = pdfDoc.addPage([600, 800]);
      pageCount++;
      y.value = height - 50;
      await drawSubsequentPageHeader(pdfDoc, page, entreprise);
    }
  };

  await drawHeader(pdfDoc, page, boldFont, width, facture, entreprise);
  y.value -= 40;

  // Infos facture
  drawText(page, font, `Facture n° ${facture.numero ?? "001"}`, 300, y.value);
  y.value -= 15;
  const objetText = `Objet : ${facture.objet ?? "Objet"}`;
  const objetFontSize = 10; // Smaller font size
  const objetX = 300; // Shifted to the left
  const objetMaxWidth = width - objetX - pageMargin; // Max width for the text
  const objetLines = getLines(objetText, font, objetFontSize, objetMaxWidth);

  for (const line of objetLines) {
    drawText(page, font, line, objetX, y.value, objetFontSize);
    y.value -= 12; // Adjust line spacing
  }
  y.value += 12; // Adjust back for the next element
  y.value -= 15;
  drawText(
    page,
    font,
    `Date : ${new Date(facture.dateCreation).toLocaleDateString("fr-FR")}`,
    300,
    y.value
  );
  y.value -= 50;

  // Ligne de séparation
  page.drawLine({
    start: { x: pageMargin, y: y.value },
    end: { x: width - pageMargin, y: y.value },
    thickness: 2,
    color: colorPrimary,
  });
  y.value -= 20;

  // Facturé à
  drawText(page, boldFont, `Facturé à : ${facture.client?.nom ?? "Nom Client"}`, pageMargin, y.value);
  y.value -= 15;

  drawText(page, font, `Adresse : ${facture.client?.adresse ?? "Adresse Client"}`, pageMargin, y.value);
  y.value -= 15;
  drawText(page, font, `Email : ${facture.client?.email ?? "destinataire@mail.com"}`, pageMargin, y.value);
  y.value -= 15;
  drawText(page, font, `Téléphone : ${facture.client?.telephone ?? "+229 01 XX XX XX XX"}`, pageMargin, y.value);
  y.value -= 25;

  // Tableau des produits
  const headers = ["Désignation", "Qte", "Durée", "Prix unitaire HT", "Montant HT"];
  const columnWidths = [200, 40, 50, 100, 150];
  const tableX = 40;
  const lineHeight = 30;

  // Header du tableau
  await checkNewPage(lineHeight);
  drawTableRow(page, headers, y.value, true, boldFont, columnWidths, tableX, lineHeight);
  y.value -= lineHeight;

  for (const p of facture.produits) {
    const designationLines = getLines(p.designation, font, 11, columnWidths[0] - 10);
    const rowHeight = Math.max(lineHeight, designationLines.length * lineHeight);

    await checkNewPage(rowHeight);
    drawTableRow(
      page,
      [
        p.designation,
        p.quantite.toString(),
        p.includeduree
          ? `${formatNumber(Number(p.duree))} ${p.uniteDuree}${
              Number(p.duree) > 1 &&
              ["jour", "semaine", "heure"].includes(p.uniteDuree)
                ? "s"
                : ""
            }`
          : "-",
        `${formatNumber(Number(p.prixUnitaire))} ${facture.devise}`,
        `${formatNumber(Number(p.montantTotal))} ${facture.devise}`,
      ],
      y.value,
      false,
      font,
      columnWidths,
      tableX,
      rowHeight,
      designationLines
    );
    y.value -= rowHeight;
  }

  // Totaux
  await checkNewPage(100);
  y.value -= 20;
  const totalHT = Number(facture.totalHT ?? 0);
  const tva = Number(facture.tva ?? 0);
  const totalTTC = Number(facture.totalTTC ?? 0);
  const totalsX = 350;
  const valuesX = width - pageMargin;
  drawText(page, font, `Total HT :`, totalsX, y.value);
  drawText(page, font, `${formatNumber(totalHT)} ${facture.devise}`, valuesX, y.value, 12, 'right');
  y.value -= 25;
  drawText(page, font, `TVA 18 % :`, totalsX, y.value);
  drawText(page, font, `${formatNumber(tva)} ${facture.devise}`, valuesX, y.value, 12, 'right');
  y.value -= 25;
  drawText(page, boldFont, `Total TTC :`, totalsX, y.value);
  drawText(page, boldFont, `${formatNumber(totalTTC)} ${facture.devise}`, valuesX, y.value, 12, 'right');
  y.value -= 30;

  // Conditions de paiement
  await checkNewPage(50);
  const totalTTCInWords = writtenNumber(totalTTC, { lang: 'fr' });
  const fullText = `Arrêtée la présente facture proforma à la somme de : ${formatNumber(
    totalTTC
  )} ${
    facture.devise
  } TTC (${totalTTCInWords} ${facture.devise.toLocaleLowerCase()})`;
  const textLines = getLines(fullText, font, 12, width - pageMargin * 2);

  for (const line of textLines) {
    drawText(page, font, line, pageMargin, y.value);
    y.value -= 15; // space between lines
  }
  y.value -= 25; // space after the block
  
  if (facture.paymentConditionPercentage && facture.paymentConditionPercentage > 0) {
    y.value -= 20;

    const pct = facture.paymentConditionPercentage;
    const isFullUpfront = pct >= 100;
    const acompteAmount = Math.round(totalTTC * pct / 100);
    const soldeAmount = totalTTC - acompteAmount;

    const paiementRest = isFullUpfront
      ? `Règlement intégral (100 % à la commande, soit ${formatNumber(acompteAmount)} ${facture.devise}). Aucun démarrage de fabrication, réservation ou déploiement terrain sans encaissement préalable.`
      : `Acompte de ${pct} % à la commande, soit ${formatNumber(acompteAmount)} ${facture.devise} (condition obligatoire de démarrage) — Solde de ${100 - pct} % sur rapport d'exécution, soit ${formatNumber(soldeAmount)} ${facture.devise} (sauf dispositions spécifiques prévues au contrat cadre historique).`;

    const validationsRest = isFullUpfront
      ? "Éléments techniques et visuels à valider au moins 3 jours ouvrés avant l'opération."
      : "Visuels, BAT et éléments logistiques à valider au moins 5 jours ouvrés avant le déploiement.";

    const cadreRest = "La validation du présent devis emporte adhésion aux conditions du Contrat Cadre RESEAUPUB.";

    const conditionTitle = "CONDITIONS D'EXÉCUTION & PAIEMENT";
    const blockMaxWidth = width - pageMargin * 2;
    const bodyFontSize = 9.5;
    const lineHeight = 12;
    const titleHeight = 16;
    const paragraphSpacing = 8;

    const paragraphs = [
      { label: 'Paiement :', rest: paiementRest },
      { label: 'Validations :', rest: validationsRest },
      { label: 'Cadre :', rest: cadreRest },
    ].map(({ label, rest }) => wrapLabeledParagraph(boldFont, font, label, rest, bodyFontSize, blockMaxWidth));

    const estimatedHeight =
      titleHeight +
      paragraphs.reduce((sum, p) => sum + p.lines.length * lineHeight + paragraphSpacing, 0);

    await checkNewPage(estimatedHeight);

    drawText(page, boldFont, conditionTitle, pageMargin, y.value, 11, 'left', colorPrimary);
    y.value -= titleHeight;

    for (const paragraph of paragraphs) {
      drawLabeledParagraph(page, boldFont, font, paragraph, pageMargin, y, bodyFontSize, lineHeight);
      y.value -= paragraphSpacing;
    }
  }

  if (facture.info) {
    y.value -= 10;
    const titleFontSize = 12; // Larger for title
    const contentFontSize = 11; // Larger for content
    const infoTitle = 'Informations Complémentaires:';

    // Calculate lines for title and content to check page break
    const titleDisplayLines = getLines(infoTitle, boldFont, titleFontSize, width - pageMargin * 2);
    const infoContentLines = getLines(facture.info, boldFont, contentFontSize, width - pageMargin * 2);

    // Estimate height needed for title + content + spacing
    const estimatedHeightNeeded = titleDisplayLines.length * (titleFontSize + 3) + infoContentLines.length * (contentFontSize + 2) + 20;

    await checkNewPage(estimatedHeightNeeded);

    // Draw title in bold and primary color
    drawText(page, boldFont, infoTitle, pageMargin, y.value, titleFontSize, 'left', colorPrimary);
    y.value -= (titleFontSize + 5); // spacing after title
 
    // Draw content in bold and primary color
    for (const line of infoContentLines) {
      drawText(page, font, line, pageMargin, y.value, contentFontSize, 'left', colorPrimary);
      y.value -= (contentFontSize + 2); // spacing between content lines
    }
    y.value -= 20; // spacing after the whole block
  }
  
  // Explications abréviations (gauche) + cadre de signature "Bon pour accord" (droite)
  const legendLines = [
    "HT : Hors Taxes",
    "TTC : Toutes Taxes Comprises",
    "TVA : Taxe sur la Valeur Ajoutée",
    "NB : Note Bien",
  ];
  const legendLineHeight = 12;
  const legendHeight = legendLines.length * legendLineHeight;

  const signatureBoxWidth = 220;
  const signatureBoxHeight = 110;

  const bottomBlockHeight = Math.max(legendHeight, signatureBoxHeight);
  await checkNewPage(bottomBlockHeight + 10);

  const blockTopY = y.value;

  // Légende
  let legendY = blockTopY;
  for (const line of legendLines) {
    drawText(page, font, line, pageMargin, legendY, 8);
    legendY -= legendLineHeight;
  }

  // Cadre de signature
  const signatureBoxX = width - pageMargin - signatureBoxWidth;
  const signatureBoxY = blockTopY - signatureBoxHeight + 8;
  page.drawRectangle({
    x: signatureBoxX,
    y: signatureBoxY,
    width: signatureBoxWidth,
    height: signatureBoxHeight,
    borderWidth: 1,
    borderColor: colorPrimary,
    color: rgb(1, 1, 1),
  });

  const signatureTitle = "BON POUR ACCORD";
  const signatureTitleWidth = boldFont.widthOfTextAtSize(signatureTitle, 10);
  drawText(
    page,
    boldFont,
    signatureTitle,
    signatureBoxX + (signatureBoxWidth - signatureTitleWidth) / 2,
    blockTopY - 4,
    10,
    'left',
    colorPrimary
  );

  drawText(page, font, "Nom & Prénom :", signatureBoxX + 12, blockTopY - 30, 9);
  drawText(page, font, "Signature :", signatureBoxX + 12, blockTopY - 65, 9);

  y.value = blockTopY - bottomBlockHeight - 10;

  drawFooter(page, pageCount, font, width);

  return await pdfDoc.save();
}

async function drawHeader(
  pdfDoc: PDFDocument,
  page: PDFPage,
  font: PDFFont,
  pageWidth: number,
  facture: InvoiceWithDetails,
  entreprise: EntrepriseConfig
) {
  const logoFilename = entreprise.logoPath || "rplogo.png";
  const logoFilePath = path.join(process.cwd(), "public", logoFilename);
  const logoImageBytes = fs.readFileSync(logoFilePath);
  // Détecter PNG ou JPEG
  const isPng = logoFilename.toLowerCase().endsWith(".png") || logoImageBytes[0] === 0x89;
  const logoImage = isPng
    ? await pdfDoc.embedPng(logoImageBytes)
    : await pdfDoc.embedJpg(logoImageBytes);
  const logoWidth = 120;
  const logoHeight = logoImage.height * (logoWidth / logoImage.width);
  page.drawImage(logoImage, {
    x: 40,
    y: 720,
    width: logoWidth,
    height: logoHeight,
  });

  centerText(page, font, "FACTURE PROFORMA", 760, 18, pageWidth);

  const companyX = 40;
  let companyY = 700;
  drawText(page, font, `Délivrée par : ${facture.societeNom ?? entreprise.nom}`, companyX, companyY, 10);
  companyY -= 15;
  drawText(page, font, `Adresse : ${facture.societeAdresse ?? entreprise.adresse}`, companyX, companyY, 10);
  companyY -= 15;
  drawText(page, font, `IFU : ${facture.societeIFU ?? entreprise.ifu}`, companyX, companyY, 10);
  companyY -= 15;
  drawText(page, font, `E-mail : ${entreprise.emailFinance}`, companyX, companyY, 10);
  companyY -= 15;
  drawText(page, font, `Téléphone : ${entreprise.telephone}`, companyX, companyY, 10);
}

async function drawSubsequentPageHeader(pdfDoc: PDFDocument, page: PDFPage, entreprise?: EntrepriseConfig) {
  const logoFilename = entreprise?.logoPath || "rplogo.png";
  const logoFilePath = path.join(process.cwd(), "public", logoFilename);
  const logoImageBytes = fs.readFileSync(logoFilePath);
  const isPng = logoFilename.toLowerCase().endsWith(".png") || logoImageBytes[0] === 0x89;
  const logoImage = isPng
    ? await pdfDoc.embedPng(logoImageBytes)
    : await pdfDoc.embedJpg(logoImageBytes);
  const logoWidth = 50;
  const logoHeight = logoImage.height * (logoWidth / logoImage.width);
  page.drawImage(logoImage, {
    x: 40,
    y: 740,
    width: logoWidth,
    height: logoHeight,
  });
}

function drawTableRow(
  page: PDFPage,
  cols: string[],
  y: number,
  isHeader: boolean,
  font: PDFFont,
  columnWidths: number[],
  tableX: number,
  rowHeight: number,
  designationLines?: string[]
) {
  let x = tableX;
  cols.forEach((text, i) => {
    page.drawRectangle({
      x,
      y: y - rowHeight,
      width: columnWidths[i],
      height: rowHeight,
      borderWidth: 1,
      borderColor: colorPrimary,
      color: isHeader ? colorLight : rgb(1, 1, 1),
    });

    if (i === 0 && designationLines) { // Designation column
      let lineY = y - 12;
      for (const line of designationLines) {
        drawText(page, font, line, x + 5, lineY, 11);
        lineY -= 15;
      }
    } else {
      drawText(page, font, text, x + 5, y - (rowHeight / 2) - 4, 11);
    }
    x += columnWidths[i];
  });
}

function drawText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  size = 12,
  align: 'left' | 'right' = 'left',
  color = rgb(0, 0, 0)
) {
    let textX = x;
    const sanitizedText = cleanText(text);
    if (align === 'right') {
        const textWidth = font.widthOfTextAtSize(sanitizedText, size);
        textX = x - textWidth;
    }
    page.drawText(sanitizedText, { x: textX, y, size, font, color });
}

function centerText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  y: number,
  size: number,
  pageWidth: number
) {
  const textWidth = font.widthOfTextAtSize(text, size);
  drawText(page, font, text, (pageWidth - textWidth) / 2, y, size);
}

function drawFooter(page: PDFPage, pageNum: number, font: PDFFont, pageWidth: number) {
    const footerText = `Page ${pageNum}`;
    centerText(page, font, footerText, 30, 10, pageWidth);
}