"use client";

import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AccesRefusePage() {
  return (
    <div className="w-full h-screen flex flex-col items-center justify-center gap-6 bg-gray-100 text-center p-8">
      <div className="p-4 rounded-full bg-red-100 text-red-600">
        <ShieldAlert className="w-10 h-10" />
      </div>
      <div className="space-y-2 max-w-md">
        <h1 className="text-2xl font-bold text-slate-900">Accès refusé</h1>
        <p className="text-muted-foreground">
          Votre compte n&apos;a pas accès à cette section de l&apos;application. Contactez un
          administrateur si vous pensez que c&apos;est une erreur.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button asChild>
          <Link href="/">Retour à l&apos;accueil</Link>
        </Button>
        <SignOutButton redirectUrl="/sign-in">
          <Button variant="outline">Se déconnecter</Button>
        </SignOutButton>
      </div>
    </div>
  );
}
