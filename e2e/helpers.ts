import { expect, type Browser, type Locator, type Page } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export interface Session {
  page: Page;
  erreurs: string[]; // exceptions JavaScript non rattrapées dans le navigateur
  fermer: () => Promise<void>;
}

/**
 * Ouvre un navigateur isolé et connecte le compte (connexion Clerk par mot de passe, avec le
 * jeton de test qui contourne la protection anti-robot). Chaque rôle a sa propre session.
 */
export async function connecter(browser: Browser, email: string, password: string): Promise<Session> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const erreurs: string[] = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  await setupClerkTestingToken({ page });
  await page.goto("/sign-in");
  await clerk.signIn({ page, signInParams: { strategy: "password", identifier: email, password } });
  return { page, erreurs, fermer: () => context.close() };
}

/** Choisit une option dans un sélecteur shadcn/Radix (le déclencheur est un role=combobox). */
export async function choisir(page: Page, declencheur: Locator, option: string | RegExp) {
  await declencheur.click();
  await page.getByRole("option", { name: option }).first().click();
}

/** Interrupteur (Switch) d'une ligne de formulaire repérée par son libellé. */
export function interrupteur(conteneur: Locator, libelle: string): Locator {
  return conteneur.locator("div.justify-between", { hasText: libelle }).getByRole("switch").first();
}

/** Attend un message (toast sonner) contenant ce texte. */
export async function attendreToast(page: Page, texte: string | RegExp) {
  await expect(page.getByText(texte).first()).toBeVisible();
}

/** Petit PDF valide (scan factice) pour les envois de fichiers. */
export function pdfFactice(titre = "Document de test E2E"): Buffer {
  const contenu = `BT /F1 18 Tf 72 720 Td (${titre}) Tj ET`;
  const objets = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${contenu.length} >>\nstream\n${contenu}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objets.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

/** Ligne d'un tableau qui contient ce texte. */
export function ligne(page: Page, texte: string): Locator {
  return page.locator("tr", { hasText: texte }).first();
}
