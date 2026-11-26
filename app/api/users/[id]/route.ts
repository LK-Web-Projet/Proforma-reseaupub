import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clerkClient } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { requireCanManageUsers, syncUserMetadata } from "@/lib/authz";

const updateUserSchema = z.object({
  roleId: z.string().min(1).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères.").optional(),
  // Départements du compte (budgets collectifs) : la liste complète remplace l'ancienne.
  departementIds: z.array(z.string()).optional(),
});

// PATCH /api/users/[id] - Changer le rôle et/ou activer/désactiver un compte
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireCanManageUsers();
  if (authError) return authError;

  const { id } = await params;

  try {
    const body = await request.json();
    const validation = updateUserSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.format() }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
    }

    const { roleId, active, password, departementIds } = validation.data;
    if (departementIds) {
      const uniques = [...new Set(departementIds)];
      const trouves = await prisma.departement.count({ where: { id: { in: uniques } } });
      if (trouves !== uniques.length) return NextResponse.json({ error: "Un département choisi n'existe plus : rechargez la page." }, { status: 400 });
      await prisma.$transaction([
        prisma.utilisateurDepartement.deleteMany({ where: { userId: id } }),
        prisma.utilisateurDepartement.createMany({ data: uniques.map((departementId) => ({ userId: id, departementId })) }),
      ]);
      if (roleId === undefined && active === undefined && !password) return NextResponse.json({ success: true, departementIds: uniques });
    }

    if (roleId) {
      const role = await prisma.role.findUnique({ where: { id: roleId } });
      if (!role) {
        return NextResponse.json({ error: "Rôle introuvable." }, { status: 400 });
      }
    }

    const client = await clerkClient();

    if (password) {
      try {
        // Changer le mot de passe déconnecte l'utilisateur de ses autres sessions actives,
        // par sécurité (ex: si le compte a été compromis ou que l'admin réinitialise après un doute).
        await client.users.updateUser(id, { password, signOutOfOtherSessions: true });
      } catch (clerkError: unknown) {
        console.error("Erreur Clerk lors du changement de mot de passe:", clerkError);
        const message =
          clerkError && typeof clerkError === "object" && "errors" in clerkError
            ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (clerkError as any).errors?.[0]?.longMessage
            : undefined;
        return NextResponse.json(
          { error: message || "Impossible de changer le mot de passe (trop faible ?)." },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { roleId, active },
      include: { role: true },
    });

    // Un compte désactivé est aussi banni côté Clerk pour l'empêcher réellement de se connecter,
    // pas seulement de perdre l'accès aux pages.
    if (active !== undefined && active !== existing.active) {
      if (active) {
        await client.users.unbanUser(id);
      } else {
        await client.users.banUser(id);
      }
    }

    await syncUserMetadata(id);

    return NextResponse.json(updated);
  } catch (error) {
    console.error(`Erreur lors de la mise à jour de l'utilisateur ${id}:`, error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
