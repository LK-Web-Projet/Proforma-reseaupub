'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AttachmentPreviewButton } from '@/components/AttachmentPreviewButton';

interface Resultat {
  titre: string;
  detail: string;
  lien: string;
  fichier?: { url: string; nom: string };
}

const RUBRIQUES: { cle: string; titre: string }[] = [
  { cle: 'budgets', titre: 'Budgets' },
  { cle: 'piecesBudget', titre: 'Pièces des budgets (justificatifs, budgets signés…)' },
  { cle: 'commandes', titre: 'Bons de commande' },
  { cle: 'piecesCommandes', titre: 'Pièces des bons de commande (liasse)' },
  { cle: 'facturesFournisseurs', titre: 'Factures fournisseurs' },
  { cle: 'prestataires', titre: 'Prestataires' },
  { cle: 'caisse', titre: 'Journal de caisse' },
  { cle: 'proformas', titre: 'Proformas' },
];

/**
 * Recherche par mot-clé dans tous les documents classés (procédure de paiement, section 7) :
 * numéro, client, campagne, prestataire, désignation, nom de fichier, ou montant. Chaque rubrique
 * n'affiche que ce que les droits de l'utilisateur lui permettent de voir.
 */
export default function RecherchePage() {
  return (
    <Suspense fallback={null}>
      <RechercheContenu />
    </Suspense>
  );
}

function RechercheContenu() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [rubriques, setRubriques] = useState<Record<string, Resultat[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const texte = q.trim();
    const timer = setTimeout(async () => {
      router.replace(texte ? `/recherche?q=${encodeURIComponent(texte)}` : '/recherche', { scroll: false });
      if (texte.length < 2) {
        setRubriques({});
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/recherche?q=${encodeURIComponent(texte)}`);
        if (res.ok) setRubriques((await res.json()).rubriques ?? {});
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [q, router]);

  const total = Object.values(rubriques).reduce((s, l) => s + l.length, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Search className="h-6 w-6 text-primary" /> Recherche
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Numéro de budget, de proforma ou de bon de commande, client, campagne, prestataire, nom de fichier ou montant.
        </p>
      </div>

      <Input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Ex. : BIIC état de paiement, DB-2026-0012, 350000…"
        className="h-11 text-base"
      />

      {q.trim().length >= 2 && !loading && total === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Aucun résultat pour « {q.trim()} ».</p>
      )}
      {loading && <p className="text-sm text-muted-foreground">Recherche…</p>}

      {RUBRIQUES.filter((r) => (rubriques[r.cle]?.length ?? 0) > 0).map((r) => (
        <Card key={r.cle}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {r.titre} <span className="text-muted-foreground font-normal">({rubriques[r.cle].length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {rubriques[r.cle].map((res, i) => (
              <div key={i} className="flex items-center gap-3 px-6 py-2.5 border-t hover:bg-muted/40">
                {res.fichier && <FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
                <Link href={res.lien} className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{res.titre}</p>
                  <p className="text-xs text-muted-foreground truncate">{res.detail}</p>
                </Link>
                {res.fichier && <AttachmentPreviewButton url={res.fichier.url} title={res.fichier.nom} />}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
