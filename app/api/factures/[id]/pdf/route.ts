import { NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import prisma from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const facture = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { client: true, produits: true },
  });

  if (!facture) {
    return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 });
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const { width } = page.getSize();
  let y = 750;

  const drawText = (text: string, x: number, y: number, size = 12) => {
    page.drawText(text, { x, y, size, font });
  };

  const centerText = (text: string, y: number, size = 14) => {
    const textWidth = font.widthOfTextAtSize(text, size);
    drawText(text, (width - textWidth) / 2, y, size);
  };

  // Titre
  centerText("FACTURE PROFORMA", y, 16);
  y -= 40;

  // Coordonnées entreprise
  drawText("Mon entreprise : Nom de la société", 40, y);
  y -= 16;
  drawText("Adresse postale", 40, y);
  y -= 16;
  drawText("adresse@mail.com", 40, y);
  y -= 16;
  drawText("Téléphone : +229 99 00 00 00", 40, y);
  y = 660;

  // Partie droite : infos facture
  drawText(`Facture n° ${facture.numero ?? "001"}`, 400, y);
  y -= 16;
  drawText(
    `Date : ${new Date(facture.dateCreation).toLocaleDateString("fr-FR")}`,
    400,
    y
  );
  y -= 16;
  drawText(`Commande n° : --------`, 400, y);
  y -= 16;
  drawText(`Échéance : --------`, 400, y);
  y -= 30;

  // Facturé à & Envoyé à
  drawText("Facturé à :", 40, y);
  drawText("Envoyé à :", 300, y);
  y -= 16;
  drawText(`${facture.client?.nom ?? "Nom Client"}`, 40, y);
  drawText(`${facture.client?.nom ?? "Nom Destinataire"}`, 300, y);
  y -= 16;
  drawText("Adresse Client", 40, y);
  drawText("Adresse Destinataire", 300, y);
  y -= 40;

  // Tableau des produits
  const headers = ["Quantité", "Désignation", "Prix unitaire HT", "Montant HT"];
  const columnWidths = [70, 200, 130, 130];
  const rowHeight = 25;
  const tableX = 40;

  const drawTableRow = (cols: string[], y: number, isHeader = false) => {
    let x = tableX;
    cols.forEach((text, i) => {
      page.drawRectangle({
        x,
        y: y - rowHeight,
        width: columnWidths[i],
        height: rowHeight,
        borderWidth: 1,
        borderColor: rgb(0, 0, 0),
        color: rgb(1, 1, 1),
      });
      drawText(text, x + 5, y - 18, isHeader ? 12 : 11);
      x += columnWidths[i];
    });
  };

  // Entête tableau
  drawTableRow(headers, y, true);
  y -= rowHeight;

  // Lignes des produits
  facture.produits.forEach((p) => {
    drawTableRow(
      [
        `${p.quantite}`,
        p.designation,
        `${p.prixUnitaire.toFixed(0)} XOF`,
        `${p.montantTotal.toFixed(0)} XOF`,
      ],
      y
    );
    y -= rowHeight;
  });

  // Totaux
  y -= 30;
  const totalHT = Number(facture.totalHT ?? 0);
  const tva = Number(facture.tva ?? 0);
  const totalTTC = Number(facture.totalTTC ?? 0);

  drawText(`Total HT :     ${totalHT.toFixed(0)} XOF`, 360, y);
  y -= 20;
  drawText(`TVA 18 % :     ${tva.toFixed(0)} XOF`, 360, y);
  y -= 20;
  drawText(`Total :        ${totalTTC.toFixed(0)} XOF`, 360, y);
  y -= 60;

  // Signature
  drawText("Signature", 40, y);

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="facture-${facture.numero}.pdf"`,
    },
  });
}
export const dynamic = "force-dynamic"; // Force la génération dynamique du PDF
export const revalidate = 0; // Désactive la mise en cache pour cette route