"use client";

import { SignIn } from "@clerk/nextjs";
import Image from "next/image";
export default function App() {
  return (
    <div className="w-full h-[100vh] flex flex-wrap  items-center justify-center bg-gray-100">
      <div className="h-full w-1/2 flex flex-col items-center justify-center gap-12 p-5 bg-black text-center">
        <Image
          src="/LOGO ROSE@300xcoupé.png"
          alt="Logo"
          width={200}
          height={200}
          className="w-auto h-32"
        />
        <div className="flex flex-col gap-5 text-white text-center">

        <h1 className="text-4xl font-bold">
          Bienvenue sur votre plateforme de generation des facture Proforma
        </h1>
        <p>
          Générez vos factures proforma professionnelles en quelques clics, où
          que vous soyez. Connectez-vous pour créer, personnaliser et envoyer
          vos documents instantanément.
        </p>
        </div>
      </div>
      {/* Render the SignIn component from Clerk */}
      <div className="w-1/2 h-full flex items-center justify-center bg-white p-8">
        <SignIn />
      </div>
    </div>
  );
}
