'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { aLeDroit, type DroitsUtilisateur } from '@/lib/permissions';

interface DroitsContexte {
  /** Droits chargés (null pendant le chargement ou si non connecté). */
  droits: DroitsUtilisateur | null;
  charge: boolean;
  /** Vrai si l'utilisateur a le droit (faux tant que les droits ne sont pas chargés). */
  peut: (key: string) => boolean;
  recharger: () => void;
}

const Contexte = createContext<DroitsContexte>({ droits: null, charge: false, peut: () => false, recharger: () => {} });

/**
 * Charge une fois les droits de l'utilisateur (GET /api/me/droits) pour masquer à l'écran les
 * boutons non autorisés. Purement visuel : chaque route vérifie elle-même le droit.
 */
export function DroitsProvider({ children }: { children: React.ReactNode }) {
  const [droits, setDroits] = useState<DroitsUtilisateur | null>(null);
  const [charge, setCharge] = useState(false);

  const recharger = useCallback(() => {
    fetch('/api/me/droits')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => setDroits(d))
      .catch(() => setDroits(null))
      .finally(() => setCharge(true));
  }, []);

  useEffect(() => {
    recharger();
  }, [recharger]);

  const valeur = useMemo<DroitsContexte>(
    () => ({ droits, charge, peut: (key: string) => aLeDroit(droits, key), recharger }),
    [droits, charge, recharger]
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useDroits(): DroitsContexte {
  return useContext(Contexte);
}

/** Affiche `children` seulement si l'utilisateur a le droit `cle` (sinon `sinon`, ou rien). */
export function SiDroit({ cle, children, sinon = null }: { cle: string; children: React.ReactNode; sinon?: React.ReactNode }) {
  const { peut } = useDroits();
  return <>{peut(cle) ? children : sinon}</>;
}
