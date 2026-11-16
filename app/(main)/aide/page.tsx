import { readFile } from "fs/promises";
import path from "path";
import { marked } from "marked";
import { BookOpen } from "lucide-react";
import { AideActions } from "@/components/aide/AideActions";

// Guide des processus pour les équipes. Source : public/docs/procedure-paiement-plateforme.md
// (modifiable dans le projet ; servi aussi en téléchargement, connexion obligatoire — middleware).
export const dynamic = "force-dynamic";

const FICHIER = "/docs/procedure-paiement-plateforme.md";

const slug = (t: string) =>
  t
    .replace(/<[^>]+>/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export default async function AidePage() {
  const source = await readFile(path.join(process.cwd(), "public", FICHIER), "utf8");
  // Contenu du projet (pas de saisie utilisateur) : le HTML produit est sûr à afficher.
  const html = (await marked.parse(source)).replace(/<h2>(.*?)<\/h2>/g, (_m, t: string) => `<h2 id="${slug(t)}">${t}</h2>`);
  const sommaire = Array.from(html.matchAll(/<h2 id="([^"]+)">(.*?)<\/h2>/g)).map((m) => ({ id: m[1], titre: m[2].replace(/<[^>]+>/g, "") }));

  return (
    <div className="max-w-4xl mx-auto space-y-6 aide-page">
      <div className="flex items-start justify-between gap-4 flex-wrap print:hidden">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-primary" /> Aide — processus de dépense
        </h1>
        <AideActions fichier={FICHIER} />
      </div>

      <nav className="rounded-lg border bg-muted/30 p-4 print:hidden">
        <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Sommaire</p>
        <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {sommaire.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-primary hover:underline">{s.titre}</a>
            </li>
          ))}
        </ol>
      </nav>

      <article className="doc-aide" dangerouslySetInnerHTML={{ __html: html }} />

      <style>{`
        .doc-aide { font-size: 0.95rem; line-height: 1.65; color: #1f2937; }
        .doc-aide h1 { font-size: 1.6rem; font-weight: 800; margin: 0 0 .5rem; }
        .doc-aide h2 { font-size: 1.25rem; font-weight: 700; margin: 2rem 0 .75rem; padding-top: .5rem; border-top: 1px solid #e5e7eb; scroll-margin-top: 1rem; }
        .doc-aide h3 { font-size: 1.05rem; font-weight: 700; margin: 1.25rem 0 .5rem; }
        .doc-aide p { margin: .6rem 0; }
        .doc-aide ul, .doc-aide ol { margin: .5rem 0 .5rem 1.4rem; }
        .doc-aide ul { list-style: disc; } .doc-aide ol { list-style: decimal; }
        .doc-aide li { margin: .25rem 0; }
        .doc-aide table { width: 100%; border-collapse: collapse; margin: .75rem 0; font-size: .85rem; }
        .doc-aide th, .doc-aide td { border: 1px solid #e5e7eb; padding: .45rem .6rem; text-align: left; vertical-align: top; }
        .doc-aide th { background: #f8fafc; font-weight: 600; }
        .doc-aide code { background: #f1f5f9; padding: .1rem .3rem; border-radius: .25rem; font-size: .85em; }
        .doc-aide pre { background: #0f172a; color: #e2e8f0; padding: 1rem; border-radius: .5rem; overflow-x: auto; font-size: .8rem; line-height: 1.5; }
        .doc-aide pre code { background: transparent; padding: 0; color: inherit; }
        .doc-aide hr { margin: 1.5rem 0; border-color: #e5e7eb; }
        .doc-aide em { color: #4b5563; }
        @media print {
          [data-sidebar], [data-slot="sidebar"], .print\:hidden { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; }
          .doc-aide h2 { break-after: avoid; }
          .doc-aide table, .doc-aide pre { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
