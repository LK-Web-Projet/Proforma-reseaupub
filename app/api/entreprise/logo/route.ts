import { requirePermission } from "@/lib/authz";
import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { ALLOWED_IMAGE_EXTENSIONS, fileExtension } from "@/lib/uploadSecurity";

export async function POST(request: Request) {
  const droitsAcces = await requirePermission("parametres.entreprise");
  if (droitsAcces instanceof NextResponse) return droitsAcces;
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

        // L'extension vient du nom envoyé par le client : liste blanche, sinon un "logo.html"
        // serait écrit à la racine de /public et servi par le site.
        const ext = fileExtension(file.name);
        if (!(ALLOWED_IMAGE_EXTENSIONS as readonly string[]).includes(ext)) {
            return NextResponse.json({ error: "Format d'image non accepté (jpg, png, webp, gif)." }, { status: 400 });
        }
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
