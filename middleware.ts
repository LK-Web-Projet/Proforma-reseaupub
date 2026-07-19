import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// --- Routes publiques (ne nécessitent pas d'auth) ---
// Les routes /api/integration/* sont pour les appels serveur-à-serveur (autre app),
// elles ne sont pas protégées par Clerk mais par une clé API (voir lib/integrationAuth.ts)
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/",
  "/favicon.ico",
  "/api/integration(.*)",
]);

// --- Origines autorisées pour CORS depuis .env ---
const allowedOrigins = process.env.NEXT_PUBLIC_ALLOWED_ORIGINS
  ? process.env.NEXT_PUBLIC_ALLOWED_ORIGINS.split(",")
  : [];

export default clerkMiddleware((auth, req: NextRequest) => {
  const origin = req.headers.get("origin") || "";
  const res = NextResponse.next();

  // ----- Authentification -----
  if (!isPublicRoute(req)) {
    try {
      auth.protect(); // Vérifie si l'utilisateur est connecté
    } catch {
      // Si route API → renvoyer 401
      if (req.nextUrl.pathname.startsWith("/api")) {
        return new NextResponse("Unauthorized", { status: 401 });
      }
      // Sinon → rediriger vers la page de login
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
  }

  // ----- CORS -----
  if (allowedOrigins.includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,DELETE,OPTIONS",
    );
    res.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
  }

  return res;
});

export const config = {
  matcher: [
    // Toutes les pages sauf assets (_next, fichiers statiques)
    "/((?!_next|.*\\..*).*)",
    // Toutes les API
    "/(api|trpc)(.*)",
  ],
};
