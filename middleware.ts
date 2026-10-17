import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolvePageKeyFromPathname, resolveLandingUrl, type AppPublicMetadata } from "@/lib/permissions";

// --- Routes publiques (ne nécessitent pas d'auth) ---
// Les routes /api/integration/* sont pour les appels serveur-à-serveur (autre app),
// elles ne sont pas protégées par Clerk mais par une clé API (voir lib/integrationAuth.ts)
// Note : "/" n'est plus listée ici, elle est gérée explicitement en tout premier dans le
// middleware (voir plus bas) pour éviter un bug connu de React (facebook/react#33580 /
// vercel/next.js#63121, non corrigé sur Next 15.4.x / React 19.1.0) où un `redirect()`
// appelé depuis un Server Component juste après un `await auth()`/`currentUser()` peut
// faire planter le Router interne de Next.js ("Rendered more hooks than during the
// previous render"). Une redirection HTTP faite ici, dans le middleware, évite complètement
// ce chemin de code buggé.
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/favicon.ico",
  "/acces-refuse",
  "/api/integration(.*)",
]);

// --- Origines autorisées pour CORS depuis .env ---
const allowedOrigins = process.env.NEXT_PUBLIC_ALLOWED_ORIGINS
  ? process.env.NEXT_PUBLIC_ALLOWED_ORIGINS.split(",")
  : [];

// Bascule de sécurité pour le contrôle d'accès par page (rôles/permissions).
// Tant que (1) le token de session Clerk n'a pas été configuré pour inclure le
// custom claim "metadata" (Dashboard Clerk → Sessions → Customize session token →
// { "metadata": "{{user.public_metadata}}" }), et (2) le script de bootstrap n'a pas
// attribué un rôle Admin à tous les comptes existants, laisser cette variable absente
// désactive le contrôle par page : seule l'authentification (comme avant) s'applique,
// pour éviter de bloquer tout le monde par erreur. Voir HISTORIQUE.md pour la procédure
// complète d'activation. Une fois prêt, mettre ENABLE_PAGE_PERMISSIONS=true dans .env.
const ENABLE_PAGE_PERMISSIONS = process.env.ENABLE_PAGE_PERMISSIONS === "true";

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const origin = req.headers.get("origin") || "";
  const res = NextResponse.next();

  // ----- Racine "/" : redirection HTTP directe vers la bonne destination (sign-in, ou la
  // première section autorisée par le rôle) — voir le commentaire sur isPublicRoute ci-dessus.
  if (req.nextUrl.pathname === "/") {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
    const pagePermissionsEnabled = process.env.ENABLE_PAGE_PERMISSIONS === "true";
    const metadata = sessionClaims?.metadata as AppPublicMetadata | undefined;
    const target = pagePermissionsEnabled ? resolveLandingUrl(metadata?.pages) : "/facture";
    return NextResponse.redirect(new URL(target, req.url));
  }

  // ----- Authentification -----
  if (!isPublicRoute(req)) {
    try {
      await auth.protect(); // Vérifie si l'utilisateur est connecté
    } catch {
      // Si route API → renvoyer 401
      if (req.nextUrl.pathname.startsWith("/api")) {
        return new NextResponse("Unauthorized", { status: 401 });
      }
      // Sinon → rediriger vers la page de login
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }

    // ----- Autorisation par page (rôles/permissions) -----
    if (ENABLE_PAGE_PERMISSIONS && !req.nextUrl.pathname.startsWith("/api")) {
      const pageKey = resolvePageKeyFromPathname(req.nextUrl.pathname);
      if (pageKey) {
        const { sessionClaims } = await auth();
        const metadata = sessionClaims?.metadata as AppPublicMetadata | undefined;
        const allowedPages = metadata?.pages ?? [];
        if (!allowedPages.includes(pageKey)) {
          return NextResponse.redirect(new URL("/acces-refuse", req.url));
        }
      }
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
