"use client";

import { SignIn } from "@clerk/nextjs";
import Image from "next/image";
import { FileText, Building2, Wallet, BarChart3 } from "lucide-react";

const FEATURES = [
  { icon: FileText, text: "Facturation proforma professionnelle" },
  { icon: Building2, text: "Gestion fournisseurs & bons de commande" },
  { icon: Wallet, text: "Suivi budget & trésorerie" },
  { icon: BarChart3, text: "Tableaux de bord en temps réel" },
];

export default function SignInPage() {
  return (
    <div className="min-h-screen flex">
      {/* ── PANNEAU GAUCHE — branding ── */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 relative overflow-hidden bg-[#0a0a0a]">
        {/* Cercles décoratifs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#ef0b53]/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#ef0b53]/10 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#ef0b53]/5 blur-3xl pointer-events-none" />

        {/* Logo + nom */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#ef0b53] flex items-center justify-center shadow-lg shadow-[#ef0b53]/30">
              <span className="text-white text-sm font-bold">RP</span>
            </div>
            <span className="text-white text-xl font-bold tracking-tight">Reseaupub</span>
          </div>
          <p className="text-gray-500 text-xs">Finance Reseaupub · Facturation &amp; Gestion</p>
        </div>

        {/* Titre central */}
        <div className="relative z-10 space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight">
              Pilotez votre activité<br />
              <span className="text-[#ef0b53]">en toute simplicité.</span>
            </h1>
            <p className="mt-4 text-gray-400 text-sm leading-relaxed max-w-sm">
              Une plateforme centralisée pour générer vos proformas, gérer vos
              fournisseurs et suivre votre trésorerie en temps réel.
            </p>
          </div>

          {/* Features */}
          <ul className="space-y-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#ef0b53]/15 border border-[#ef0b53]/20 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-[#ef0b53]" />
                </div>
                <span className="text-gray-300 text-sm">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer gauche */}
        <p className="relative z-10 text-gray-600 text-xs">
          © {new Date().getFullYear()} Reseaupub · Finance &amp; Facturation
        </p>
      </div>

      {/* ── PANNEAU DROIT — formulaire ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-gray-50">
        <div className="w-full max-w-[400px] space-y-8">
          {/* Logo image (mobile + desktop droit) */}
          <div className="flex flex-col items-center gap-3">
            <div className="lg:hidden w-10 h-10 rounded-xl bg-[#ef0b53] flex items-center justify-center shadow-lg shadow-[#ef0b53]/30 mb-1">
              <span className="text-white text-sm font-bold">RP</span>
            </div>
            <Image
              src="/LOGO ROSE@300xcoupé.png"
              alt="Reseaupub"
              width={180}
              height={56}
              className="object-contain"
              priority
            />
          </div>

          {/* Titre formulaire */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">Bienvenue</h2>
            <p className="mt-1 text-sm text-gray-500">Connectez-vous à votre espace de gestion</p>
          </div>

          {/* Formulaire Clerk, stylisé pour correspondre à la charte graphique */}
          <SignIn
            fallbackRedirectUrl="/"
            appearance={{
              layout: {
                logoPlacement: "none",
                socialButtonsPlacement: "bottom",
              },
              variables: {
                colorPrimary: "#ef0b53",
                borderRadius: "0.5rem",
              },
              elements: {
                rootBox: "w-full",
                card: "shadow-none border-0 bg-transparent p-0 w-full",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                formButtonPrimary:
                  "h-11 bg-[#ef0b53] hover:bg-[#b01044] text-white font-semibold rounded-lg shadow-md shadow-[#ef0b53]/20 hover:shadow-[#ef0b53]/30 transition-all duration-200 normal-case text-sm",
                formFieldInput:
                  "h-11 bg-white border-gray-200 rounded-lg focus:border-[#ef0b53] focus:ring-[#ef0b53]/20",
                formFieldLabel: "text-sm font-medium text-gray-700",
                footerActionLink: "text-[#ef0b53] hover:text-[#b01044]",
                dividerLine: "bg-gray-200",
                dividerText: "text-gray-400",
                socialButtonsBlockButton: "h-11 border-gray-200 hover:bg-gray-50 rounded-lg",
              },
            }}
          />

          {/* Footer */}
          <p className="text-center text-xs text-gray-400">
            © {new Date().getFullYear()} Reseaupub · Finance &amp; Facturation
          </p>
        </div>
      </div>
    </div>
  );
}
