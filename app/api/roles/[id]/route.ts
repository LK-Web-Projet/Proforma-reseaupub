import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { PAGE_KEYS, requireCanManageUsers, syncAllUsersForRole } from "@/lib/authz";

const roleUpdateSchema = z.object({
  nom: z.string().min(1).optional(),
  pages: z.array(z.enum(PAGE_KEYS)).optional(),
  canManageUsers: z.boolean().optional(),
  canValidateBudgetMensuel: z.boolean().optional(),
  canValidateBudget: z.boolean().optional(),
  canPayBudget: z.boolean().optional(),
  canSaisirCaisse: z.boolean().optional(),
});

// PATCH /api/roles/[id] - Modifier un rôle (nom, pages autorisées, droit de gestion des comptes)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireCanManageUsers();
  if (authError) return authError;

  const { id } = await params;

  try {
    const body = await request.json();
    const validation = roleUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.format() }, { status: 400 });
    }

    const { nom, pages, canManageUsers, canValidateBudgetMensuel, canValidateBudget, canPayBudget, canSaisirCaisse } = validation.data;

    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Rôle introuvable." }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.role.update({
        where: { id },
        data: {
          nom,
          canManageUsers,
          canValidateBudgetMensuel,
          canValidateBudget,
          canPayBudget,
          canSaisirCaisse,
        },
      });

      if (pages) {
        await tx.rolePage.deleteMany({ where: { roleId: id } });
        await tx.rolePage.createMany({ data: pages.map((page) => ({ roleId: id, page })) });
      }
    });

    // Le rôle a changé : resynchroniser tous les comptes qui l'utilisent.
    await syncAllUsersForRole(id);

    const updated = await prisma.role.findUnique({ where: { id }, include: { pages: true } });
    return NextResponse.json(updated);
  } catch (error) {
    console.error(`Erreur lors de la mise à jour du rôle ${id}:`, error);
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Un rôle avec ce nom existe déjà." }, { status: 409 });
    }
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
