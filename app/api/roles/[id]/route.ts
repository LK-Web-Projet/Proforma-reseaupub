import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { PAGE_KEYS, reponseMigrationManquante, requireCanManageUsers, syncAllUsersForRole } from "@/lib/authz";
import { isPageKey, permissionsCoherentes } from "@/lib/permissions";

const roleUpdateSchema = z.object({
  nom: z.string().min(1).optional(),
  pages: z.array(z.enum(PAGE_KEYS)).optional(),
  // Clés « module.action » (lib/permissions.ts) ; filtrées selon les pages (règle descendante).
  permissions: z.array(z.string()).optional(),
  canManageUsers: z.boolean().optional(),
  canValidateBudgetMensuel: z.boolean().optional(),
  canValidateBudget: z.boolean().optional(),
  canPayBudget: z.boolean().optional(),
  canSaisirCaisse: z.boolean().optional(),
  canSaisirPetiteDepense: z.boolean().optional(),
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

    const { nom, pages, permissions, canManageUsers, canValidateBudgetMensuel, canValidateBudget, canPayBudget, canSaisirCaisse, canSaisirPetiteDepense } = validation.data;

    const existing = await prisma.role.findUnique({ where: { id }, include: { pages: true } });
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
          canSaisirPetiteDepense,
        },
      });

      if (pages) {
        await tx.rolePage.deleteMany({ where: { roleId: id } });
        await tx.rolePage.createMany({ data: pages.map((page) => ({ roleId: id, page })) });
      }

      // Droits d'action : remplacés s'ils sont fournis ; dans tous les cas, une page retirée
      // retire les droits de son module (règle descendante).
      if (permissions || pages) {
        const pagesFinales = pages ?? existing.pages.map((p) => p.page).filter(isPageKey);
        const actuelles =
          permissions ?? (await tx.rolePermission.findMany({ where: { roleId: id } })).map((p) => p.permission);
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        await tx.rolePermission.createMany({
          data: permissionsCoherentes(actuelles, pagesFinales).map((permission) => ({ roleId: id, permission })),
        });
      }
    });

    // Le rôle a changé : resynchroniser tous les comptes qui l'utilisent.
    await syncAllUsersForRole(id);

    const updated = await prisma.role.findUnique({ where: { id }, include: { pages: true, permissions: true } });
    return NextResponse.json(updated);
  } catch (error) {
    console.error(`Erreur lors de la mise à jour du rôle ${id}:`, error);
    const migration = reponseMigrationManquante(error);
    if (migration) return migration;
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Un rôle avec ce nom existe déjà." }, { status: 409 });
    }
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
