import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import nodemailer from "nodemailer";
import { generateInvoicePdf } from "@/lib/pdf";

    function getSalutation() {
  const currentHour = new Date().getHours();

  if (currentHour < 12) {
    return "Bonjour";
  } else if (currentHour < 18) {
    return "Bonsoir";
  } else {
    return "Bonsoir";
  }
} 
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> } // params est un Promise dans App Router
) {
  const { id } = await context.params; // ✅ On attend params pour éviter le warning Next.js
  
  try {
    console.log(`📨 Envoi de l'email pour la facture ID: ${id}`);

    const facture = await prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        produits: true,
        devise: true,
        gestionnaires: {
          select: {
            gestionnaire: {
              select: { email: true },
            },
          },
        },
      },
    });

    if (!facture) {
      return new NextResponse("Facture non trouvée", { status: 404 });
    }

    if (!facture.client?.email?.trim()) {
      return new NextResponse("L'e-mail du client n'est pas renseigné", {
        status: 400,
      });
    }

    // Récupération de la configuration entreprise
    const { getEntrepriseConfig } = await import("@/lib/entreprise");
    const entreprise = await getEntrepriseConfig();

    // Génération du PDF
    const pdfBytes = await generateInvoicePdf(facture, entreprise);

    // Config du transporteur
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT),
      secure: process.env.EMAIL_SECURE === "true",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // 📩 Destinataires BCC
    const bccList: string[] = [
      "informatique@reseaupub.com",
      "alimatou.akadiri@reseaupub.com"
    ];

    // ✅ Ajout uniquement des emails valides des gestionnaires (si présents)
    if (facture.gestionnaires?.length) {
      const gestionnaireEmails = facture.gestionnaires
        .map((g) => g.gestionnaire?.email?.trim())
        .filter((email): email is string => Boolean(email));

      if (gestionnaireEmails.length > 0) {
        bccList.push(...gestionnaireEmails);
      }
    }


    const salutation = getSalutation();
    // 📧 Options d'email
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: facture.client.email,
      subject: `Facture Proforma N°${facture.numero} - ${facture.objet}`,
      cc: "karamatouagbetou@reseaupub.com",
      bcc: bccList.join(", "),
      html: `
        <p>${salutation} ${facture.client.nom},</p>
        <p>Nous vous prions de recevoir ci-joint la proforma n°<strong>${facture.numero}</strong>  liée à votre demande <strong>${facture.objet}</strong>.</p>
        <p>N'hésitez pas à nous contacter pour toute question.</p>
        <p>Cordialement,</p>
        <p>L'équipe de ${facture.societeNom}</p>
      `,
      attachments: [
        {
          filename: `facture-${facture.numero}-${facture.objet}-${facture.client.nom}.pdf`,
          content: Buffer.from(pdfBytes),
          contentType: "application/pdf",
        },
      ],
    };

    // 📤 Envoi de l'email
    await transporter.sendMail(mailOptions);

    // 📝 Mise à jour du statut
    await prisma.invoice.update({
      where: { id },
      data: { statut: "Envoyer" },
    });

    return new NextResponse("E-mail envoyé avec succès", { status: 200 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("❌ Erreur lors de l'envoi de l'e-mail: ou Mail du client non renseigné", error);
    return new NextResponse(`Erreur interne du serveur: ${error.message}`, {
      status: 500,
    });
  }
}
