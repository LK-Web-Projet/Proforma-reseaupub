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
import { Indicateur } from "@/components/ui/indicateur";

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
    /** Bon lié à rien (ni ligne de budget, ni proforma) : la direction le valide sans attendre le scan. */
    sansLiaison?: boolean;
    /** Peut renvoyer une promesse : la liste est alors désactivée, avec un indicateur, jusqu'à sa fin. */
    onChange: (statut: StatutCommandeFournisseur) => void | Promise<unknown>;
    triggerClassName?: string;
    badgeClassName?: string;
    buttonClassName?: string;
}

/**
 * Contrôle de statut d'un bon de commande fournisseur (liste globale, onglet d'un fournisseur,
 * fiche). Ne propose que les passages autorisés (BROUILLON → VALIDEE → LIVREE, ANNULEE) ;
 * « Validée » (bon signé par la DG) seulement pour la direction et, sur la fiche, une fois le
 * scan signé joint — sauf pour un bon lié à rien, validé directement. Le serveur applique les mêmes règles (app/api/fournisseurs/commandes/[commandeId]).
 */
export function CommandeStatutControl({
    statut,
    isAdmin,
    bcSigne,
    sansLiaison,
    onChange,
    triggerClassName,
    badgeClassName,
}: CommandeStatutControlProps) {
    const { peut } = useDroits();
    const [enCours, setEnCours] = React.useState(false);
    const changer = async (value: StatutCommandeFournisseur) => {
        setEnCours(true);
        try {
            await onChange(value);
        } finally {
            setEnCours(false);
        }
    };
    // Livrer et annuler ont chacun leur droit ; valider reste réservé à la direction (isAdmin).
    const suivants = (TRANSITIONS_COMMANDE[statut] ?? []).filter((s) =>
        s === "LIVREE" ? peut("fournisseurs.commandeLivrer") : s === "ANNULEE" ? peut("fournisseurs.commandeAnnuler") : true
    );
    const isLocked = suivants.length === 0;
    const scanManquant = bcSigne === false && !sansLiaison;
    const valideeImpossible = !isAdmin || scanManquant;

    if (!isLocked) {
        return (
            <span className="inline-flex items-center gap-1.5">
            <Select value={statut} onValueChange={(value: StatutCommandeFournisseur) => void changer(value)} disabled={enCours}>
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
                            {s === "VALIDEE" && !isAdmin ? " (direction)" : s === "VALIDEE" && scanManquant ? " (joindre le BC signé)" : ""}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {enCours && <Indicateur label="Mise à jour du statut…" />}
            </span>
        );
    }

    return (
        <Badge variant={STATUT_BADGE_VARIANT[statut]} className={badgeClassName}>
            {STATUT_LABELS[statut]}
        </Badge>
    );
}
