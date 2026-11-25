'use client';

import { useCallback, useEffect, useState } from 'react';
import { caissesProposees, libelleMoyen, type CaisseLiee, type MoyenPaiementOption } from '@/lib/moyensPaiement';

// Liste partagée par tous les écrans ouverts, rechargée au plus toutes les 30 secondes (et tout de
// suite après une modification faite depuis la page Moyens de paiement).
const DUREE_CACHE_MS = 30_000;
let cache: { promesse: Promise<MoyenPaiementOption[]>; date: number } | null = null;

function chargerMoyens(): Promise<MoyenPaiementOption[]> {
  if (!cache || Date.now() - cache.date > DUREE_CACHE_MS) {
    const promesse = fetch('/api/moyens-paiement')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .catch(() => {
        cache = null;
        return [] as MoyenPaiementOption[];
      });
    cache = { promesse, date: Date.now() };
  }
  return cache.promesse;
}

/** Oublie la liste en mémoire (après une création ou une modification de moyen). */
export function oublierMoyensPaiement() {
  cache = null;
}

/**
 * Moyens de paiement (Finance → Moyens de paiement) pour les écrans : la liste, le nom d'un code,
 * et les caisses proposées pour un moyen (visibles et liées ; aucune si le moyen n'a pas de caisse).
 */
export function useMoyensPaiement() {
  const [moyens, setMoyens] = useState<MoyenPaiementOption[]>([]);
  const [charge, setCharge] = useState(false);

  useEffect(() => {
    let actif = true;
    chargerMoyens().then((liste) => {
      if (!actif) return;
      setMoyens(liste);
      setCharge(true);
    });
    return () => {
      actif = false;
    };
  }, []);

  const libelle = useCallback((code: string | null | undefined) => libelleMoyen(code, moyens), [moyens]);
  const caisses = useCallback((code: string | null | undefined): CaisseLiee[] => caissesProposees(moyens, code), [moyens]);

  return { moyens, charge, libelle, caisses };
}
