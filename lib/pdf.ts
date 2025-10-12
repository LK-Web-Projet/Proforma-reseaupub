import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from "pdf-lib";
import { Invoice, InvoiceProduit, Client, Devise } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { Entreprise } from "@/components/Data";
import writtenNumber from "written-number";

type InvoiceWithDetails = Invoice & {
  client: Client;
  produits: InvoiceProduit[];
  devise: Devise;
};

const formatNumber = (num: number) => {
  return new Intl.NumberFormat("fr-FR").format(num).replace(/\s/g, ' ');
};

function getLines(text: string, font: PDFFont, fontSize: number, maxWidth: number) {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const prospectiveLine = currentLine + (currentLine === '' ? '' : ' ') + word;
    const width = font.widthOfTextAtSize(prospectiveLine, fontSize);

    if (width > maxWidth) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = prospectiveLine;
    }
  }
  lines.push(currentLine);
  return lines;
}

export async function generateInvoicePdf(
  facture: InvoiceWithDetails
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
      await drawSubsequentPageHeader(pdfDoc, page);
    }
  };

  await drawHeader(pdfDoc, page, boldFont, width, facture);
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
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
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
  const headers = ["Qte", "Désignation", "Durée", "Prix unitaire HT", "Montant HT"];
  const columnWidths = [30, 200, 50, 100, 150];
  const tableX = 40;
  const lineHeight = 30;

  // Header du tableau
  await checkNewPage(lineHeight);
  drawTableRow(page, headers, y.value, true, boldFont, columnWidths, tableX, lineHeight);
  y.value -= lineHeight;

  for (const p of facture.produits) {
    const designationLines = getLines(p.designation, font, 11, columnWidths[1] - 10);
    const rowHeight = Math.max(lineHeight, designationLines.length * lineHeight);

    await checkNewPage(rowHeight);
    drawTableRow(
      page,
      [
        p.quantite.toString(),
        p.designation,
        p.includeduree
          ? `${formatNumber(Number(p.duree))} ${p.uniteDuree}`
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
  const fullText = `Arrêté la présente facture Proforma à la somme de : ${formatNumber(
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
    const conditionText = `NB : Un acompte de ${facture.paymentConditionPercentage}% du montant total de la facture est exigé avant le démarrage de la prestation`;
    const conditionLines = getLines(conditionText, font, 10, width - pageMargin * 2);
    await checkNewPage(conditionLines.length * 15);
    for (const line of conditionLines) {
        drawText(page, font, line, pageMargin, y.value, 10);
        y.value -= 30;
    }
  }
  // Explications abréviations
  await checkNewPage(40);
  drawText(page, font, "HT : Hors Taxes", pageMargin, y.value, 8);
  y.value -= 12;
  drawText(page, font, "TTC : Toutes Taxes Comprises", pageMargin, y.value, 8);
  y.value -= 12;
  drawText(page, font, "TVA : Taxe sur la Valeur Ajoutée", pageMargin, y.value, 8);
  y.value -= 12;
  drawText(page, font, "NB : Note Bien", pageMargin, y.value, 8);



  drawFooter(page, pageCount, font, width);

  return await pdfDoc.save();
}

async function drawHeader(
  pdfDoc: PDFDocument,
  page: PDFPage,
  font: PDFFont,
  pageWidth: number,
  facture: InvoiceWithDetails
) {
  const logoPath = path.join(process.cwd(), "public", "rplogo.png");
  const logoImageBytes = fs.readFileSync(logoPath);
  const logoImage = await pdfDoc.embedPng(logoImageBytes);
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
  drawText(page, font, `Delivrer par : ${facture.societeNom ?? Entreprise.nom}`, companyX, companyY, 10);
  companyY -= 15;
  drawText(page, font, `Adresse : ${facture.societeAdresse ?? Entreprise.adresse}`, companyX, companyY, 10);
  companyY -= 15;
  drawText(page, font, `IFU : ${facture.societeIFU ?? Entreprise.IFU}`, companyX, companyY, 10);
  companyY -= 15;
  drawText(page, font, "Email : finance@reseaupub.com", companyX, companyY, 10);
  companyY -= 15;
  drawText(page, font, "Téléphone : +229 01 69 81 30 30", companyX, companyY, 10);
}

async function drawSubsequentPageHeader(pdfDoc: PDFDocument, page: PDFPage) {
  const logoPath = path.join(process.cwd(), "public", "rplogo.png");
  const logoImageBytes = fs.readFileSync(logoPath);
  const logoImage = await pdfDoc.embedPng(logoImageBytes);
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
      borderColor: rgb(0.8, 0.8, 0.8),
      color: isHeader ? rgb(0.95, 0.95, 0.95) : rgb(1, 1, 1),
    });

    if (i === 1 && designationLines) { // Designation column
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
  align: 'left' | 'right' = 'left'
) {
    let textX = x;
    if (align === 'right') {
        const textWidth = font.widthOfTextAtSize(text, size);
        textX = x - textWidth;
    }
  page.drawText(text, { x: textX, y, size, font });
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

