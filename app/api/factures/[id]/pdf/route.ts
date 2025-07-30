import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import prisma from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const facture = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { client: true, produits: true },
  });

  if (!facture) {
    return NextResponse.json({ error: "Facture non trouvée" }, { status: 404 });
  }

  // Génération du PDF
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  page.drawText(`Facture n°${facture.numero}\nClient: ${facture.client.nom}\nTotal TTC: ${facture.totalTTC} XOF`, { x: 50, y: 750 });

  // ...ajoute plus d'infos selon besoin...

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="facture-${facture.numero}.pdf"`,
    },
  });
}