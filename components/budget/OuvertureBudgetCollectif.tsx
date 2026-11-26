'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Check, FolderOpen, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { InvoiceCombobox, type InvoiceOption } from '@/components/InvoiceCombobox';
import { useDroits } from '@/components/DroitsProvider';
import { cn } from '@/lib/utils';

interface Departement {
  id: string;
  nom: string;
}

const moisLabel = (cle: string) => format(new Date(`${cle}-01T12:00:00`), 'MMMM yyyy', { locale: fr });

/**
 * Ouverture d'un budget collectif (formulaire « Faire une demande ») : mensuel — toujours collectif,
 * ouvert par le comptable, un seul par mois, tous les départements actifs invités par défaut — ou
 * campagne collective (sa proforma, les départements choisis). Le budget s'ouvre « En préparation » :
 * chaque département y saisira ses lignes, puis le comptable le soumettra à la direction.
 */
export function OuvertureBudgetCollectif({
  type,
  periodeMois,
  invoices,
  onOuvert,
}: {
  type: 'MENSUEL' | 'CAMPAGNE';
  periodeMois: string;
  invoices: InvoiceOption[];
  onOuvert: (id: string) => void;
}) {
  const { peut } = useDroits();
  const preparer = peut('budget.preparer');
  const [departements, setDepartements] = useState<Departement[]>([]);
  const [choisis, setChoisis] = useState<string[]>([]);
  const [contexte, setContexte] = useState('');
  const [proformaId, setProformaId] = useState('');
  const [dateLimite, setDateLimite] = useState('');
  const [existant, setExistant] = useState<{ id: string; numero: string; collectif?: boolean } | null | undefined>(undefined);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    fetch('/api/departements?actifs=1')
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Departement[]) => {
        setDepartements(d);
        // Mensuel : tous les départements concernés par défaut ; le comptable retire les autres.
        if (type === 'MENSUEL') setChoisis(d.map((x) => x.id));
      })
      .catch(() => setDepartements([]));
  }, [type]);

  useEffect(() => {
    if (type !== 'MENSUEL' || !periodeMois) return;
    setExistant(undefined);
    fetch(`/api/demandes-budget/collectif?mois=${periodeMois}`)
      .then((r) => (r.ok ? r.json() : { existant: null }))
      .then((d) => setExistant(d.existant ?? null))
      .catch(() => setExistant(null));
  }, [type, periodeMois]);

  const basculer = (id: string) => setChoisis((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const ouvrir = async () => {
    if (!contexte.trim()) return void toast.error('Indiquez le contexte et la motivation du budget.');
    if (type === 'CAMPAGNE' && !proformaId) return void toast.error('Choisissez la proforma de la campagne.');
    if (choisis.length === 0) return void toast.error('Invitez au moins un département.');
    setEnvoi(true);
    try {
      const res = await fetch('/api/demandes-budget/collectif', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          periodeMois: type === 'MENSUEL' ? periodeMois : undefined,
          proformaId: type === 'CAMPAGNE' ? proformaId : undefined,
          contexteMotivation: contexte,
          departementIds: choisis,
          dateLimiteSaisie: dateLimite || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.existant) setExistant(data.existant);
        throw new Error(data.error || "Ouverture impossible.");
      }
      toast.success(`Budget ${data.numero} ouvert en préparation : les départements invités sont prévenus.`);
      onOuvert(data.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur.');
    } finally {
      setEnvoi(false);
    }
  };

  // Ancien budget mensuel (individuel) déjà fait pour ce mois : un seul budget mensuel par mois.
  if (type === 'MENSUEL' && existant && !existant.collectif) {
    return (
      <div className="rounded-lg border bg-slate-50 p-4 space-y-3 text-sm text-slate-700">
        <p>
          Ce mois a déjà un budget mensuel ({existant.numero}), fait avant les budgets collectifs. Il n&apos;y a qu&apos;un budget mensuel par mois :
          choisissez un autre mois, ou faites un budget ponctuel.
        </p>
        <Button asChild variant="outline"><Link href={`/budget/demandes/${existant.id}`}>Voir {existant.numero}</Link></Button>
      </div>
    );
  }
  // Mensuel déjà ouvert pour ce mois : on y ajoute ses lignes (un seul par mois).
  if (type === 'MENSUEL' && existant) {
    return (
      <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 space-y-3">
        <p className="text-sm text-violet-900">
          Le budget mensuel de <strong className="capitalize">{moisLabel(periodeMois)}</strong> est déjà ouvert ({existant.numero}). Chaque département y
          ajoute ses lignes : il n&apos;y a qu&apos;un budget mensuel par mois.
        </p>
        <Button asChild>
          <Link href={`/budget/demandes/${existant.id}`}><FolderOpen className="mr-2 h-4 w-4" /> Ajouter mes lignes à ce budget</Link>
        </Button>
      </div>
    );
  }
  if (type === 'MENSUEL' && existant === undefined) {
    return <p className="text-sm text-muted-foreground">Recherche du budget mensuel de ce mois…</p>;
  }
  if (type === 'MENSUEL' && !preparer) {
    return (
      <div className="flex gap-2 rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Le budget mensuel de <strong className="capitalize">{moisLabel(periodeMois)}</strong> n&apos;est pas encore ouvert. C&apos;est le comptable qui
          l&apos;ouvre ; votre département sera prévenu pour y saisir ses lignes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-lg border p-4">
      <div className="flex gap-2 rounded-md bg-violet-50 p-3 text-xs text-violet-900">
        <Info className="h-4 w-4 shrink-0" />
        <p>
          Le budget s&apos;ouvre <strong>en préparation</strong> : chaque département invité y saisit ses lignes et ne voit que les siennes. Le comptable
          vérifie l&apos;ensemble, puis le <strong>soumet à la direction</strong>.
        </p>
      </div>

      {type === 'CAMPAGNE' && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Proforma de la campagne *</label>
          <InvoiceCombobox invoices={invoices} value={proformaId} onChange={setProformaId} placeholder="Choisir la proforma de la campagne" />
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">Contexte et motivation *</label>
        <Textarea value={contexte} onChange={(e) => setContexte(e.target.value)} rows={3} />
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-sm font-medium">Départements invités * ({choisis.length})</label>
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setChoisis(departements.map((d) => d.id))}>Tous</Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setChoisis([])}>Aucun</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {departements.map((d) => {
            const coche = choisis.includes(d.id);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => basculer(d.id)}
                className={cn('flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm', coche ? 'border-primary bg-primary/5' : 'hover:bg-muted/50')}
              >
                <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', coche ? 'border-primary bg-primary text-primary-foreground' : 'border-input')}>
                  {coche && <Check className="h-3 w-3" />}
                </span>
                <span className="truncate">{d.nom}</span>
              </button>
            );
          })}
        </div>
        {type === 'MENSUEL' && <p className="text-xs text-muted-foreground">Tous les départements sont concernés par défaut : retirez ceux qui ne le sont pas.</p>}
      </div>

      <div className="space-y-2">
        <label htmlFor="date-limite-saisie" className="text-sm font-medium">Date limite de saisie (facultatif)</label>
        <Input id="date-limite-saisie" type="date" className="max-w-[200px]" value={dateLimite} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDateLimite(e.target.value)} />
        <p className="text-xs text-muted-foreground">Après cette date, seuls le responsable et le comptable peuvent encore saisir ; un rappel part la veille.</p>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={ouvrir} loading={envoi} disabled={envoi}>
          <FolderOpen className="mr-2 h-4 w-4" /> Ouvrir en préparation
        </Button>
      </div>
    </div>
  );
}
