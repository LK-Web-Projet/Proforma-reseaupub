import { readRunContext, removeRunContext, runContextExists } from "./run-context";
import { nettoyer } from "./cleanup";

// Supprime les données de l'exécution (sauf E2E_KEEP_DATA=true, pour les inspecter).
export default async function globalTeardown() {
  if (!runContextExists()) return;
  const ctx = readRunContext();
  if (process.env.E2E_KEEP_DATA === "true") {
    console.log(`E2E_KEEP_DATA=true : données ${ctx.run} conservées (nettoyées au prochain lancement).`);
    return;
  }
  await nettoyer(ctx);
  removeRunContext();
}
