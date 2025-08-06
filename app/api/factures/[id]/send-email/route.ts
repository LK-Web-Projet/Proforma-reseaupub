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
        gestionnaires: {
          select: {
            gestionnaire: {
              select: {
                email: true,
              },
            },
          },
        },
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
    if (!facture.gestionnaires || facture.gestionnaires.length === 0) {
      return new NextResponse("Aucun gestionnaire associé à cette facture", {
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
      subject: `Facture Proforma N°${facture.numero} - ${facture.objet}`,
      cc: "karamatouagbetou@reseaupub.com", // ← copie visible
      bcc: `informatique@reseaupub.com, ${facture.gestionnaires
        .map((g) => g.gestionnaire.email)
        .join(", ")}`, // ← copie cachée
      html: `
        <p>Bonjour ${facture.client.nom},</p>
        <p>Veuillez trouver ci-joint notre facture proforma n°<strong>${facture.numero}</strong> concernant <strong>${facture.objet}</strong>.</p>
        <p>N'hésitez pas à nous contacter pour toute question.</p>
        <p>Cordialement,</p>
        <p>L'équipe de ${facture.societeNom}</p>
      `,
      attachments: [
        {
          filename: `facture-${facture.numero}-${facture.objet}-${facture.client.nom}.pdf`, //numero de la facture et le clients et l'objet
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Erreur lors de l'envoi de l'e-mail:", error);
    return new NextResponse(`Erreur interne du serveur: ${error.message}`, { status: 500 });
  }
}
