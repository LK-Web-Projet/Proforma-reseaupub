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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Eye } from "lucide-react";
import { CommandeFournisseur } from "@prisma/client";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import NewCommandeForm from "./NewCommandeForm";

interface FournisseurCommandesProps {
    fournisseurId: string;
}

export default function FournisseurCommandes({ fournisseurId }: FournisseurCommandesProps) {
    const [commandes, setCommandes] = useState<CommandeFournisseur[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
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

    const handleCreateSuccess = () => {
        setIsCreating(false);
        fetchCommandes();
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
                <Button onClick={() => setIsCreating(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Nouveau BCF
                </Button>
            </div>

            <div className="rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Numéro</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Statut</TableHead>
                            <TableHead className="text-right">Total HT</TableHead>
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
                                    <TableCell className="font-medium">{cmd.numero}</TableCell>
                                    <TableCell>{format(new Date(cmd.dateCommande), "dd/MM/yyyy")}</TableCell>
                                    <TableCell>
                                        <Badge variant={cmd.statut === 'VALIDEE' ? 'success' : 'secondary'}>
                                            {cmd.statut}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {new Intl.NumberFormat("fr-FR", {
                                            style: "currency",
                                            currency: "XOF",
                                        }).format(Number(cmd.totalHT))}
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
