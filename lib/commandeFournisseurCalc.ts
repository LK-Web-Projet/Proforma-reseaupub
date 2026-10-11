export const TAUX_TVA = 0.18;
export const TAUX_AIB = 0.03;

// Une proforma ne peut être associée à un bon de commande que si elle est confirmée
// côté client (validée, payée ou soldée) — pas un brouillon, une proforma envoyée,
// annulée ou archivée.
export const STATUTS_PROFORMA_ASSOCIABLES = ["Valider", "Payer", "Solde"];

export interface LigneInput {
  produitFournisseurId: string;
  quantite: number;
  largeur?: number;
  hauteur?: number;
  prixUnitaire: number;
}

export function computeLigne(ligne: LigneInput) {
  let surface: number | null = null;
  let prixTotal = 0;

  // Si largeur et hauteur sont fournies, on suppose que c'est un produit en m².
  // Dimensions saisies en cm, conversion géométrique standard : (L×H)/10000.
  if (ligne.largeur && ligne.hauteur) {
    surface = (Number(ligne.largeur) * Number(ligne.hauteur)) / 10000;
    prixTotal = surface * ligne.quantite * ligne.prixUnitaire;
  } else {
    prixTotal = ligne.quantite * ligne.prixUnitaire;
  }

  return { surface, prixTotal };
}

export function computeTotaux(totalHT: number, appliquerTva: boolean, appliquerAib: boolean) {
  const tva = appliquerTva ? totalHT * TAUX_TVA : 0;
  const totalTTC = totalHT + tva;
  const montantAib = appliquerAib ? totalHT * TAUX_AIB : 0;
  const montantNet = totalTTC - montantAib;
  return { tva, totalTTC, montantAib, montantNet };
}
