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
import { TRANSITIONS_COMMANDE } from "@/lib/commandeFournisseurLiasse";
import { useDroits } from "@/components/DroitsProvider";

export const STATUT_LABELS: Record<StatutCommandeFournisseur, string> = {
    BROUILLON: "Brouillon",
    VALIDEE: "Validée",
    LIVREE: "Livrée",
    PAYEE: "Payée",
    ANNULEE: "Annulée",
};

export const STATUT_BADGE_VARIANT: Record<StatutCommandeFournisseur, "brouillon" | "success" | "annuler"> = {
    BROUILLON: "brouillon",
    VALIDEE: "success",
    LIVREE: "success",
    PAYEE: "success",
    ANNULEE: "annuler",
};

interface CommandeStatutControlProps {
    statut: StatutCommandeFournisseur;
    /** Droit « Valider les budgets mensuels » (direction) : seul habilité à valider (signer) un bon. */
    isAdmin: boolean;
    /** Scan du bon signé joint (connu sur la fiche) ; non renseigné : le serveur tranche. */
    bcSigne?: boolean;
    onChange: (statut: StatutCommandeFournisseur) => void;
    triggerClassName?: string;
    badgeClassName?: string;
    buttonClassName?: string;
}

/**
 * Contrôle de statut d'un bon de commande fournisseur (liste globale, onglet d'un fournisseur,
 * fiche). Ne propose que les passages autorisés (BROUILLON → VALIDEE → LIVREE, ANNULEE) ;
 * « Validée » (bon signé par la DG) seulement pour la direction et, sur la fiche, une fois le
 * scan signé joint. Le serveur applique les mêmes règles (app/api/fournisseurs/commandes/[commandeId]).
 */
export function CommandeStatutControl({
    statut,
    isAdmin,
    bcSigne,
    onChange,
    triggerClassName,
    badgeClassName,
}: CommandeStatutControlProps) {
    const { peut } = useDroits();
    // Livrer et annuler ont chacun leur droit ; valider reste réservé à la direction (isAdmin).
    const suivants = (TRANSITIONS_COMMANDE[statut] ?? []).filter((s) =>
        s === "LIVREE" ? peut("fournisseurs.commandeLivrer") : s === "ANNULEE" ? peut("fournisseurs.commandeAnnuler") : true
    );
    const isLocked = suivants.length === 0;
    const valideeImpossible = !isAdmin || bcSigne === false;

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
                    <SelectItem value={statut}>{STATUT_LABELS[statut]}</SelectItem>
                    {suivants.map((s) => (
                        <SelectItem key={s} value={s} disabled={s === "VALIDEE" && valideeImpossible}>
                            {STATUT_LABELS[s as StatutCommandeFournisseur]}
                            {s === "VALIDEE" && !isAdmin ? " (direction)" : s === "VALIDEE" && bcSigne === false ? " (joindre le BC signé)" : ""}
                        </SelectItem>
                    ))}
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
