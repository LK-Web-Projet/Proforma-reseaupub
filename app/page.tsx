// app/page.tsx
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const user = await currentUser();

  if (user) {
    // Déjà connecté → redirige vers /facture
    redirect("/facture");
  }

  // Pas connecté → redirige vers /sign-in
  redirect("/sign-in");
}
