"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Send } from "lucide-react";
import type { StatutCommandeFournisseur } from "@prisma/client";

export const STATUT_LABELS: Record<StatutCommandeFournisseur, string> = {
    BROUILLON: "Brouillon",
    VALIDEE: "Validée",
    LIVREE: "Livrée",
    ANNULEE: "Annulée",
};

export const STATUT_BADGE_VARIANT: Record<StatutCommandeFournisseur, "brouillon" | "success" | "annuler"> = {
    BROUILLON: "brouillon",
    VALIDEE: "success",
    LIVREE: "success",
    ANNULEE: "annuler",
};

interface CommandeStatutControlProps {
    statut: StatutCommandeFournisseur;
    isAdmin: boolean;
    onChange: (statut: StatutCommandeFournisseur) => void;
    triggerClassName?: string;
    badgeClassName?: string;
    buttonClassName?: string;
}

/**
 * Contrôle de statut d'un bon de commande fournisseur, réutilisé partout où un statut
 * est affiché (liste globale, onglet d'un fournisseur, page de détail) pour garder la
 * même règle : un admin a le contrôle total, un utilisateur normal ne peut que confirmer
 * l'envoi d'un bon déjà validé (VALIDEE -> LIVREE).
 */
export function CommandeStatutControl({
    statut,
    isAdmin,
    onChange,
    triggerClassName,
    badgeClassName,
    buttonClassName,
}: CommandeStatutControlProps) {
    const isLocked = statut === "LIVREE" || statut === "ANNULEE";

    if (isAdmin && !isLocked) {
        return (
            <Select value={statut} onValueChange={(value: StatutCommandeFournisseur) => onChange(value)}>
                <SelectTrigger className={triggerClassName}>
                    <SelectValue>
                        <Badge variant={STATUT_BADGE_VARIANT[statut]} className={badgeClassName}>
                            {STATUT_LABELS[statut]}
                        </Badge>
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="BROUILLON">Brouillon</SelectItem>
                    <SelectItem value="VALIDEE">Validée</SelectItem>
                    <SelectItem value="LIVREE">Livrée</SelectItem>
                    <SelectItem value="ANNULEE">Annulée</SelectItem>
                </SelectContent>
            </Select>
        );
    }

    if (!isAdmin && statut === "VALIDEE") {
        return (
            <Button size="sm" onClick={() => onChange("LIVREE")} className={buttonClassName}>
                <Send className="mr-2 h-3.5 w-3.5" />
                Confirmer l&apos;envoi
            </Button>
        );
    }

    return (
        <Badge variant={STATUT_BADGE_VARIANT[statut]} className={badgeClassName}>
            {STATUT_LABELS[statut]}
        </Badge>
    );
}
