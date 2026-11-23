'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next-nprogress-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DemandeBudgetForm, DemandeBudgetInitialData } from '@/components/DemandeBudgetForm';
import { toast } from 'sonner';
import { ArrowLeft, FilePlus, Repeat } from 'lucide-react';

interface ReconductionData extends Omit<DemandeBudgetInitialData, 'existingAttachments'> {
  sourceNumero: string;
}

function NouvelleDemandeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const depuis = searchParams.get('depuis');
  const [source, setSource] = useState<ReconductionData | null>(null);
  const [loading, setLoading] = useState(!!depuis);

  // Reconduction / duplication : préremplit le formulaire à partir d'un budget existant.
  useEffect(() => {
    if (!depuis) return;
    fetch(`/api/demandes-budget/${depuis}/reconduction`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        setSource(await res.json());
      })
      .catch(() => toast.error('Impossible de reprendre le budget d’origine : formulaire vierge.'))
      .finally(() => setLoading(false));
  }, [depuis]);

  const initialData: DemandeBudgetInitialData | undefined = source ? { ...source, existingAttachments: [] } : undefined;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => router.push('/budget/demandes')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            {source ? <Repeat className="h-6 w-6 text-indigo-700" /> : <FilePlus className="h-6 w-6 text-indigo-700" />}
            {source ? 'Reconduire un budget' : 'Faire une demande de budget'}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {source
              ? `Repris de ${source.sourceNumero} : ajustez les montants (le dépensé réel est rappelé sous chaque ligne), puis soumettez.`
              : 'Décrivez la dépense à effectuer — elle sera transmise pour validation.'}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détails de la demande</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-64 animate-pulse bg-muted rounded" />
          ) : (
            <DemandeBudgetForm
              initialData={initialData}
              onSuccess={() => router.push('/budget/demandes')}
              onCancel={() => router.push('/budget/demandes')}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// useSearchParams impose une frontière Suspense pour le rendu statique (Next.js 15).
export default function NouvelleDemandeBudgetPage() {
  return (
    <Suspense fallback={null}>
      <NouvelleDemandeContent />
    </Suspense>
  );
}
