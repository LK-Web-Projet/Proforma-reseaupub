'use client';

import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/** Zone de texte d'une ligne qui grandit avec son contenu (le texte passe à la ligne, jamais de défilement). */
export function ChampAutoHauteur({ className, ...props }: React.ComponentProps<typeof Textarea>) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const ajuster = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, []);
  React.useLayoutEffect(ajuster, [props.value, ajuster]);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // La largeur change (fenêtre, passage en 2 colonnes) : la hauteur nécessaire aussi.
    const observateur = new ResizeObserver(ajuster);
    observateur.observe(el);
    return () => observateur.disconnect();
  }, [ajuster]);
  return <Textarea ref={ref} rows={1} {...props} className={cn('min-h-9 resize-none overflow-hidden py-1.5 leading-snug', className)} />;
}
