import { Prisma, StatutFactureFournisseur } from "@prisma/client";
import { libelleDroit } from "@/lib/permissions";
import { toDateJour } from "@/lib/budgetSchema";
import { refusMontantFactureCommande } from "@/lib/commandeFournisseurSuivi";
import { erreurMoyensPaiement } from "@/lib/moyensPaiementServeur";
import { assertAllowedUpload } from "@/lib/uploadSecurity";
import { droitsTransitionFacture, factureLieeAuBudget, LIBELLES_STATUT_FACTURE, type StatutFacture } from "@/lib/factureStatut";

type Db = Prisma.TransactionClient;

/** Refus d'un changement de statut : message pour l'utilisateur et code HTTP. */
export class StatutFactureError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

export interface DemandeStatutFacture {
  cible: StatutFacture;
  /** Paiement hors plateforme (cible « payée ») : code du moyen, date "AAAA-MM-JJ", preuve, référence. */
  modePaiement?: string | null;
  datePaiement?: string | null;
  preuve?: File | null;
  reference?: string | null;
  motif?: string | null;
}

export interface AuteurStatut {
  email: string;
  nom: string | null;
  peut: (cle: string) => boolean;
}

const UN_JOUR = 24 * 3600 * 1000;

/**
 * Vérifie un changement de statut fait à la main (droits, dépenses qui règlent la facture, facture
 * liée au budget, informations du paiement hors plateforme). Lance StatutFactureError si refusé ;
 * renvoie la facture et la date de paiement (cible « payée ») sinon. À appeler dans une transaction.
 */
export async function controlerStatutFacture(tx: Db, factureId: string, d: DemandeStatutFacture, auteur: AuteurStatut) {
  await tx.$queryRaw`SELECT id FROM "FactureFournisseur" WHERE id = ${factureId} FOR UPDATE`;
  const facture = await tx.factureFournisseur.findUnique({
    where: { id: factureId },
    select: { id: true, reference: true, montant: true, status: true, commandeId: true, ligneBudgetId: true, paiementCaisseId: true },
  });
  if (!facture) throw new StatutFactureError("Facture introuvable.", 404);
  const actuel = facture.status as StatutFacture;
  if (actuel === d.cible) throw new StatutFactureError(`Cette facture est déjà « ${LIBELLES_STATUT_FACTURE[d.cible]} ».`);

  const droits = droitsTransitionFacture(actuel, d.cible);
  if (!droits.some(auteur.peut)) {
    throw new StatutFactureError(
      `Votre rôle n'a pas le droit : « ${libelleDroit(droits[droits.length - 1])} ». Voyez avec l'administrateur (Paramètres → Rôles).`,
      403
    );
  }

  // Facture réglée par une dépense de budget : son statut suit ses paiements (choix 4a).
  const depensesActives = await tx.budgetDepense.count({ where: { factureFournisseurId: factureId, annuleeAt: null } });
  if (depensesActives > 0) {
    throw new StatutFactureError(
      "Cette facture est réglée (en tout ou partie) par une dépense de budget : son statut suit ses paiements. Pour le changer, annulez d'abord la dépense (l'argent revient dans la caisse)."
    );
  }

  // Facture payée par « Appliquer le paiement » sans budget : l'argent est sorti de la caisse.
  if (facture.paiementCaisseId && actuel === "PAYEE") {
    throw new StatutFactureError(
      `Cette facture a été payée par la caisse (écriture n° ${facture.paiementCaisseId}) : son statut ne se change pas à la main.`
    );
  }

  let datePaiement: Date | null = null;
  if (d.cible === "PAYEE") {
    if (factureLieeAuBudget(facture)) {
      throw new StatutFactureError(
        "Cette facture est rattachée à un bon de commande ou à une ligne de budget : elle passe « payée » par « Appliquer le paiement », pas à la main."
      );
    }
    if (!d.modePaiement) throw new StatutFactureError("Choisissez le moyen de paiement utilisé.");
    const erreurMoyen = await erreurMoyensPaiement(tx, [d.modePaiement]);
    if (erreurMoyen) throw new StatutFactureError(erreurMoyen);
    datePaiement = d.datePaiement ? toDateJour(d.datePaiement) : null;
    if (!datePaiement) throw new StatutFactureError("Indiquez la date du paiement.");
    if (datePaiement.getTime() > Date.now() + UN_JOUR) throw new StatutFactureError("La date du paiement ne peut pas être dans le futur.");
    if (!d.preuve || d.preuve.size === 0) {
      throw new StatutFactureError("Joignez la preuve du paiement (reçu, ordre de virement, capture Mobile Money…).");
    }
    try {
      assertAllowedUpload(d.preuve);
    } catch (e) {
      throw new StatutFactureError(e instanceof Error ? e.message : "Fichier refusé.");
    }
  }

  // Facture d'un bon de commande réactivée : le bon ne peut avoir qu'une facture active, à son montant.
  if (actuel === "ANNULEE" && facture.commandeId) {
    const refus = await refusMontantFactureCommande(tx, { commandeId: facture.commandeId, montant: Number(facture.montant), factureIdExclu: facture.id });
    if (refus) throw new StatutFactureError(refus);
  }

  return { facture, actuel, datePaiement };
}

/**
 * Applique le changement (après controlerStatutFacture) : statut, informations du paiement hors
 * plateforme (remplies si « payée », effacées sinon), retard à réévaluer si la facture repasse en
 * attente, et ligne d'historique.
 */
export async function appliquerStatutFacture(
  tx: Db,
  controle: Awaited<ReturnType<typeof controlerStatutFacture>>,
  d: DemandeStatutFacture,
  auteur: AuteurStatut,
  preuveUrl: string | null
) {
  const payee = d.cible === "PAYEE";
  const reference = d.reference?.trim() || null;
  const motif = d.motif?.trim() || null;
  const facture = await tx.factureFournisseur.update({
    where: { id: controle.facture.id },
    data: {
      status: d.cible as StatutFactureFournisseur,
      paiementManuelDate: payee ? controle.datePaiement : null,
      paiementManuelMode: payee ? d.modePaiement! : null,
      paiementManuelPreuve: payee ? preuveUrl : null,
      paiementManuelReference: payee ? reference : null,
      paiementManuelParEmail: payee ? auteur.email : null,
      ...(d.cible === "EN_ATTENTE" ? { retardNotifieAt: null } : {}),
    },
  });
  await tx.factureFournisseurStatutHistorique.create({
    data: {
      factureFournisseurId: controle.facture.id,
      ancienStatut: controle.actuel as StatutFactureFournisseur,
      nouveauStatut: d.cible as StatutFactureFournisseur,
      modePaiement: payee ? d.modePaiement! : null,
      datePaiement: payee ? controle.datePaiement : null,
      preuve: payee ? preuveUrl : null,
      reference: payee ? reference : null,
      motif,
      auteurEmail: auteur.email,
      auteurNom: auteur.nom,
    },
  });
  return facture;
}
