'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Suit les actions en cours, ligne par ligne (interrupteur Actif, liste de statut, changement de
 * rôle…) : `lancer(cle, action)` marque la ligne « en cours » jusqu'à la fin de l'action, et
 * `enCours(cle)` sert à désactiver le contrôle et afficher l'indicateur. Un second déclenchement
 * sur une ligne déjà en cours est ignoré.
 */
export function useActionEnCours() {
  // Référence synchrone (anti double clic) + état pour l'affichage.
  const enCoursRef = useRef<Set<string>>(new Set());
  const [, setVersion] = useState(0);

  const enCours = useCallback((cle: string) => enCoursRef.current.has(cle), []);

  const lancer = useCallback(async (cle: string, action: () => Promise<unknown> | unknown) => {
    if (enCoursRef.current.has(cle)) return;
    enCoursRef.current.add(cle);
    setVersion((v) => v + 1);
    try {
      await action();
    } finally {
      enCoursRef.current.delete(cle);
      setVersion((v) => v + 1);
    }
  }, []);

  return { enCours, lancer };
}
