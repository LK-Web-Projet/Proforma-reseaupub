import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { PAGE_KEYS, reponseMigrationManquante, requireCanManageUsers } from "@/lib/authz";
import { permissionsCoherentes } from "@/lib/permissions";

/** Rôles avec leurs droits d'action ; tolère l'absence de la table tant que la migration n'est pas appliquée. */
async function lireRoles() {
  try {
    return await prisma.role.findMany({
      include: { pages: true, permissions: true, _count: { select: { users: true } } },
      orderBy: { nom: "asc" },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021")) throw error;
    const roles = await prisma.role.findMany({ include: { pages: true, _count: { select: { users: true } } }, orderBy: { nom: "asc" } });
    return roles.map((r) => ({ ...r, permissions: [] as { permission: string }[] }));
  }
}

// GET /api/roles - Liste des rôles avec leurs pages autorisées
export async function GET() {
  const authError = await requireCanManageUsers();
  if (authError) return authError;

  try {
    const roles = await lireRoles();

    return NextResponse.json(
      roles.map((r) => ({
        id: r.id,
        nom: r.nom,
        canManageUsers: r.canManageUsers,
        canValidateBudgetMensuel: r.canValidateBudgetMensuel,
        canValidateBudget: r.canValidateBudget,
        canPayBudget: r.canPayBudget,
        canSaisirCaisse: r.canSaisirCaisse,
        canSaisirPetiteDepense: r.canSaisirPetiteDepense,
        pages: r.pages.map((p) => p.page),
        permissions: r.permissions.map((p) => p.permission),
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
  // Clés « module.action » (lib/permissions.ts) ; filtrées selon les pages (règle descendante).
  permissions: z.array(z.string()).default([]),
  canManageUsers: z.boolean().default(false),
  canValidateBudgetMensuel: z.boolean().default(false),
  canValidateBudget: z.boolean().default(false),
  canPayBudget: z.boolean().default(false),
  canSaisirCaisse: z.boolean().default(false),
  canSaisirPetiteDepense: z.boolean().default(false),
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

    const { nom, pages, permissions, canManageUsers, canValidateBudgetMensuel, canValidateBudget, canPayBudget, canSaisirCaisse, canSaisirPetiteDepense } = validation.data;

    const role = await prisma.role.create({
      data: {
        nom,
        canManageUsers,
        canValidateBudgetMensuel,
        canValidateBudget,
        canPayBudget,
        canSaisirCaisse,
        canSaisirPetiteDepense,
        pages: { create: pages.map((page) => ({ page })) },
        permissions: { create: permissionsCoherentes(permissions, pages).map((permission) => ({ permission })) },
      },
      include: { pages: true, permissions: true },
    });

    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    console.error("Erreur lors de la création du rôle:", error);
    const migration = reponseMigrationManquante(error);
    if (migration) return migration;
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Un rôle avec ce nom existe déjà." }, { status: 409 });
    }
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
