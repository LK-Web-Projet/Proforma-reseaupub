import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// --- Routes publiques ---
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/"]);

// --- Origines autorisées depuis .env ---
const allowedOrigins = process.env.NEXT_PUBLIC_ALLOWED_ORIGINS
  ? process.env.NEXT_PUBLIC_ALLOWED_ORIGINS.split(",")
  : [];

export default clerkMiddleware((auth, req: NextRequest) => {
  const origin = req.headers.get("origin") || "";
  const res = NextResponse.next();

  // ----- Clerk -----
  if (!isPublicRoute(req)) {
    auth.protect();
  }

  // ----- CORS -----
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
    // Toutes les pages sauf assets (_next, fichiers statiques)
    "/((?!_next|.*\\..*).*)",
    // API
    "/(api|trpc)(.*)",
  ],
};
