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
import { useRouter } from "next/navigation";
import { FournisseurTableSkeleton } from "@/components/FournisseurTableSkeleton";
import { FournisseurModal, Fournisseur } from "@/components/FournisseurModal";
import { PlusCircle, Mail, Phone, Briefcase, Pencil, ChevronRight, Building2 } from 'lucide-react';
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function FournisseursPage() {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFournisseur, setSelectedFournisseur] = useState<Fournisseur | null>(null);
  const router = useRouter();

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

  return (
    <>
      <FournisseurModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
        initialData={selectedFournisseur}
      />
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Liste des Fournisseurs</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {loading ? 'Chargement...' : `${fournisseurs.length} fournisseur(s) enregistré(s)`}
            </p>
          </div>
          <Button onClick={() => handleOpenModal()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nouveau Fournisseur
          </Button>
        </div>

        <div className="rounded-md border bg-white overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Entreprise</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Domaine d&apos;activité</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <FournisseurTableSkeleton />
              ) : fournisseurs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-32">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Building2 className="h-8 w-8" />
                      <p>Aucun fournisseur trouvé.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                fournisseurs.map((fournisseur) => (
                  <TableRow
                    key={fournisseur.id}
                    onClick={() =>
                      router.push(`/fournisseur/${fournisseur.id}`)
                    }
                    className="cursor-pointer hover:bg-muted/30"
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase">
                          {fournisseur.entreprise.slice(0, 2)}
                        </span>
                        <span className="truncate max-w-[200px]">{fournisseur.entreprise}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate max-w-[180px]">{fournisseur.email}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        {fournisseur.contact}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Briefcase className="h-3.5 w-3.5 shrink-0" />
                        {fournisseur.domaineActivite}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Modifier le fournisseur"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenModal(fournisseur);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
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
