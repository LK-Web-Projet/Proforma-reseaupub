import { Marked } from "marked";

/**
 * Rendu du guide de la page Aide (public/docs/procedure-paiement-plateforme.md) avec des schémas
 * simples, écrits en texte dans le Markdown (le fichier téléchargé reste lisible) :
 *
 * ```flux
 * titre: Du budget au paiement
 * Chef de projet | Crée le budget | bleu
 * DG | Accorde les lignes | violet
 * ```
 * → étapes numérotées reliées par des flèches (qui → fait quoi).
 *
 * ```choix
 * titre: Où saisir une petite dépense ?
 * question: Le budget est-il lié à une proforma ?
 * Oui | Sur la proforma → Dépense | vert
 * Non | Sur la fiche budget | bleu
 * ```
 * → une question (ou une action) qui mène à plusieurs cas.
 *
 * Chaque ligne : `étiquette | texte | couleur` (couleur facultative : bleu, violet, vert, orange,
 * rouge, ambre, cyan, rose, gris). Le texte accepte le gras Markdown (**…**).
 * Les citations Markdown (`> …`) deviennent des encadrés ; `> ⚠️ …` donne un encadré d'alerte.
 */

const COULEURS = ["bleu", "violet", "vert", "orange", "rouge", "ambre", "cyan", "rose", "gris"] as const;
type Couleur = (typeof COULEURS)[number];

interface Element {
  etiquette: string;
  texte: string;
  couleur: Couleur;
}

interface Bloc {
  titre?: string;
  question?: string;
  elements: Element[];
}

const echapper = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Gras et italique Markdown dans un texte déjà échappé. */
const enLigne = (s: string) =>
  echapper(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");

function lireBloc(source: string, couleurParDefaut: (i: number) => Couleur): Bloc {
  const bloc: Bloc = { elements: [] };
  for (const brute of source.split(/\r?\n/)) {
    const ligne = brute.trim();
    if (!ligne) continue;
    const meta = /^(titre|question)\s*:\s*(.+)$/i.exec(ligne);
    if (meta) {
      bloc[meta[1].toLowerCase() as "titre" | "question"] = meta[2].trim();
      continue;
    }
    const champs = ligne.split("|").map((c) => c.trim());
    const derniere = champs[champs.length - 1]?.toLowerCase();
    const couleur = (COULEURS as readonly string[]).includes(derniere) ? (champs.pop()!.toLowerCase() as Couleur) : couleurParDefaut(bloc.elements.length);
    const [etiquette = "", ...reste] = champs;
    bloc.elements.push({ etiquette, texte: reste.join(" | "), couleur });
  }
  return bloc;
}

const ORDRE: Couleur[] = ["bleu", "violet", "orange", "vert", "cyan", "rose"];

function rendreFlux(source: string): string {
  const { titre, elements } = lireBloc(source, (i) => ORDRE[i % ORDRE.length]);
  // Rangées régulières : jusqu'à 4 étapes sur une ligne, au-delà deux rangées (6 → 3 + 3).
  const colonnes = elements.length <= 4 ? Math.max(elements.length, 1) : Math.ceil(elements.length / 2);
  const etapes = elements
    .map(
      (e, i) => `
      <div class="schema-etape c-${e.couleur}${i === 0 ? " premiere" : ""}${i % colonnes === 0 ? " debut-rangee" : ""}">
        <span class="schema-num">${i + 1}</span>
        ${e.etiquette ? `<span class="schema-acteur">${enLigne(e.etiquette)}</span>` : ""}
        <p>${enLigne(e.texte)}</p>
      </div>`
    )
    .join("");
  return `<figure class="schema schema-flux">${titre ? `<figcaption>${enLigne(titre)}</figcaption>` : ""}<div class="schema-ligne" style="--cols:${colonnes}">${etapes}</div></figure>`;
}

function rendreChoix(source: string): string {
  const { titre, question, elements } = lireBloc(source, (i) => ORDRE[i % ORDRE.length]);
  const options = elements
    .map(
      (e) => `
      <div class="schema-option c-${e.couleur}">
        <span class="schema-fleche-bas" aria-hidden="true">⬇</span>
        ${e.etiquette ? `<span class="schema-acteur">${enLigne(e.etiquette)}</span>` : ""}
        <p>${enLigne(e.texte)}</p>
      </div>`
    )
    .join("");
  return `<figure class="schema schema-choix">${titre ? `<figcaption>${enLigne(titre)}</figcaption>` : ""}${
    question ? `<div class="schema-question">${enLigne(question)}</div>` : ""
  }<div class="schema-options" style="--n:${Math.min(elements.length, 4)}">${options}</div></figure>`;
}

const marked = new Marked({
  renderer: {
    code({ text, lang }) {
      if (lang === "flux") return rendreFlux(text);
      if (lang === "choix") return rendreChoix(text);
      return false;
    },
  },
});

/** Markdown du guide → HTML (schémas, encadrés). Contenu du projet uniquement (pas de saisie utilisateur). */
export async function rendreGuide(source: string): Promise<string> {
  const html = await marked.parse(source);
  // Encadrés : une citation commençant par ⚠️ devient une alerte, les autres des « bon à savoir ».
  return html.replace(/<blockquote>\s*<p>(⚠️|⚠)/g, '<blockquote class="alerte"><p>$1');
}
