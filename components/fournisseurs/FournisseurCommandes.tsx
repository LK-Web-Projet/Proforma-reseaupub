"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Eye } from "lucide-react";
import { CommandeFournisseur, StatutCommandeFournisseur } from "@prisma/client";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import NewCommandeForm from "./NewCommandeForm";
import { CommandeStatutControl } from "./CommandeStatutControl";
import { useDroits } from "@/components/DroitsProvider";

interface FournisseurCommandesProps {
    fournisseurId: string;
}

export default function FournisseurCommandes({ fournisseurId }: FournisseurCommandesProps) {
    const { peut } = useDroits();
    // documents : scans du BC signé seulement (pastille « scan signé manquant »).
    const [commandes, setCommandes] = useState<(CommandeFournisseur & { documents?: { id: string }[] })[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const router = useRouter();

    const fetchCommandes = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/fournisseurs/commandes?fournisseurId=${fournisseurId}`);
            if (!res.ok) {
                const text = await res.text();
                console.error("API Error Response:", res.status, text);
                throw new Error(`Failed to fetch orders: ${res.status} ${res.statusText}`);
            }
            const data = await res.json();
            setCommandes(data);
        } catch (error) {
            console.error(error);
            toast.error("Erreur chargement commandes. Vérifiez la console.");
        } finally {
            setLoading(false);
        }
    }, [fournisseurId]);

    useEffect(() => {
        fetchCommandes();
    }, [fetchCommandes]);

    useEffect(() => {
        fetch("/api/demandes-budget/me-role")
            .then((res) => (res.ok ? res.json() : { isAdmin: false }))
            .then((data) => setIsAdmin(!!data.isAdmin))
            .catch(() => setIsAdmin(false));
    }, []);

    const handleCreateSuccess = () => {
        setIsCreating(false);
        fetchCommandes();
    };

    const handleStatutChange = async (commande: CommandeFournisseur, newStatut: StatutCommandeFournisseur) => {
        try {
            const res = await fetch(`/api/fournisseurs/commandes/${commande.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ statut: newStatut }),
            });
            if (!res.ok) throw new Error();
            setCommandes((prev) => prev.map((c) => (c.id === commande.id ? { ...c, statut: newStatut } : c)));
            toast.success("Statut mis à jour avec succès !");
        } catch {
            toast.error("Erreur lors de la mise à jour du statut.");
        }
    };

    if (isCreating) {
        return (
            <NewCommandeForm
                fournisseurId={fournisseurId}
                onSuccess={handleCreateSuccess}
                onCancel={() => setIsCreating(false)}
            />
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Bons de Commande</h3>
                {peut("fournisseurs.commandeCreer") && <Button onClick={() => setIsCreating(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nouveau BCF
                </Button>}
            </div>

            <div className="rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Numéro</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Statut</TableHead>
                            <TableHead className="text-right">Montant Net</TableHead>
                            <TableHead className="text-center">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24">
                                    Chargement...
                                </TableCell>
                            </TableRow>
                        ) : commandes.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24">
                                    Aucune commande trouvée.
                                </TableCell>
                            </TableRow>
                        ) : (
                            commandes.map((cmd) => (
                                <TableRow key={cmd.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            {cmd.numero}
                                            {(cmd.statut === "VALIDEE" || cmd.statut === "LIVREE") && (cmd.documents?.length ?? 0) === 0 && (
                                                <span
                                                    className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700"
                                                    title="Le scan du bon de commande signé n'est pas joint : aucun paiement possible."
                                                >
                                                    <span className="h-1.5 w-1.5 rounded-full bg-red-600" /> Scan signé manquant
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>{format(new Date(cmd.dateCommande), "dd/MM/yyyy")}</TableCell>
                                    <TableCell>
                                        <CommandeStatutControl
                                            statut={cmd.statut}
                                            isAdmin={isAdmin}
                                            onChange={(value) => handleStatutChange(cmd, value)}
                                            triggerClassName="border-none bg-transparent! p-0 h-auto cursor-pointer w-auto"
                                            buttonClassName="h-7 text-xs"
                                        />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {new Intl.NumberFormat("fr-FR", {
                                            style: "currency",
                                            currency: "XOF",
                                        }).format(Number(cmd.montantNet))}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => router.push(`/fournisseur/${fournisseurId}/commandes/${cmd.id}`)}
                                            title="Voir le détail"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
