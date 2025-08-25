import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes publiques
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/"]);

// Récupère les origines autorisées depuis .env
const allowedOrigins =
  process.env.NEXT_PUBLIC_ALLOWED_ORIGINS?.split(",") || [];

export default clerkMiddleware((auth, req: NextRequest) => {
  // --- Clerk ---
  if (!isPublicRoute(req)) {
    auth.protect();
  }

  // --- CORS ---
  const origin = req.headers.get("origin") || "";
  const res = NextResponse.next();

  if (allowedOrigins.includes(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,DELETE,OPTIONS"
    );
    res.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
  }

  return res;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*|/)",
    "/(api|trpc)(.*)",
  ],
};
