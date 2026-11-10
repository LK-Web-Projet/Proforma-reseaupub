import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { PAGE_KEYS, requireCanManageUsers } from "@/lib/authz";

// GET /api/roles - Liste des rôles avec leurs pages autorisées
export async function GET() {
  const authError = await requireCanManageUsers();
  if (authError) return authError;

  try {
    const roles = await prisma.role.findMany({
      include: { pages: true, _count: { select: { users: true } } },
      orderBy: { nom: "asc" },
    });

    return NextResponse.json(
      roles.map((r) => ({
        id: r.id,
        nom: r.nom,
        canManageUsers: r.canManageUsers,
        canValidateBudgetMensuel: r.canValidateBudgetMensuel,
        canValidateBudget: r.canValidateBudget,
        canPayBudget: r.canPayBudget,
        pages: r.pages.map((p) => p.page),
        nombreUtilisateurs: r._count.users,
      }))
    );
  } catch (error) {
    console.error("Erreur lors de la récupération des rôles:", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

const roleSchema = z.object({
  nom: z.string().min(1, "Le nom du rôle est requis."),
  pages: z.array(z.enum(PAGE_KEYS)),
  canManageUsers: z.boolean().default(false),
  canValidateBudgetMensuel: z.boolean().default(false),
  canValidateBudget: z.boolean().default(false),
  canPayBudget: z.boolean().default(false),
});

// POST /api/roles - Créer un nouveau rôle
export async function POST(request: NextRequest) {
  const authError = await requireCanManageUsers();
  if (authError) return authError;

  try {
    const body = await request.json();
    const validation = roleSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.format() }, { status: 400 });
    }

    const { nom, pages, canManageUsers, canValidateBudgetMensuel, canValidateBudget, canPayBudget } = validation.data;

    const role = await prisma.role.create({
      data: {
        nom,
        canManageUsers,
        canValidateBudgetMensuel,
        canValidateBudget,
        canPayBudget,
        pages: { create: pages.map((page) => ({ page })) },
      },
      include: { pages: true },
    });

    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    console.error("Erreur lors de la création du rôle:", error);
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Un rôle avec ce nom existe déjà." }, { status: 409 });
    }
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
