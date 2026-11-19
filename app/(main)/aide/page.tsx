import { readFile } from "fs/promises";
import path from "path";
import { BookOpen } from "lucide-react";
import { AideActions } from "@/components/aide/AideActions";
import { rendreGuide } from "@/lib/aideSchemas";

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
  // Contenu du projet (pas de saisie utilisateur) : le HTML produit est sûr à afficher. Les blocs
  // ```flux et ```choix deviennent des schémas (lib/aideSchemas.ts).
  const html = (await rendreGuide(source)).replace(/<h2>(.*?)<\/h2>/g, (_m, t: string) => `<h2 id="${slug(t)}">${t}</h2>`);
  const sommaire = Array.from(html.matchAll(/<h2 id="([^"]+)">(.*?)<\/h2>/g)).map((m) => ({ id: m[1], titre: m[2].replace(/<[^>]+>/g, "") }));

  return (
    <div className="max-w-4xl mx-auto space-y-6 aide-page">
      <div className="flex items-start justify-between gap-4 flex-wrap print:hidden">
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <BookOpen className="h-6 w-6 text-primary" /> Aide — processus de dépense
        </h1>
        <AideActions fichier={FICHIER} />
      </div>

      <nav className="aide-sommaire rounded-xl border p-4 print:hidden">
        <p className="text-xs font-semibold uppercase text-indigo-700 mb-3">Sommaire</p>
        <ol className="grid sm:grid-cols-2 gap-2 text-sm">
          {sommaire.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="aide-sommaire-lien">
                <span className="aide-sommaire-num">{i + 1}</span>
                <span>{s.titre}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <article className="doc-aide" dangerouslySetInnerHTML={{ __html: html }} />

      <style>{`
        /* Palette des schémas et des sections */
        .c-bleu   { --c: #2563eb; --bg: #eff6ff; --bd: #bfdbfe; }
        .c-violet { --c: #7c3aed; --bg: #f5f3ff; --bd: #ddd6fe; }
        .c-vert   { --c: #059669; --bg: #ecfdf5; --bd: #a7f3d0; }
        .c-orange { --c: #ea580c; --bg: #fff7ed; --bd: #fed7aa; }
        .c-rouge  { --c: #dc2626; --bg: #fef2f2; --bd: #fecaca; }
        .c-ambre  { --c: #b45309; --bg: #fffbeb; --bd: #fde68a; }
        .c-cyan   { --c: #0891b2; --bg: #ecfeff; --bd: #a5f3fc; }
        .c-rose   { --c: #db2777; --bg: #fdf2f8; --bd: #fbcfe8; }
        .c-gris   { --c: #475569; --bg: #f8fafc; --bd: #e2e8f0; }

        .aide-sommaire { background: linear-gradient(135deg, #eef2ff 0%, #ecfeff 100%); border-color: #c7d2fe; }
        .aide-sommaire-lien { display: flex; align-items: center; gap: .6rem; padding: .35rem .5rem; border-radius: .5rem; color: #3730a3; }
        .aide-sommaire-lien:hover { background: rgba(255,255,255,.7); }
        .aide-sommaire-num { flex-shrink: 0; width: 1.5rem; height: 1.5rem; border-radius: 999px; background: #4f46e5; color: #fff; font-size: .7rem; font-weight: 700; display: flex; align-items: center; justify-content: center; }

        .doc-aide { font-size: 0.95rem; line-height: 1.7; color: #1f2937; }
        .doc-aide h1 { font-size: 1.75rem; font-weight: 800; margin: 0 0 .5rem; background: linear-gradient(90deg, #4f46e5, #0891b2); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .doc-aide h2 { --c: #4f46e5; --bg: #eef2ff; font-size: 1.25rem; font-weight: 700; margin: 2.25rem 0 .9rem; padding: .6rem .9rem; border-left: 5px solid var(--c); border-radius: .6rem; background: linear-gradient(90deg, var(--bg), transparent 85%); color: #111827; scroll-margin-top: 1rem; }
        .doc-aide h2:nth-of-type(6n+2) { --c: #0891b2; --bg: #ecfeff; }
        .doc-aide h2:nth-of-type(6n+3) { --c: #059669; --bg: #ecfdf5; }
        .doc-aide h2:nth-of-type(6n+4) { --c: #ea580c; --bg: #fff7ed; }
        .doc-aide h2:nth-of-type(6n+5) { --c: #7c3aed; --bg: #f5f3ff; }
        .doc-aide h2:nth-of-type(6n+6) { --c: #db2777; --bg: #fdf2f8; }
        .doc-aide h3 { font-size: 1.05rem; font-weight: 700; margin: 1.4rem 0 .5rem; color: #3730a3; display: flex; align-items: center; gap: .5rem; }
        .doc-aide h3::before { content: ""; width: .55rem; height: .55rem; border-radius: 999px; background: #6366f1; flex-shrink: 0; }
        .doc-aide p { margin: .6rem 0; }
        .doc-aide ul, .doc-aide ol { margin: .5rem 0 .5rem 1.4rem; }
        .doc-aide ul { list-style: disc; } .doc-aide ol { list-style: decimal; }
        .doc-aide li { margin: .3rem 0; }
        .doc-aide li::marker { color: #6366f1; font-weight: 700; }
        .doc-aide strong { color: #111827; }
        .doc-aide table { width: 100%; border-collapse: separate; border-spacing: 0; margin: .9rem 0; font-size: .85rem; border: 1px solid #e0e7ff; border-radius: .6rem; overflow: hidden; }
        .doc-aide th, .doc-aide td { border-bottom: 1px solid #eef2ff; padding: .55rem .7rem; text-align: left; vertical-align: top; }
        .doc-aide th { background: #eef2ff; color: #3730a3; font-weight: 700; }
        .doc-aide tr:nth-child(even) td { background: #f8fafc; }
        .doc-aide tr:last-child td { border-bottom: none; }
        .doc-aide code { background: #eef2ff; color: #3730a3; padding: .1rem .35rem; border-radius: .3rem; font-size: .85em; }
        .doc-aide pre { background: #0f172a; color: #e2e8f0; padding: 1rem; border-radius: .6rem; overflow-x: auto; font-size: .8rem; line-height: 1.5; }
        .doc-aide pre code { background: transparent; padding: 0; color: inherit; }
        .doc-aide hr { margin: 2rem 0; border: none; height: 2px; background: linear-gradient(90deg, transparent, #c7d2fe, transparent); }
        .doc-aide em { color: #4b5563; }
        .doc-aide blockquote { margin: 1rem 0; padding: .75rem 1rem .75rem 2.6rem; border-radius: .6rem; background: #eff6ff; border: 1px solid #bfdbfe; color: #1e3a8a; position: relative; }
        .doc-aide blockquote::before { content: "💡"; position: absolute; left: .8rem; top: .7rem; }
        .doc-aide blockquote p { margin: .2rem 0; }
        .doc-aide blockquote.alerte { background: #fffbeb; border-color: #fde68a; color: #78350f; padding-left: 1rem; }
        .doc-aide blockquote.alerte::before { content: none; }

        /* Schémas (blocs flux / choix du Markdown) */
        .schema { margin: 1.25rem 0; padding: 1rem; border-radius: .9rem; background: #fff; border: 1px solid #e5e7eb; box-shadow: 0 1px 2px rgba(15,23,42,.04), 0 6px 16px -8px rgba(15,23,42,.12); }
        .schema figcaption { font-weight: 700; font-size: .9rem; color: #334155; margin-bottom: .8rem; display: flex; align-items: center; gap: .5rem; }
        .schema figcaption::before { content: "🧭"; }
        .schema p { margin: 0; font-size: .83rem; line-height: 1.45; color: #1f2937; }
        .schema-acteur { display: inline-block; font-size: .68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; color: #fff; background: var(--c); padding: .15rem .5rem; border-radius: 999px; margin-bottom: .4rem; }

        /* Étapes en grille régulière ; la flèche ➜ est dessinée dans l'espace entre deux cartes. */
        .schema-ligne { display: grid; grid-template-columns: repeat(var(--cols, 4), minmax(0, 1fr)); column-gap: 1.9rem; row-gap: 1.5rem; padding-top: .4rem; }
        .schema-etape { position: relative; padding: .75rem .75rem .75rem .9rem; border-radius: .7rem; background: var(--bg); border: 1px solid var(--bd); border-top: 4px solid var(--c); }
        .schema-etape:not(.debut-rangee)::before { content: "➜"; position: absolute; left: -1.55rem; top: 50%; transform: translateY(-50%); color: #94a3b8; font-size: 1.1rem; font-weight: 700; }
        .schema-num { position: absolute; top: -.75rem; right: .6rem; width: 1.5rem; height: 1.5rem; border-radius: 999px; background: var(--c); color: #fff; font-size: .72rem; font-weight: 700; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 3px #fff; }

        .schema-question { margin: 0 auto .5rem; max-width: 34rem; text-align: center; font-weight: 700; font-size: .9rem; padding: .7rem 1rem; border-radius: .7rem; color: #fff; background: linear-gradient(90deg, #4f46e5, #0891b2); }
        .schema-options { display: grid; grid-template-columns: repeat(var(--n, 2), minmax(0, 1fr)); gap: .6rem; }
        .schema-option { padding: 1.4rem .8rem .8rem; position: relative; border-radius: .7rem; background: var(--bg); border: 1px solid var(--bd); border-top: 4px solid var(--c); }
        .schema-fleche-bas { position: absolute; top: -.2rem; left: 50%; transform: translate(-50%, -60%); color: var(--c); font-size: 1rem; line-height: 1; background: #fff; border-radius: 999px; padding: 0 .2rem; }

        @media (max-width: 640px) {
          /* Téléphone : une étape par ligne, flèche ⬇ au-dessus de chaque étape suivante. */
          .schema-ligne { grid-template-columns: 1fr; row-gap: 1.9rem; }
          .schema-etape:not(.premiere)::before { content: "⬇"; position: absolute; left: 50%; top: -1.6rem; transform: translateX(-50%); color: #64748b; font-size: 1.05rem; font-weight: 700; }
          .schema-options { grid-template-columns: 1fr; }
        }
        @media print {
          [data-sidebar], [data-slot="sidebar"], .print\:hidden { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; }
          .doc-aide, .schema, .doc-aide h2, .doc-aide th, .doc-aide blockquote { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .doc-aide h2 { break-after: avoid; }
          .doc-aide table, .doc-aide pre, .schema { break-inside: avoid; }
          .schema { box-shadow: none; }
        }
      `}</style>
    </div>
  );
}
