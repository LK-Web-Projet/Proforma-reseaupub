import { NextResponse } from "next/server";
import { getBudgetCapabilities, isImpliqueBudget } from "@/lib/budgetAuth";

// Droits budget de l'utilisateur connecté, pour l'affichage des boutons côté client.
// `isAdmin` / `isComptable` sont conservés pour les écrans fournisseurs qui les lisent déjà
// (isAdmin = canValidateMensuel, isComptable = canPay). La sécurité reste vérifiée côté serveur.
export async function GET() {
  const caps = await getBudgetCapabilities();
  if (!caps) {
    return NextResponse.json({
      email: null, isAdmin: false, isComptable: false,
      canValidateMensuel: false, canValidate: false, canPay: false, canSaisirCaisse: false, isImplique: false, plafond: 0,
    });
  }
  return NextResponse.json({
    email: caps.email,
    isAdmin: caps.canValidateMensuel,
    isComptable: caps.canPay,
    canValidateMensuel: caps.canValidateMensuel,
    canValidate: caps.canValidate,
    canPay: caps.canPay,
    canSaisirCaisse: caps.canSaisirCaisse,
    isImplique: isImpliqueBudget(caps),
    plafond: caps.plafond,
  });
}
