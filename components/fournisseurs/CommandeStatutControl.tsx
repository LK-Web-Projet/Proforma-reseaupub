"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
 * est affiché (liste globale, onglet d'un fournisseur, page de détail). Tout utilisateur
 * peut changer librement le statut tant que le bon n'est pas dans un état final
 * (LIVREE/ANNULEE), qui reste verrouillé. `isAdmin` n'est plus utilisé ici (conservé dans
 * les props pour ne pas casser les appelants) depuis que cette liberté a été étendue à
 * tout utilisateur, plus seulement aux admins.
 */
export function CommandeStatutControl({
    statut,
    onChange,
    triggerClassName,
    badgeClassName,
}: CommandeStatutControlProps) {
    const isLocked = statut === "LIVREE" || statut === "ANNULEE";

    if (!isLocked) {
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

    return (
        <Badge variant={STATUT_BADGE_VARIANT[statut]} className={badgeClassName}>
            {STATUT_LABELS[statut]}
        </Badge>
    );
}
