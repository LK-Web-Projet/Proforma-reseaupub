'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowRightLeft, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RattachementDepartementDialog } from '@/components/departements/RattachementDepartementDialog';
import { useDroits } from '@/components/DroitsProvider';
import { COULEURS_POSTE, isPosteDepartement, libellePoste, peutAvoirDepartement } from '@/lib/departements';
import { cn } from '@/lib/utils';

export interface HistoriqueDepartementEntree {
  id: string;
  dateEffet: string;
  motif: string | null;
  auteurNom: string | null;
  auteurEmail: string | null;
  ancienPoste: string | null;
  nouveauPoste: string | null;
  ancienDepartement: { nom: string } | null;
  nouveauDepartement: { nom: string } | null;
}

/**
 * Fiche prestataire : son département et son poste, le bouton pour les changer et l'historique de
 * ses rattachements. Un « Fournisseur » n'a pas de département (rien n'est affiché).
 */
export function PrestataireDepartementCard({
  prestataire,
  onChange,
}: {
  prestataire: {
    id: string;
    entreprise: string;
    typeFournisseur: string | null;
    posteDepartement: string | null;
    departement: { id: string; nom: string; code: string | null; actif: boolean } | null;
    departementHistorique: HistoriqueDepartementEntree[];
  };
  onChange: () => void;
}) {
  const { peut } = useDroits();
  const [ouvert, setOuvert] = useState(false);
  if (!peutAvoirDepartement(prestataire.typeFournisseur)) return null;

  const { departement, departementHistorique: historique } = prestataire;

  return (
    <div className="rounded-md border bg-white mb-8">
      <RattachementDepartementDialog
        open={ouvert}
        prestataire={{ id: prestataire.id, nom: prestataire.entreprise, departementId: departement?.id ?? null, posteDepartement: prestataire.posteDepartement }}
        onClose={() => setOuvert(false)}
        onSuccess={onChange}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Building2 className="h-4 w-4 text-indigo-700" />
          <span className="font-medium">Département :</span>
          {departement ? (
            <>
              <Link href={`/fournisseur/departements/${departement.id}`} className="font-semibold hover:underline">
                {departement.nom}
              </Link>
              <Badge variant="outline" className={cn('font-normal', isPosteDepartement(prestataire.posteDepartement) && COULEURS_POSTE[prestataire.posteDepartement])}>
                {libellePoste(prestataire.posteDepartement)}
              </Badge>
              {!departement.actif && <span className="text-xs text-muted-foreground">(département désactivé)</span>}
            </>
          ) : (
            <span className="text-muted-foreground">aucun</span>
          )}
        </div>
        {peut('fournisseurs.affecterDepartement') && (
          <Button size="sm" variant="outline" onClick={() => setOuvert(true)}>
            <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
            {departement ? 'Changer de département ou de poste' : 'Rattacher à un département'}
          </Button>
        )}
      </div>
      {historique.length > 0 && (
        <ul className="max-h-48 overflow-y-auto p-4 space-y-2 text-sm">
          {historique.map((h) => (
            <li key={h.id} className="flex flex-col sm:flex-row sm:justify-between gap-0.5">
              <div className="min-w-0">
                {h.nouveauDepartement ? (
                  h.ancienDepartement?.nom === h.nouveauDepartement.nom ? (
                    <span>
                      Poste : {libellePoste(h.ancienPoste)} → <strong>{libellePoste(h.nouveauPoste)}</strong>
                    </span>
                  ) : (
                    <span>
                      {h.ancienDepartement ? `${h.ancienDepartement.nom} → ` : 'Rattaché à '}
                      <strong>{h.nouveauDepartement.nom}</strong> ({libellePoste(h.nouveauPoste).toLowerCase()})
                    </span>
                  )
                ) : (
                  <span>
                    Retiré de <strong>{h.ancienDepartement?.nom ?? 'son département'}</strong>
                  </span>
                )}
                {h.motif && <span className="text-muted-foreground italic"> — {h.motif}</span>}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {format(new Date(h.dateEffet), 'dd/MM/yyyy')}
                {h.auteurNom || h.auteurEmail ? ` · ${h.auteurNom ?? h.auteurEmail}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
