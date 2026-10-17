// app/page.tsx
//
// Ce composant ne devrait normalement jamais s'exécuter : le middleware (voir middleware.ts)
// intercepte "/" en tout premier et effectue une redirection HTTP directe vers /sign-in ou
// vers la bonne section selon le rôle. Ça évite un bug connu de React (facebook/react#33580 /
// vercel/next.js#63121, non corrigé sur Next 15.4.x / React 19.1.0) où un `redirect()` appelé
// ici, dans un Server Component, juste après un `await currentUser()`, pouvait faire planter
// le Router interne de Next.js ("Rendered more hooks than during the previous render").
//
// Ce fallback reste volontairement minimal (pas de redirect() après un await) pour ne pas
// réintroduire ce même chemin de code bogué si jamais cette page était atteinte directement.
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/sign-in");
}
