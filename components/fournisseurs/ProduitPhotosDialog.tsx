"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, ImagePlus } from "lucide-react";

export interface ProduitPhoto {
    id: string;
    url: string;
    fileName: string;
    fileType: string;
}

interface ProduitPhotosDialogProps {
    produitId: string | null;
    produitNom: string;
    photos: ProduitPhoto[];
    onClose: () => void;
    onPhotosChange: (photos: ProduitPhoto[]) => void;
}

export function ProduitPhotosDialog({
    produitId,
    produitNom,
    photos,
    onClose,
    onPhotosChange,
}: ProduitPhotosDialogProps) {
    const [uploading, setUploading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleAddPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!produitId || !e.target.files || e.target.files.length === 0) return;
        const files = Array.from(e.target.files);
        setUploading(true);
        try {
            const formData = new FormData();
            files.forEach((file) => formData.append("photos", file));

            const res = await fetch(`/api/fournisseurs/produits/${produitId}/photos`, {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.details || errorData.error || "Erreur lors de l'ajout des photos.");
            }

            const updatedPhotos: ProduitPhoto[] = await res.json();
            onPhotosChange(updatedPhotos);
            toast.success("Photo(s) ajoutée(s) !");
        } catch (error) {
            console.error(error);
            toast.error(error instanceof Error ? error.message : "Erreur lors de l'ajout des photos.");
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };

    const handleDeletePhoto = async (photoId: string) => {
        if (!produitId) return;
        setDeletingId(photoId);
        try {
            const res = await fetch(
                `/api/fournisseurs/produits/${produitId}/photos?photoId=${photoId}`,
                { method: "DELETE" }
            );
            if (!res.ok) throw new Error();
            onPhotosChange(photos.filter((p) => p.id !== photoId));
            toast.success("Photo supprimée.");
        } catch {
            toast.error("Erreur lors de la suppression de la photo.");
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <Dialog open={!!produitId} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Photos — {produitNom}</DialogTitle>
                </DialogHeader>

                {photos.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                        Aucune photo pour ce produit.
                    </p>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {photos.map((photo) => (
                            <div
                                key={photo.id}
                                className="relative group rounded-md overflow-hidden border aspect-square"
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={photo.url} alt={photo.fileName} className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={() => handleDeletePhoto(photo.id)}
                                    disabled={deletingId === photo.id}
                                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-50"
                                    title="Supprimer cette photo"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-md p-4 cursor-pointer text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                    <ImagePlus className="h-4 w-4" />
                    {uploading ? "Envoi en cours..." : "Ajouter des photos"}
                    <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleAddPhotos}
                        disabled={uploading}
                    />
                </label>
            </DialogContent>
        </Dialog>
    );
}
