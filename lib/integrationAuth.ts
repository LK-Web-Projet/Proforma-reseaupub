import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

function safeCompare(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Vérifie le header `Authorization: Bearer <clé>` des appels serveur-à-serveur
 * (app campagnes -> app proforma/finance). Retourne une NextResponse d'erreur
 * si la clé est absente/invalide, ou `null` si l'appel est autorisé.
 */
export function verifyIntegrationKey(request: NextRequest): NextResponse | null {
  const expected = process.env.INTEGRATION_API_KEY;
  if (!expected) {
    console.error("INTEGRATION_API_KEY n'est pas configurée sur le serveur.");
    return NextResponse.json(
      { error: "Intégration non configurée." },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization") || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token || !safeCompare(token, expected)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  return null;
}
