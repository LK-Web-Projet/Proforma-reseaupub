"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
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
import { PlusCircle, Mail, Phone, Briefcase, Pencil, ChevronRight, Building2, Search, Copy, AlarmClock } from 'lucide-react';
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  TYPE_FOURNISSEUR_VALUES,
  TYPE_FOURNISSEUR_COLORS,
  TYPE_FOURNISSEUR_ICONS,
  resolveTypeFournisseur,
} from "@/lib/typeFournisseur";
import { PrestataireStatutBadge } from "@/components/fournisseurs/PrestataireStatutBadge";
import { PrestataireStatutToggle } from "@/components/fournisseurs/PrestataireStatutToggle";
import { PastilleRetardPrestataire } from "@/components/fournisseurs/RetardPaiement";
import type { RetardPrestataire } from "@/lib/retardPaiement";
import Link from "next/link";

/** Prestataire avec ses factures en retard de paiement (calculées par /api/fournisseurs). */
type FournisseurAvecRetard = Fournisseur & { retard?: RetardPrestataire | null };

const TAB_ALL = "Tout";

export default function FournisseursPage() {
  const [fournisseurs, setFournisseurs] = useState<FournisseurAvecRetard[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFournisseur, setSelectedFournisseur] = useState<Fournisseur | null>(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<string>(TAB_ALL);
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
      toast.error("Erreur lors de la récupération des prestataires.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFournisseurs();
  }, [fetchFournisseurs]);

  const filteredFournisseurs = useMemo(() => {
    const searchTerms = search.toLowerCase().trim().split(/\s+/).filter((t) => t !== '');

    return fournisseurs.filter((f) => {
      if (activeTab !== TAB_ALL && resolveTypeFournisseur(f.typeFournisseur) !== activeTab) return false;

      if (searchTerms.length === 0) return true;

      const haystack = [f.entreprise, f.nom, f.prenom, f.email, f.contact, f.domaineActivite]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchTerms.every((term) => haystack.includes(term));
    });
  }, [fournisseurs, search, activeTab]);

  const enRetard = useMemo(() => {
    const avecRetard = fournisseurs.filter((f) => f.retard);
    return {
      prestataires: avecRetard.length,
      factures: avecRetard.reduce((s, f) => s + (f.retard?.nombre ?? 0), 0),
      montant: avecRetard.reduce((s, f) => s + (f.retard?.montant ?? 0), 0),
    };
  }, [fournisseurs]);

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

  const copyToClipboard = (e: React.MouseEvent, value: string, label: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    toast.success(`${label} copié !`);
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
            <h1 className="text-2xl font-bold">Liste des Prestataires</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {loading ? 'Chargement...' : `${filteredFournisseurs.length} / ${fournisseurs.length} prestataire(s)`}
            </p>
          </div>
          <Button onClick={() => handleOpenModal()}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Nouveau Prestataire
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value={TAB_ALL}>Tout</TabsTrigger>
            {TYPE_FOURNISSEUR_VALUES.map((type) => (
              <TabsTrigger key={type} value={type}>{type}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un fournisseur ou prestataire (entreprise, contact, email)..."
              className="pl-9"
            />
          </div>
        </div>

        {enRetard.factures > 0 && (
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="flex items-center gap-2 text-sm text-red-800">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600 text-white animate-pulse">
                <AlarmClock className="h-4 w-4" />
              </span>
              <span>
                <strong>{enRetard.factures} facture(s) en retard de paiement</strong> chez {enRetard.prestataires} prestataire(s) —{" "}
                {new Intl.NumberFormat("fr-FR").format(enRetard.montant)} XOF. Délai dépassé selon le type (Paramètres &gt; Rôles).
              </span>
            </p>
            <Button asChild size="sm" className="bg-red-600 hover:bg-red-700 text-white shrink-0">
              <Link href="/fournisseur/factures?retard=1">Voir les factures en retard</Link>
            </Button>
          </div>
        )}

        <div className="rounded-md border bg-white overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Entreprise / Prestataire</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Domaine d&apos;activité</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <FournisseurTableSkeleton />
              ) : filteredFournisseurs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-32">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Building2 className="h-8 w-8" />
                      <p>Aucun prestataire trouvé.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredFournisseurs.map((fournisseur) => {
                  const type = resolveTypeFournisseur(fournisseur.typeFournisseur);
                  const TypeIcon = TYPE_FOURNISSEUR_ICONS[type];
                  return (
                    <TableRow
                      key={fournisseur.id}
                      onClick={() =>
                        router.push(`/fournisseur/${fournisseur.id}`)
                      }
                      className={cn("cursor-pointer", fournisseur.retard ? "ligne-retard" : "hover:bg-muted/30")}
                    >
                      <TableCell className="py-3 font-medium">
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold uppercase",
                            fournisseur.retard ? "bg-red-600 text-white" : "bg-primary/10 text-primary"
                          )}>
                            {fournisseur.entreprise.slice(0, 2)}
                          </span>
                          <div className="min-w-0">
                            <span className="block truncate max-w-[200px]">{fournisseur.entreprise}</span>
                            {fournisseur.retard && (
                              <PastilleRetardPrestataire
                                retard={fournisseur.retard}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/fournisseur/factures?retard=1&fournisseurId=${fournisseur.id}`);
                                }}
                              />
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant="outline" className={cn("gap-1 font-normal", TYPE_FOURNISSEUR_COLORS[type])}>
                          <TypeIcon className="h-3 w-3" />
                          {type}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <PrestataireStatutBadge actif={fournisseur.actif} />
                          <PrestataireStatutToggle
                            fournisseurId={fournisseur.id}
                            entreprise={fournisseur.entreprise}
                            actif={fournisseur.actif}
                            onSuccess={fetchFournisseurs}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="py-3 max-w-[140px]">
                        {fournisseur.email ? (
                          <button
                            type="button"
                            onClick={(e) => copyToClipboard(e, fournisseur.email!, "Email")}
                            title="Cliquer pour copier l'email"
                            className="group flex w-full items-center gap-1.5 rounded px-1 -mx-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{fournisseur.email}</span>
                            <Copy className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100" />
                          </button>
                        ) : (
                          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Mail className="h-3.5 w-3.5 shrink-0" />—
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 max-w-[110px]">
                        <button
                          type="button"
                          onClick={(e) => copyToClipboard(e, fournisseur.contact, "Contact")}
                          title="Cliquer pour copier le contact"
                          className="group flex w-full items-center gap-1.5 rounded px-1 -mx-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{fournisseur.contact}</span>
                          <Copy className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100" />
                        </button>
                      </TableCell>
                      <TableCell className="py-3 max-w-[130px]">
                        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Briefcase className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{fournisseur.domaineActivite}</span>
                        </span>
                      </TableCell>
                      <TableCell className="py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Modifier le prestataire"
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
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
