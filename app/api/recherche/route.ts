import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { isImpliqueBudget, requireBudgetUser } from "@/lib/budgetAuth";

/**
 * GET /api/recherche?q= — recherche par mot-clé dans les documents classés (procédure de paiement,
 * section 7 : « retrouver en quelques mots-clés n'importe quelle campagne ou n'importe quel paiement »).
 * Plusieurs mots = tous doivent apparaître (ET), sans tenir compte de la casse ; un nombre cherche
 * aussi les montants égaux. Chaque rubrique respecte les droits :
 * - budgets et leurs pièces : rôles du circuit budget, sinon les budgets du demandeur seulement ;
 * - journal de caisse : section « finance » ; prestataires, BC et factures fournisseurs : section
 *   « fournisseurs » ; proformas : section « proforma ».
 */
const LIMITE = 20;
const ci = (contains: string) => ({ contains, mode: "insensitive" as const });

export interface ResultatRecherche {
  titre: string;
  detail: string;
  lien: string;
  fichier?: { url: string; nom: string };
}

export async function GET(request: NextRequest) {
  const caps = await requireBudgetUser();
  if (caps instanceof NextResponse) return caps;

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ q, rubriques: {} });
  }
  const mots = q.split(/\s+/).filter(Boolean).slice(0, 6);
  const nombre = Number(q.replace(/[\s  ]/g, "").replace(",", "."));
  const montant = Number.isFinite(nombre) && nombre > 0 ? nombre : null;

  const user = await prisma.user.findUnique({ where: { id: caps.userId }, include: { role: { include: { pages: true } } } });
  const pages = new Set(user?.active ? user.role.pages.map((p) => p.page) : []);
  const tousLesBudgets = isImpliqueBudget(caps);
  const fmt = (n: unknown) => `${new Intl.NumberFormat("fr-FR").format(Number(n))} F`;
  const dateFr = (d: Date) => d.toLocaleDateString("fr-FR");

  try {
    const rubriques: Record<string, ResultatRecherche[]> = {};

    // ── Budgets ─────────────────────────────────────────────────────────────
    const visibiliteBudget: Prisma.DemandeBudgetWhereInput = tousLesBudgets ? {} : { requesterEmail: { equals: caps.email, mode: "insensitive" } };
    const budgets = await prisma.demandeBudget.findMany({
      where: {
        ...visibiliteBudget,
        OR: [
          {
            AND: mots.map((m) => ({
              OR: [
                { numero: ci(m) },
                { contexteMotivation: ci(m) },
                { pourLeCompteDe: ci(m) },
                { departement: ci(m) },
                { requesterName: ci(m) },
                { lignes: { some: { designation: ci(m) } } },
                { lignes: { some: { departement: { OR: [{ nom: ci(m) }, { code: ci(m) }] } } } },
                { proformas: { some: { invoice: { OR: [{ numero: ci(m) }, { client: { nom: ci(m) } }] } } } },
              ],
            })),
          },
          ...(montant ? [{ montantTotal: montant }, { depenses: { some: { montant } } }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      take: LIMITE,
      select: { id: true, numero: true, statut: true, type: true, montantTotal: true, contexteMotivation: true, createdAt: true },
    });
    rubriques.budgets = budgets.map((b) => ({
      titre: `${b.numero} — ${b.contexteMotivation.slice(0, 80)}`,
      detail: `${b.type.toLowerCase()} · ${b.statut.toLowerCase().replace("_", " ")} · ${fmt(b.montantTotal)} · ${dateFr(b.createdAt)}`,
      lien: `/budget/demandes/${b.id}`,
    }));

    const piecesBudget = await prisma.demandeBudgetAttachment.findMany({
      where: { demandeBudget: visibiliteBudget, AND: mots.map((m) => ({ OR: [{ fileName: ci(m) }, { demandeBudget: { numero: ci(m) } }] })) },
      orderBy: { createdAt: "desc" },
      take: LIMITE,
      select: { fileName: true, url: true, kind: true, demandeBudget: { select: { id: true, numero: true } } },
    });
    rubriques.piecesBudget = piecesBudget.map((p) => ({
      titre: p.fileName,
      detail: `Budget ${p.demandeBudget.numero} · ${p.kind.toLowerCase().replace("_", " ")}`,
      lien: `/budget/demandes/${p.demandeBudget.id}`,
      fichier: { url: p.url, nom: p.fileName },
    }));

    // ── Journal de caisse ───────────────────────────────────────────────────
    if (pages.has("finance")) {
      const ecritures = await prisma.cashJournal.findMany({
        where: {
          OR: [
            { AND: mots.map((m) => ({ OR: [{ libelle: ci(m) }, { attachments: { some: { fileName: ci(m) } } }] })) },
            ...(montant ? [{ montant }] : []),
          ],
        },
        orderBy: { id: "desc" },
        take: LIMITE,
        select: { id: true, libelle: true, type: true, montant: true, date_operation: true, cashRegister: { select: { name: true } }, attachments: { take: 1, select: { url: true, fileName: true } } },
      });
      rubriques.caisse = ecritures.map((e) => ({
        titre: e.libelle,
        detail: `${e.type === "RECETTE" ? "Recette" : "Dépense"} · ${fmt(e.montant)} · ${e.cashRegister.name} · ${dateFr(e.date_operation)} · écriture n° ${e.id}`,
        lien: "/journal-caisse",
        ...(e.attachments[0] ? { fichier: { url: e.attachments[0].url, nom: e.attachments[0].fileName } } : {}),
      }));
    }

    // ── Prestataires, bons de commande, factures fournisseurs ────────────────
    if (pages.has("fournisseurs")) {
      const [commandes, factures, fournisseurs, piecesBc] = await Promise.all([
        prisma.commandeFournisseur.findMany({
          where: {
            OR: [
              { AND: mots.map((m) => ({ OR: [{ numero: ci(m) }, { fournisseur: { entreprise: ci(m) } }, { lignes: { some: { designation: ci(m) } } }] })) },
              ...(montant ? [{ montantNet: montant }] : []),
            ],
          },
          orderBy: { dateCommande: "desc" },
          take: LIMITE,
          select: { id: true, numero: true, statut: true, montantNet: true, fournisseurId: true, fournisseur: { select: { entreprise: true } } },
        }),
        prisma.factureFournisseur.findMany({
          where: {
            OR: [
              { AND: mots.map((m) => ({ OR: [{ reference: ci(m) }, { fournisseur: { entreprise: ci(m) } }] })) },
              ...(montant ? [{ montant }] : []),
            ],
          },
          orderBy: { date: "desc" },
          take: LIMITE,
          select: { reference: true, montant: true, status: true, date: true, pieceJointe: true, fournisseur: { select: { entreprise: true } } },
        }),
        prisma.fournisseur.findMany({
          where: { AND: mots.map((m) => ({ OR: [{ entreprise: ci(m) }, { nom: ci(m) }, { prenom: ci(m) }, { domaineActivite: ci(m) }, { documents: { some: { fileName: ci(m) } } }] })) },
          take: LIMITE,
          select: { id: true, entreprise: true, domaineActivite: true },
        }),
        prisma.commandeFournisseurDocument.findMany({
          where: { AND: mots.map((m) => ({ OR: [{ fileName: ci(m) }, { commande: { numero: ci(m) } }] })) },
          orderBy: { createdAt: "desc" },
          take: LIMITE,
          select: { fileName: true, url: true, commande: { select: { id: true, numero: true, fournisseurId: true } } },
        }),
      ]);
      rubriques.commandes = commandes.map((c) => ({
        titre: `${c.numero} — ${c.fournisseur.entreprise}`,
        detail: `${c.statut.toLowerCase()} · ${fmt(c.montantNet)}`,
        lien: `/fournisseur/${c.fournisseurId}/commandes/${c.id}`,
      }));
      rubriques.piecesCommandes = piecesBc.map((p) => ({
        titre: p.fileName,
        detail: `Bon de commande ${p.commande.numero}`,
        lien: `/fournisseur/${p.commande.fournisseurId}/commandes/${p.commande.id}`,
        fichier: { url: p.url, nom: p.fileName },
      }));
      rubriques.facturesFournisseurs = factures.map((f) => ({
        titre: `Facture ${f.reference} — ${f.fournisseur.entreprise}`,
        detail: `${fmt(f.montant)} · ${f.status.toLowerCase().replace("_", " ")} · ${dateFr(f.date)}`,
        lien: "/fournisseur/factures",
        ...(f.pieceJointe ? { fichier: { url: f.pieceJointe, nom: f.reference } } : {}),
      }));
      rubriques.prestataires = fournisseurs.map((f) => ({ titre: f.entreprise, detail: f.domaineActivite, lien: `/fournisseur/${f.id}` }));
    }

    // ── Proformas ───────────────────────────────────────────────────────────
    if (pages.has("proforma")) {
      const proformas = await prisma.invoice.findMany({
        where: {
          OR: [
            { AND: mots.map((m) => ({ OR: [{ numero: ci(m) }, { objet: ci(m) }, { client: { nom: ci(m) } }] })) },
            ...(montant ? [{ totalTTC: montant }] : []),
          ],
        },
        take: LIMITE,
        select: { id: true, numero: true, objet: true, statut: true, totalTTC: true, client: { select: { nom: true } } },
      });
      rubriques.proformas = proformas.map((p) => ({
        titre: `${p.numero} — ${p.client.nom}`,
        detail: `${p.objet} · ${p.statut} · ${fmt(p.totalTTC)}`,
        lien: `/facture/${p.id}`,
      }));
    }

    return NextResponse.json({ q, rubriques });
  } catch (error) {
    console.error("Erreur de recherche:", error);
    return NextResponse.json({ error: "Erreur interne du serveur" }, { status: 500 });
  }
}
