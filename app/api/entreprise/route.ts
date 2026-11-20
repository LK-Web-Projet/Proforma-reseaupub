import { requirePermission } from "@/lib/authz";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEntrepriseConfig } from "@/lib/entreprise";

export async function GET() {
    try {
        const config = await getEntrepriseConfig();
        return NextResponse.json(config);
    } catch (error) {
        console.error("Erreur GET entreprise:", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}

export async function PUT(request: Request) {
  const droitsAcces = await requirePermission("parametres.entreprise");
  if (droitsAcces instanceof NextResponse) return droitsAcces;
    try {
        const body = await request.json();

        const {
            nom, slogan, adresse, telephone, email,
            emailFinance, siteWeb, ifu, rccm, nomDirecteur, logoPath,
        } = body;

        const config = await prisma.entrepriseConfig.upsert({
            where: { id: "singleton" },
            update: {
                nom,
                slogan: slogan || null,
                adresse,
                telephone,
                email,
                emailFinance,
                siteWeb: siteWeb || null,
                ifu,
                rccm: rccm || null,
                nomDirecteur,
                logoPath,
            },
            create: {
                id: "singleton",
                nom,
                slogan: slogan || null,
                adresse,
                telephone,
                email,
                emailFinance,
                siteWeb: siteWeb || null,
                ifu,
                rccm: rccm || null,
                nomDirecteur,
                logoPath,
            },
        });

        return NextResponse.json(config);
    } catch (error) {
        console.error("Erreur PUT entreprise:", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}
