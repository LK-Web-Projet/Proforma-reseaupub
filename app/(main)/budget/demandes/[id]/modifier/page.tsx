'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next-nprogress-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DemandeBudgetForm, DemandeBudgetInitialData } from '@/components/DemandeBudgetForm';
import { toast } from 'sonner';
import { ArrowLeft, Pencil } from 'lucide-react';

interface DemandeBudgetRaw {
  id: string;
  statut: string;
  type: string;
  periodeMois: string | null;
  requesterEmail: string;
  departement: string | null;
  contexteMotivation: string;
  modePaiement: string;
  pourLeCompteDe: string | null;
  dateLimiteSouhaitee: string | null;
  proformas: { invoice: { id: string } }[];
  lignes: {
    designation: string;
    montant: number;
    categorie: string | null;
    modePaiement: string | null;
    detail: string | null;
    dateLimite: string | null;
  }[];
  attachments: { id: string; kind: string; url: string; fileName: string }[];
}

export default function ModifierDemandeBudgetPage() {
  const [demande, setDemande] = useState<DemandeBudgetRaw | null>(null);
  const [role, setRole] = useState<{ email: string | null; canPay: boolean }>({ email: null, canPay: false });
  const [loading, setLoading] = useState(true);

  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [demandeRes, roleRes] = await Promise.all([
        fetch(`/api/demandes-budget/${id}`),
        fetch('/api/demandes-budget/me-role'),
      ]);
      if (!demandeRes.ok) throw new Error();
      setDemande(await demandeRes.json());
      if (roleRes.ok) setRole(await roleRes.json());
    } catch (error) {
      console.error(error);
      toast.error('Impossible de charger la demande de budget.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-96 bg-gray-200 rounded" />
      </div>
    );
  }

  const isAutorise =
    !!demande && (role.canPay || role.email?.toLowerCase() === demande.requesterEmail.toLowerCase());

  if (!demande || demande.statut !== 'REJETEE' || !isAutorise) {
    return (
      <div className="max-w-6xl mx-auto text-center py-20">
        <p className="text-gray-500 text-lg">
          {!demande
            ? 'Demande introuvable.'
            : demande.statut !== 'REJETEE'
              ? 'Seule une demande rejetée peut être modifiée.'
              : "Vous n'êtes pas autorisé à modifier cette demande."}
        </p>
        <Button variant="outline" className="mt-4" onClick={() => router.push(`/budget/demandes/${id}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour à la demande
        </Button>
      </div>
    );
  }

  const initialData: DemandeBudgetInitialData = {
    type: demande.type,
    periodeMois: demande.periodeMois,
    departement: demande.departement,
    contexteMotivation: demande.contexteMotivation,
    modePaiement: demande.modePaiement,
    pourLeCompteDe: demande.pourLeCompteDe,
    dateLimiteSouhaitee: demande.dateLimiteSouhaitee,
    proformaIds: demande.proformas.map((p) => p.invoice.id),
    lignes: demande.lignes,
    existingAttachments: demande.attachments,
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => router.push(`/budget/demandes/${id}`)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Pencil className="h-6 w-6 text-amber-600" />
            Modifier la demande
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Corrigez les éléments nécessaires puis soumettez à nouveau pour validation.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détails de la demande</CardTitle>
        </CardHeader>
        <CardContent>
          <DemandeBudgetForm
            mode="edit"
            demandeId={id}
            initialData={initialData}
            onSuccess={() => router.push(`/budget/demandes/${id}`)}
            onCancel={() => router.push(`/budget/demandes/${id}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
