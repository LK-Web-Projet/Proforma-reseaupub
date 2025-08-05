import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateInvoicePdf } from "@/lib/pdf";

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

  const pdfBytes = await generateInvoicePdf(facture);

  return new NextResponse(Buffer.from(pdfBytes) , {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="facture-${facture.numero}.pdf"`,
    },
  });
}
export const dynamic = "force-dynamic"; // Force la génération dynamique du PDF
export const revalidate = 0; // Désactive la mise en cache pour cette route