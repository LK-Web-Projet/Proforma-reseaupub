// Exécuté une seule fois à chaque démarrage du serveur Next.js (voir la doc Next.js sur
// `instrumentation.ts`) — sert ici à garantir qu'aucun compte Clerk existant ne se retrouve
// bloqué par le contrôle d'accès par page : voir lib/bootstrapAdminUsers.ts (idempotent, ne
// touche jamais un compte déjà migré).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { bootstrapAdminUsers } = await import("@/lib/bootstrapAdminUsers");
    try {
      const { totalCreated, totalSkipped } = await bootstrapAdminUsers();
      console.log(`[bootstrap] Rôles & utilisateurs synchronisés : ${totalCreated} compte(s) créé(s), ${totalSkipped} déjà à jour.`);
    } catch (error) {
      console.error("[bootstrap] Échec de la synchronisation rôles & utilisateurs au démarrage :", error);
    }
  }
}
