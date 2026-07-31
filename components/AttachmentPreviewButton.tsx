'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, FileText, Download, FileX } from 'lucide-react';

interface AttachmentPreviewButtonProps {
  url: string | null;
  title?: string;
}

export function AttachmentPreviewButton({ url, title = 'Pièce jointe' }: AttachmentPreviewButtonProps) {
  const [open, setOpen] = useState(false);

  if (!url) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-dashed text-muted-foreground">
              <FileX className="h-4 w-4" />
            </span>
          </TooltipTrigger>
          <TooltipContent>Aucune pièce jointe</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const isImage = /\.(png|jpe?g|gif|webp|bmp)$/i.test(url);
  const isPdf = /\.pdf$/i.test(url);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={() => setOpen(true)}>
              <Eye className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Voir la pièce jointe</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {title}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-[50vh] overflow-auto rounded-md border bg-muted/30 flex items-center justify-center">
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={title} className="max-w-full max-h-[70vh] object-contain" />
            ) : isPdf ? (
              <iframe src={url} className="w-full h-[70vh]" title={title} />
            ) : (
              <div className="text-center p-8 text-muted-foreground">
                <FileText className="mx-auto h-10 w-10 mb-2" />
                <p>Aperçu non disponible pour ce type de fichier.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button asChild variant="outline" size="sm">
              <a href={url} target="_blank" rel="noopener noreferrer">
                <Download className="mr-2 h-4 w-4" />
                Ouvrir / Télécharger
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
