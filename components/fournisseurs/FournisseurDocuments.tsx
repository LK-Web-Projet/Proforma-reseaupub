"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, FileText, Trash2, Upload } from "lucide-react";
import { AttachmentPreviewButton } from "@/components/AttachmentPreviewButton";
import { DOCUMENT_FOURNISSEUR_PRESETS, getDocumentFournisseurTypeColor } from "@/lib/documentFournisseurTypes";
import { cn } from "@/lib/utils";
import { useDroits } from "@/components/DroitsProvider";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo — même limite que côté serveur (lib/uploadFournisseurDocument.ts)

interface FournisseurDocumentsProps {
  fournisseurId: string;
}

interface FournisseurDocument {
  id: string;
  type: string;
  url: string;
  fileName: string;
  createdAt: string;
  createdBy: { nom: string } | null;
}

export default function FournisseurDocuments({ fournisseurId }: FournisseurDocumentsProps) {
  const { peut } = useDroits();
  const peutGerer = peut("fournisseurs.documents");
  const [documents, setDocuments] = useState<FournisseurDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [selectedType, setSelectedType] = useState<string>(DOCUMENT_FOURNISSEUR_PRESETS[0]);
  const [customType, setCustomType] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const isOtherType = selectedType === "Autre";

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/fournisseurs/${fournisseurId}/documents`);
      if (!res.ok) throw new Error("Failed to fetch documents");
      setDocuments(await res.json());
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors du chargement des documents.");
    } finally {
      setLoading(false);
    }
  }, [fournisseurId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const resetForm = () => {
    setSelectedType(DOCUMENT_FOURNISSEUR_PRESETS[0]);
    setCustomType("");
    setSelectedFiles([]);
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    const tooBig = files.find((f) => f.size > MAX_FILE_SIZE_BYTES);
    if (tooBig) {
      toast.error(`Le fichier "${tooBig.name}" dépasse la taille maximale autorisée (10 Mo).`);
      e.target.value = "";
      return;
    }
    setSelectedFiles(files);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalType = isOtherType ? customType.trim() : selectedType;
    if (!finalType) {
      toast.error("Veuillez préciser le type de document.");
      return;
    }
    if (selectedFiles.length === 0) {
      toast.error("Veuillez sélectionner au moins un fichier.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("type", finalType);
      selectedFiles.forEach((file) => formData.append("files", file));

      const res = await fetch(`/api/fournisseurs/${fournisseurId}/documents`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Erreur lors de l'ajout du document.");
      }

      setDocuments(await res.json());
      setIsDialogOpen(false);
      resetForm();
      toast.success("Document(s) ajouté(s) !");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'ajout du document.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    setDeletingId(documentId);
    try {
      const res = await fetch(`/api/fournisseurs/${fournisseurId}/documents/${documentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setDocuments((prev) => prev.filter((d) => d.id !== documentId));
      toast.success("Document supprimé.");
    } catch {
      toast.error("Erreur lors de la suppression du document.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Documents</h3>
        {peutGerer && (
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter un document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter un document</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="documentType">Type de document</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger id="documentType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_FOURNISSEUR_PRESETS.map((preset) => (
                      <SelectItem key={preset} value={preset}>
                        {preset}
                      </SelectItem>
                    ))}
                    <SelectItem value="Autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isOtherType && (
                <div className="space-y-2">
                  <Label htmlFor="customType">Précisez le type</Label>
                  <Input
                    id="customType"
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value)}
                    placeholder="Ex : Attestation de non-redevance"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="documentFiles">Fichier(s)</Label>
                <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-md p-4 cursor-pointer text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                  <Upload className="h-4 w-4" />
                  {selectedFiles.length > 0
                    ? `${selectedFiles.length} fichier(s) sélectionné(s)`
                    : "Choisir un ou plusieurs fichiers"}
                  <input
                    id="documentFiles"
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFilesSelected}
                  />
                </label>
              </div>
              <DialogFooter>
                <Button type="submit" loading={submitting} disabled={submitting}>
                  {submitting ? "Ajout..." : "Ajouter"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-12">Chargement...</p>
      ) : documents.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 border rounded-md bg-white">
          Aucun document pour ce prestataire.
        </p>
      ) : (
        <div className="rounded-md border bg-white divide-y">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 p-3">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={cn("font-normal", getDocumentFournisseurTypeColor(doc.type))}>
                    {doc.type}
                  </Badge>
                  <span className="text-sm truncate">{doc.fileName}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ajouté le {new Date(doc.createdAt).toLocaleDateString("fr-FR")} par {doc.createdBy?.nom ?? "Système"}
                </p>
              </div>
              <AttachmentPreviewButton url={doc.url} title={doc.fileName} />
              {peutGerer && (
              <Button
                variant="ghost"
                size="icon"
                disabled={deletingId === doc.id}
                onClick={() => handleDelete(doc.id)}
                title="Supprimer ce document"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
