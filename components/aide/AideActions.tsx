'use client';

import { Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Boutons de la page Aide : impression / PDF (impression du navigateur) et fichier source Markdown. */
export function AideActions({ fichier }: { fichier: string }) {
  return (
    <div className="flex gap-2 print:hidden">
      <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
        <Printer className="h-4 w-4" /> Imprimer / PDF
      </Button>
      <Button asChild variant="outline" size="sm" className="gap-2">
        <a href={fichier} download>
          <Download className="h-4 w-4" /> Markdown
        </a>
      </Button>
    </div>
  );
}
