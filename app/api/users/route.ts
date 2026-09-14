import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clerkClient } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { requireCanManageUsers, syncUserMetadata } from "@/lib/authz";

// GET /api/users - Liste des comptes locaux avec leur rôle
export async function GET() {
  const authError = await requireCanManageUsers();
  if (authError) return authError;

  try {
    const users = await prisma.user.findMany({
      include: { role: { select: { id: true, nom: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs:", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}

const createUserSchema = z.object({
  email: z.string().email("Email invalide."),
  nom: z.string().min(1, "Le nom est requis."),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères."),
  roleId: z.string().min(1, "Le rôle est requis."),
});

// POST /api/users - Créer un compte (admin définit directement le mot de passe)
export async function POST(request: NextRequest) {
  const authError = await requireCanManageUsers();
  if (authError) return authError;

  try {
    const body = await request.json();
    const validation = createUserSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.format() }, { status: 400 });
    }

    const { email, nom, password, roleId } = validation.data;

    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      return NextResponse.json({ error: "Rôle introuvable." }, { status: 400 });
    }

    const client = await clerkClient();

    let clerkUserId: string;
    try {
      const clerkUser = await client.users.createUser({
        emailAddress: [email],
        password,
        firstName: nom,
      });
      clerkUserId = clerkUser.id;
    } catch (clerkError: unknown) {
      console.error("Erreur Clerk lors de la création du compte:", clerkError);
      const message =
        clerkError && typeof clerkError === "object" && "errors" in clerkError
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (clerkError as any).errors?.[0]?.longMessage
          : undefined;
      return NextResponse.json(
        { error: message || "Impossible de créer le compte (email déjà utilisé ou mot de passe trop faible)." },
        { status: 400 }
      );
    }

    const user = await prisma.user.create({
      data: { id: clerkUserId, email, nom, roleId },
      include: { role: true },
    });

    await syncUserMetadata(user.id);

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error("Erreur lors de la création de l'utilisateur:", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
