import fs from "fs";
import path from "path";

// Contexte d'une exécution : marqueur unique, comptes de test, données créées. Écrit par
// global-setup.ts, complété par les tests, relu par global-teardown.ts pour TOUT supprimer.
// Fichier local ignoré par git (e2e/.run/) — il contient les mots de passe des comptes de test.
export interface RunContext {
  run: string; // ex. "E2E-mabc12" — préfixe de toutes les données créées
  password: string; // mot de passe des comptes de test (générés par l'admin pendant les tests)
  plafond: number;
  clientId: string;
  invoiceId: string;
  invoiceNumero: string;
  users: { demandeur: string; valideur: string; comptable: string }; // emails
  roles: { demandeur: string; valideur: string; comptable: string }; // noms
  caisseNom: string;
  // Rempli au fil des tests
  caisseId?: number;
  budgetCampagneId?: string;
  budgetPonctuelId?: string;
}

const DIR = path.join(__dirname, ".run");
const FILE = path.join(DIR, "context.json");

export function writeRunContext(ctx: RunContext) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(ctx, null, 2));
}

export function readRunContext(): RunContext {
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}

export function updateRunContext(patch: Partial<RunContext>) {
  writeRunContext({ ...readRunContext(), ...patch });
}

export function runContextExists() {
  return fs.existsSync(FILE);
}

export function removeRunContext() {
  fs.rmSync(DIR, { recursive: true, force: true });
}
