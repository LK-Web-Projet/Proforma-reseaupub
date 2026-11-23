import { requireAnyPage, requirePermission } from "@/lib/authz";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma, StatusFacture } from "@prisma/client";
import { z } from "zod";

// GET /api/gestionnaires/[id] - Récupérer un gestionnaire et ses factures
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const refusAcces = await requireAnyPage(["commercial"]);
  if (refusAcces) return refusAcces;
  try {
    const { id } = await params;
    const gestionnaire = await prisma.gestionnaire.findUnique({
      where: { id },
      include: {
        factures: {
          include: {
            invoice: {
              include: {
                client: true, // Inclure les détails du client
              },
            },
          },
          orderBy: {
            invoice: {
              dateCreation: "desc",
            },
          },
        },
      },
    });

    if (!gestionnaire) {
      return NextResponse.json(
        { error: "Gestionnaire non trouvé." },
        { status: 404 },
      );
    }

    const invoices = gestionnaire.factures.map((f) => f.invoice);

    const stats = {
      validated: { count: 0, total: 0 },
      sent: { count: 0, total: 0 },
      cancelled: { count: 0, total: 0 },
      payer: { count: 0, total: 0 },
      totalInvoices: invoices.length,
      totalAmount: 0,
    };

    for (const invoice of invoices) {
      stats.totalAmount += invoice.totalTTC.toNumber();
      switch (invoice.statut) {
        case StatusFacture.Valider:
          stats.validated.count++;
          stats.validated.total += invoice.totalTTC.toNumber();
          break;
        case StatusFacture.Envoyer:
          stats.sent.count++;
          stats.sent.total += invoice.totalTTC.toNumber();
          break;
        case StatusFacture.Annuler:
          stats.cancelled.count++;
          stats.cancelled.total += invoice.totalTTC.toNumber();
          break;
        case StatusFacture.Payer:
          stats.payer.count++;
          stats.payer.total += invoice.totalTTC.toNumber();
          break;
      }
    }

    const response = {
      ...gestionnaire,
      stats,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error(
      `Erreur lors de la récupération du gestionnaire ${(await params).id} :`,
      error,
    );
    return NextResponse.json(
      { error: "Erreur Interne du Serveur" },
      { status: 500 },
    );
  }
}
const gestionnaireSchema = z.object({
  nom: z.string().trim().min(1, "Le nom est requis."),
  prenom: z.string().trim().min(1, "Le prénom est requis."),
  email: z.string().trim().email("Email invalide."),
  telephone: z.string().trim().optional().nullable(),
});

// PUT /api/gestionnaires/[id] - Modifier un commercial (droit « Modifier un commercial »)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const droitsAcces = await requirePermission("commercial.modifier");
  if (droitsAcces instanceof NextResponse) return droitsAcces;
  const { id } = await params;

  const validation = gestionnaireSchema.safeParse(await request.json().catch(() => ({})));
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues.map((i) => i.message).join(" ") }, { status: 400 });
  }
  const { nom, prenom, email, telephone } = validation.data;

  try {
    const misAJour = await prisma.gestionnaire.update({
      where: { id },
      data: { nom, prenom, email: email.toLowerCase(), telephone: telephone || null },
    });
    return NextResponse.json(misAJour);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") return NextResponse.json({ error: "Un commercial avec cet email existe déjà." }, { status: 409 });
      if (error.code === "P2025") return NextResponse.json({ error: "Commercial introuvable." }, { status: 404 });
    }
    console.error(`Erreur lors de la modification du commercial ${id} :`, error);
    return NextResponse.json({ error: "Erreur Interne du Serveur" }, { status: 500 });
  }
}

// PATCH /api/gestionnaires/[id] - Désactiver / réactiver un commercial ({ actif }).
// Inactif : il n'est plus proposé sur les nouvelles proformas, et reste affiché sur les anciennes.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const droitsAcces = await requirePermission("commercial.desactiver");
  if (droitsAcces instanceof NextResponse) return droitsAcces;
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  if (typeof body?.actif !== "boolean") {
    return NextResponse.json({ error: "Indiquez « actif » (vrai ou faux)." }, { status: 400 });
  }

  try {
    const misAJour = await prisma.gestionnaire.update({ where: { id }, data: { actif: body.actif } });
    return NextResponse.json(misAJour);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Commercial introuvable." }, { status: 404 });
    }
    console.error(`Erreur lors du changement d'état du commercial ${id} :`, error);
    return NextResponse.json({ error: "Erreur Interne du Serveur" }, { status: 500 });
  }
}
