'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { MessageSquare, Send } from 'lucide-react';

export interface BudgetCommentaire {
  id: string;
  ligneId: string;
  auteurEmail: string;
  auteurNom: string | null;
  contenu: string;
  createdAt: string;
}

interface BudgetLigneCommentairesProps {
  demandeId: string;
  ligneId: string;
  commentaires: BudgetCommentaire[];
  /** Admin ou comptable : peut ouvrir un fil sur une ligne vierge. */
  peutOuvrir: boolean;
  /** Peut répondre à un fil déjà ouvert (demandeur, valideurs, comptable). */
  peutRepondre: boolean;
  onAdded: () => void;
}

/**
 * Fil de commentaires d'une ligne de budget. Par défaut rien n'est affiché sur une ligne sans
 * commentaire, sauf le bouton « Commenter » pour l'admin et le comptable ; dès qu'un fil existe,
 * les autres intervenants peuvent y répondre. Le serveur applique la même règle.
 */
export function BudgetLigneCommentaires({ demandeId, ligneId, commentaires, peutOuvrir, peutRepondre, onAdded }: BudgetLigneCommentairesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [contenu, setContenu] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filOuvert = commentaires.length > 0;
  const peutEcrire = filOuvert ? peutRepondre : peutOuvrir;

  if (!filOuvert && !peutOuvrir) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contenu.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/demandes-budget/${demandeId}/commentaires`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ligneId, contenu: contenu.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(typeof err.error === 'string' ? err.error : "Erreur lors de l'envoi du commentaire.");
      }
      setContenu('');
      onAdded();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!filOuvert && !isOpen) {
    return (
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-muted-foreground" onClick={() => setIsOpen(true)}>
        <MessageSquare className="h-3.5 w-3.5" /> Commenter
      </Button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-md border bg-muted/30 p-3">
      {commentaires.map((c) => (
        <div key={c.id} className="text-sm">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{c.auteurNom || c.auteurEmail}</span>
            {' · '}
            {format(new Date(c.createdAt), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
          </p>
          <p className="whitespace-pre-wrap">{c.contenu}</p>
        </div>
      ))}
      {peutEcrire && (
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <Textarea
            rows={2}
            value={contenu}
            onChange={(e) => setContenu(e.target.value)}
            placeholder={filOuvert ? 'Répondre…' : 'Commentaire sur cette ligne…'}
            className="bg-background"
          />
          <Button type="submit" size="icon" disabled={isSubmitting || !contenu.trim()} aria-label="Envoyer">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      )}
    </div>
  );
}
