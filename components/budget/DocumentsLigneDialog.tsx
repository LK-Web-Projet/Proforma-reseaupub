'use client';

import { useEffect, useRef, useState } from 'react';
import { Paperclip, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AttachmentPreviewButton } from '@/components/AttachmentPreviewButton';
import { ATTACHMENT_TYPE_COLORS, ATTACHMENT_TYPE_LABELS, DOCUMENTS_LIGNE_TYPES, type DocumentLigneType } from '@/lib/demandeBudgetAttachmentTypes';
import { cn } from '@/lib/utils';

export interface DocumentLigne {
  id: string;
  kind: string;
  url: string;
  fileName: string;
  ligneId?: string | null;
  ajouteParNom?: string | null;
  ajouteParEmail?: string | null;
}

const TAILLE_MAX = 10 * 1024 * 1024;

/**
 * Documents qui justifient une ligne d'un budget collectif (devis du fournisseur, facture, autre) :
 * liste avec aperçu ; si `modifiable`, envoi de nouveaux fichiers et retrait. Jamais obligatoires.
 */
export function DocumentsLigneDialog({
  budgetId,
  ligne,
  documents,
  modifiable,
  open,
  onClose,
  onFait,
}: {
  budgetId: string;
  ligne: { id: string; designation: string } | null;
  documents: DocumentLigne[];
  modifiable: boolean;
  open: boolean;
  onClose: () => void;
  onFait: () => void;
}) {
  const [kind, setKind] = useState<DocumentLigneType>('DEVIS');
  const [precision, setPrecision] = useState('');
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const champFichier = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setKind('DEVIS');
    setPrecision('');
    setFichiers([]);
  }, [open, ligne?.id]);

  const choisir = (liste: FileList | null) => {
    const tous = Array.from(liste ?? []);
    const tropGros = tous.find((f) => f.size > TAILLE_MAX);
    if (tropGros) {
      toast.error(`Le fichier « ${tropGros.name} » dépasse 10 Mo.`);
      if (champFichier.current) champFichier.current.value = '';
      return;
    }
    setFichiers(tous);
  };

  const envoyer = async () => {
    if (!ligne) return;
    if (fichiers.length === 0) return void toast.error('Choisissez au moins un fichier.');
    if (kind === 'DEVIS' && !precision.trim()) return void toast.error('Indiquez le fournisseur de cette proforma.');
    setEnvoi(true);
    try {
      const data = new FormData();
      data.append('ligneId', ligne.id);
      data.append('kind', kind);
      data.append('precision', kind === 'DEVIS' ? precision.trim() : '');
      for (const f of fichiers) data.append('fichiers', f);
      const res = await fetch(`/api/demandes-budget/${budgetId}/preparation/documents`, { method: 'POST', body: data });
      const corps = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof corps.error === 'string' ? corps.error : 'Envoi impossible.');
      toast.success(corps.message ?? 'Document joint.');
      setFichiers([]);
      setPrecision('');
      if (champFichier.current) champFichier.current.value = '';
      onFait();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur.');
    } finally {
      setEnvoi(false);
    }
  };

  const retirer = async (doc: DocumentLigne) => {
    if (!window.confirm(`Retirer le document « ${doc.fileName} » ?`)) return;
    setEnvoi(true);
    try {
      const res = await fetch(`/api/demandes-budget/${budgetId}/preparation/documents?documentId=${encodeURIComponent(doc.id)}`, { method: 'DELETE' });
      const corps = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof corps.error === 'string' ? corps.error : 'Retrait impossible.');
      toast.success(corps.message ?? 'Document retiré.');
      onFait();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !envoi && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paperclip className="h-4 w-4" /> Documents de la ligne
          </DialogTitle>
          <DialogDescription className="break-words">
            « {ligne?.designation} » — devis du fournisseur, facture ou autre pièce qui justifie le prix (facultatif).
          </DialogDescription>
        </DialogHeader>

        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun document pour cette ligne.</p>
        ) : (
          <ul className="space-y-2">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center gap-2 rounded-md border p-2">
                <div className="min-w-0 flex-1">
                  <Badge variant="outline" className={cn('text-[10px] font-normal', ATTACHMENT_TYPE_COLORS[d.kind])}>
                    {ATTACHMENT_TYPE_LABELS[d.kind] ?? d.kind}
                  </Badge>
                  <p className="mt-0.5 truncate text-sm" title={d.fileName}>{d.fileName}</p>
                  {(d.ajouteParNom || d.ajouteParEmail) && (
                    <p className="text-[11px] text-muted-foreground">Joint par {d.ajouteParNom || d.ajouteParEmail}</p>
                  )}
                </div>
                <AttachmentPreviewButton className="h-8 w-8" url={d.url} title={d.fileName} />
                {modifiable && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" title="Retirer le document" disabled={envoi} onClick={() => void retirer(d)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {modifiable && (
          <div className="space-y-2 rounded-md border border-dashed p-3">
            <p className="text-sm font-medium">Joindre un document</p>
            <Select value={kind} onValueChange={(v) => setKind(v as DocumentLigneType)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOCUMENTS_LIGNE_TYPES.map((t) => <SelectItem key={t} value={t}>{ATTACHMENT_TYPE_LABELS[t]}</SelectItem>)}
              </SelectContent>
            </Select>
            {kind === 'DEVIS' && (
              <Input placeholder="Fournisseur de cette proforma * (ex. Imprimerie X)" value={precision} onChange={(e) => setPrecision(e.target.value)} />
            )}
            <Input ref={champFichier} type="file" multiple onChange={(e) => choisir(e.target.files)} />
            <p className="text-[11px] text-muted-foreground">PDF, image, Word ou Excel — 10 Mo au plus par fichier.</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={envoi}>Fermer</Button>
          {modifiable && (
            <Button onClick={() => void envoyer()} loading={envoi} disabled={envoi || fichiers.length === 0} className="gap-1">
              <Upload className="h-4 w-4" /> Joindre
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
