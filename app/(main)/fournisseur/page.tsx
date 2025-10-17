"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FournisseurTableSkeleton } from "@/components/FournisseurTableSkeleton";
import { FournisseurModal, Fournisseur } from "@/components/FournisseurModal";
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import { toast } from "sonner";

export default function FournisseursPage() {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFournisseur, setSelectedFournisseur] = useState<Fournisseur | null>(null);

  const fetchFournisseurs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/fournisseurs");
      if (!res.ok) {
        throw new Error("Failed to fetch fournisseurs");
      }
      const data = await res.json();
      setFournisseurs(data);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la récupération des fournisseurs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFournisseurs();
  }, [fetchFournisseurs]);

  const handleOpenModal = (fournisseur: Fournisseur | null = null) => {
    setSelectedFournisseur(fournisseur);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedFournisseur(null);
  };

  const handleSuccess = () => {
    handleCloseModal();
    fetchFournisseurs();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce fournisseur ?")) {
      return;
    }

    try {
      const response = await fetch(`/api/fournisseurs/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erreur lors de la suppression.");
      }

      toast.success("Fournisseur supprimé avec succès !");
      fetchFournisseurs();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message);
    }
  };

  return (
    <>
      <FournisseurModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
        initialData={selectedFournisseur}
      />
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Liste des Fournisseurs</h1>
          <Button onClick={() => handleOpenModal()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nouveau Fournisseur
          </Button>
        </div>

        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entreprise</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Domaine d'activité</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <FournisseurTableSkeleton />
              ) : fournisseurs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">
                    Aucun fournisseur trouvé.
                  </TableCell>
                </TableRow>
              ) : (
                fournisseurs.map((fournisseur) => (
                  <TableRow key={fournisseur.id}>
                    <TableCell className="font-medium">{fournisseur.entreprise}</TableCell>
                    <TableCell>{fournisseur.email}</TableCell>
                    <TableCell>{fournisseur.contact}</TableCell>
                    <TableCell>{fournisseur.domaineActivite}</TableCell>
                    <TableCell className="text-center space-x-2">
                      <Button variant="outline" size="icon" onClick={() => handleOpenModal(fournisseur)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDelete(fournisseur.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
