
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { Invoice, InvoiceProduit, Client } from "@prisma/client";

type InvoiceWithDetails = Invoice & {
  client: Client;
  produits: InvoiceProduit[];
};

export async function generateInvoicePdf(facture: InvoiceWithDetails): Promise<Uint8Array> {
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
  // ESPACE EN HAUT
  y -= 40;
  // Titre
  centerText("FACTURE PROFORMA", y, 16);
  y -= 50;
 
  // Coordonnées entreprise
  drawText("Delivrer par : Nom de la société", 40, y);
  y -= 16;
  drawText("Adresse : Etoile Rouge, Cotonou , Benin", 40, y);
  y -= 16;
  drawText("finance@reseaupub.com", 40, y);
  y -= 16;
  drawText("Téléphone : +229 01 XX XX XX XX", 40, y);
  y = 670;

  // Partie droite : infos facture
  //ESPACE AU DESSUS
  y -= 10;
  drawText(`Facture n° ${facture.numero ?? "001"}`, 370, y);
  y -= 16;
  drawText(
    `Date : ${new Date(facture.dateCreation).toLocaleDateString("fr-FR")}`,
    370,
    y
  );

  y -= 16;
  drawText(`Commande n° : --------`, 370, y);
  y -= 16;
  drawText(`Échéance : --------`, 370, y);
  y -= 30;
  //ESPACE ENTRE LES DEUX PARTIES
  y -= 30;
  // Ligne de séparation
  page.drawLine({
    start: { x: 40, y },
    end: { x: 560, y },
    color: rgb(0, 0, 0),
  });
  y -= 30;

  // Facturé à & Envoyé à

  drawText(`Facturé à : ${facture.client?.nom ?? "Nom Client"}`, 40, y);
  y -= 20;
  drawText(`Adresse : ${facture.client?.adresse ?? "Adresse Client"}`, 40, y);
  y -= 20;
  drawText(`Mail : ${facture.client?.email ?? "Mail Destinataire"}`, 40, y);
  y -= 20;
  drawText(`Téléphone : ${facture.client?.telephone ?? "Téléphone Client"}`, 40, y);
  y -= 25;

  // Tableau des produits
  // Définition des en-têtes, largeurs de colonnes et hauteur de ligne
  const headers = ["Quantité", "Désignation", "Prix unitaire HT", "Montant HT"];
  const columnWidths = [60, 200, 130, 130];
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
        opacity: isHeader ? 0.5 : 1,
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
        `${p.prixUnitaire.toString()} XOF`,
        `${p.montantTotal.toString()} XOF`,
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
  drawText(`Total HT :     ${totalHT.toString()} XOF`, 360, y);
  y -= 20;
  drawText(`TVA 18 % :     ${tva.toString()} XOF`, 360, y);
  y -= 20;
  drawText(`Total :        ${totalTTC.toString()} XOF`, 360, y);
  y -= 40;
  // Conditions de paiement
  drawText(
    `Arreté la présente facture Proforma à la somme de   ${totalTTC.toString()} XOF  francs FCFA (XOF) TTC`,
    40,
    y
  );
  y -= 20;
  //espace entre les conditions et la signature
  y -= 50;

  // Signature
  // mettre a droite la signature
  drawText("Directrice Générale", 400, y, 14 ); // mettre en gras et souligné
  y -= 50;
  drawText("Karamatou AGBETOU", 400, y);

  // Ajouter une ligne pour expliquer les abbréviations
  y -= 0;
  drawText("HT : Hors Taxes", 40, y , 10);
  y -= 15;
  drawText("TTC : Toutes Taxes Comprises", 40, y , 10);
  y -= 15;
  drawText("TVA : Taxe sur la Valeur Ajoutée", 40, y , 10);
  y -= 15;

  return await pdfDoc.save();
}
