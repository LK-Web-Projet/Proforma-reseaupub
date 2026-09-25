'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DemandeBudgetForm } from '@/components/DemandeBudgetForm';
import { ArrowLeft, FilePlus } from 'lucide-react';

export default function NouvelleDemandeBudgetPage() {
  const router = useRouter();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => router.push('/budget/demandes')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <FilePlus className="h-6 w-6 text-indigo-700" />
            Faire une demande de budget
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Décrivez la dépense à effectuer — elle sera transmise pour validation.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détails de la demande</CardTitle>
        </CardHeader>
        <CardContent>
          <DemandeBudgetForm
            onSuccess={() => router.push('/budget/demandes')}
            onCancel={() => router.push('/budget/demandes')}
          />
        </CardContent>
      </Card>
    </div>
  );
}
