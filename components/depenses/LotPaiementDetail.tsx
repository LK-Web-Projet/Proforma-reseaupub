'use client';

/** Une ligne du lot telle que conservée par Finance (LotPaiement.detail), quelle que soit la route. */
export interface LigneLot {
  numero?: number | string;
  reference?: string;
  beneficiaire: string;
  numeroMomo?: string;
  typePaiement?: string;
  libelle?: string;
  montant: number | string;
}

export interface LotPaiementResume {
  reference: string;
  referenceOperateur?: string | null;
  campagneNom?: string | null;
  nbBeneficiaires: number;
  detail?: LigneLot[] | null;
}

const fcfa = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n);

/**
 * Détail d'un lot de paiement CampTrack (un état de paiement MoMo / un virement groupé) : une ligne par
 * bénéficiaire, avec son numéro Mobile Money, la nature du paiement et le montant. Repliable ; affiché
 * sur la proforma, la fiche budget et le journal de caisse — la même écriture de caisse partout.
 */
export function LotPaiementDetail({ lot, className }: { lot: LotPaiementResume; className?: string }) {
  const lignes = Array.isArray(lot.detail) ? lot.detail : [];
  const total = lignes.reduce((s, l) => s + Number(l.montant), 0);
  return (
    <details className={`mt-1 text-xs ${className ?? ''}`}>
      <summary className="cursor-pointer text-primary">
        Lot CampTrack {lot.reference} — {lot.nbBeneficiaires} bénéficiaire(s)
        {lot.referenceOperateur ? ` · réf. opérateur ${lot.referenceOperateur}` : ''}
      </summary>
      {lignes.length > 0 ? (
        <div className="mt-1 max-h-56 overflow-auto rounded border">
          <table className="w-full">
            <thead className="bg-muted/50 text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="px-2 py-1 text-left">#</th>
                <th className="px-2 py-1 text-left">Bénéficiaire</th>
                <th className="px-2 py-1 text-left">N° MoMo</th>
                <th className="px-2 py-1 text-left">Nature</th>
                <th className="px-2 py-1 text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l, i) => (
                <tr key={l.reference ?? i} className="border-t" title={l.reference}>
                  <td className="px-2 py-1 text-muted-foreground">{l.numero ?? i + 1}</td>
                  <td className="px-2 py-1">{l.beneficiaire}</td>
                  <td className="px-2 py-1 font-mono">{l.numeroMomo || '—'}</td>
                  <td className="px-2 py-1 text-muted-foreground">{l.typePaiement ? l.typePaiement.toLowerCase() : l.libelle || '—'}</td>
                  <td className="px-2 py-1 text-right whitespace-nowrap">{fcfa(Number(l.montant))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-semibold">
                <td className="px-2 py-1" colSpan={4}>Total{lot.campagneNom ? ` — ${lot.campagneNom}` : ''}</td>
                <td className="px-2 py-1 text-right whitespace-nowrap">{fcfa(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="mt-1 text-muted-foreground">Détail non transmis.</p>
      )}
    </details>
  );
}
