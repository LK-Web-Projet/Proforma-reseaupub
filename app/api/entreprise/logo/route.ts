import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
        }

        // Validation type
        if (!file.type.startsWith("image/")) {
            return NextResponse.json({ error: "Type de fichier invalide" }, { status: 400 });
        }

        const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
        const filename = `logo-entreprise.${ext}`;

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const publicPath = path.join(process.cwd(), "public", filename);
        await writeFile(publicPath, buffer);

        return NextResponse.json({ filename });
    } catch (error) {
        console.error("Erreur upload logo:", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}
