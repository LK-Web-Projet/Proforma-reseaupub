// Exécuté une seule fois à chaque démarrage du serveur Next.js (voir la doc Next.js sur
// `instrumentation.ts`) — sert ici à garantir qu'aucun compte Clerk existant ne se retrouve
// bloqué par le contrôle d'accès par page : voir lib/bootstrapAdminUsers.ts (idempotent, ne
// touche jamais un compte déjà migré).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { bootstrapAdminUsers } = await import("@/lib/bootstrapAdminUsers");
      const { totalCreated, totalSkipped } = await bootstrapAdminUsers();
      console.log(`[bootstrap] Rôles & utilisateurs synchronisés : ${totalCreated} compte(s) créé(s), ${totalSkipped} déjà à jour.`);
    } catch (error) {
      console.error("[bootstrap] Échec de la synchronisation rôles & utilisateurs au démarrage :", error);
    }

    // Tâches planifiées internes (clôture des budgets mensuels, état du soir) — seulement sur le
    // serveur de production : SCHEDULER_ENABLED=true dans son .env, jamais en local (base partagée).
    if (process.env.SCHEDULER_ENABLED === "true" && process.env.NEXT_PHASE !== "phase-production-build") {
      try {
        const { demarrerPlanificateur } = await import("@/lib/taches/planificateur");
        demarrerPlanificateur();
      } catch (error) {
        console.error("[planificateur] Démarrage impossible :", error);
      }
    }
  }
}
