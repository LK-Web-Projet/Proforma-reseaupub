
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import nodemailer from "nodemailer";
import { generateInvoicePdf } from "@/lib/pdf";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    const facture = await prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        produits: true,
      },
    });

    if (!facture) {
      return new NextResponse("Facture non trouvée", { status: 404 });
    }

    if (!facture.client.email) {
      return new NextResponse("L'e-mail du client n'est pas renseigné", {
        status: 400,
      });
    }

    const pdfBytes = await generateInvoicePdf(facture);

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT),
      secure: process.env.EMAIL_SECURE === "true",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: facture.client.email,
      subject: `Facture de ${facture.objet} Proforma N° ${facture.numero}`,
      text: `Veuillez trouver ci-joint la facture de ${facture.objet} proforma n° ${facture.numero}.`,
      attachments: [
        {
          filename: `facture-${facture.numero}.pdf`,
          content: Buffer.from(pdfBytes),
          contentType: "application/pdf",
        },
      ],
    };

    await transporter.sendMail(mailOptions);

    // Mettre à jour le statut de la facture
    await prisma.invoice.update({
      where: { id },
      data: { statut: "Envoyé" },
    });

    return new NextResponse("E-mail envoyé avec succès", { status: 200 });
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'e-mail:", error);
    return new NextResponse("Erreur interne du serveur", { status: 500 });
  }
}
