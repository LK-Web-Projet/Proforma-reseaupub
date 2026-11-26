'use client';

import { useState } from 'react';
import { Building2, Check, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Indicateur } from '@/components/ui/indicateur';
import { cn } from '@/lib/utils';

export interface DepartementOption {
  id: string;
  nom: string;
  actif: boolean;
}

/**
 * Départements d'un compte (Paramètres → Utilisateurs) : dans un budget collectif, la personne saisit
 * et voit les lignes de ces départements. Chaque case cochée est enregistrée tout de suite.
 */
export function DepartementsUtilisateur({
  userId,
  valeur,
  departements,
  onChange,
}: {
  userId: string;
  valeur: string[];
  departements: DepartementOption[];
  onChange: (ids: string[]) => void;
}) {
  const [envoi, setEnvoi] = useState(false);
  const noms = departements.filter((d) => valeur.includes(d.id)).map((d) => d.nom);

  const basculer = async (id: string) => {
    const ids = valeur.includes(id) ? valeur.filter((x) => x !== id) : [...valeur, id];
    setEnvoi(true);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departementIds: ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Enregistrement impossible.');
      onChange(ids);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 max-w-[14rem] justify-between gap-1 font-normal">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{noms.length === 0 ? 'Aucun' : noms.join(', ')}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
          Budgets collectifs : la personne saisit et voit les lignes de ces départements.
        </p>
        <div className="max-h-72 overflow-y-auto">
          {departements.map((d) => {
            const coche = valeur.includes(d.id);
            return (
              <button
                key={d.id}
                type="button"
                disabled={envoi || (!d.actif && !coche)}
                onClick={() => void basculer(d.id)}
                className={cn('flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50', coche && 'font-medium')}
              >
                <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border', coche ? 'border-primary bg-primary text-primary-foreground' : 'border-input')}>
                  {coche && <Check className="h-3 w-3" />}
                </span>
                <span className="truncate">{d.nom}</span>
                {!d.actif && <span className="ml-auto text-[10px] text-muted-foreground">désactivé</span>}
              </button>
            );
          })}
        </div>
        {envoi && <div className="px-2 py-1"><Indicateur label="Enregistrement…" /></div>}
      </PopoverContent>
    </Popover>
  );
}
