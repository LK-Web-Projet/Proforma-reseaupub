'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, Filter, Wallet, Send, CheckCircle, Banknote, XCircle, Archive, Check, EyeOff, Download, Copy } from 'lucide-react';
import { FactureTableSkeleton } from '@/components/FactureTableSkeleton';
import { FactureStatusBadge, FACTURE_STATUS_META } from '@/components/FactureStatusBadge';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useDroits } from '@/components/DroitsProvider';
import { etatPiecesProforma, type EtatPiecesProforma } from '@/lib/proformaPieces';
import { ActionsProformaMenu } from '@/components/proforma/ActionsProformaMenu';
import { useRouter } from 'next-nprogress-bar';
import { AlertTriangle, BellRing } from 'lucide-react';

function formatDateFR(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
  });
}

function formatMoney(amount: number, currency: string) {
  return Number(amount).toLocaleString('fr-FR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
  });
}

// Taux de conversion pour la synthèse (approximatifs pour USD)
const CONVERSION_RATES: Record<string, number> = {
  'EUR': 655.957,
  'USD': 600,
  'XAF': 1,
  'XOF': 1,
};

export default function Home() {
  const { peut } = useDroits();
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [allFactures, setAllFactures] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [clients, setClients] = useState<any[]>([]);
  const [clientId, setClientId] = useState('');
  const [dateMin, setDateMin] = useState('');
  const [dateMax, setDateMax] = useState('');
  const [objet, setObjet] = useState('');
  const [statut, setStatut] = useState(''); // Utilisé pour filtrer la liste locale
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(true);
  const [filtersVisible, setFiltersVisible] = useState(false);
  // Alertes des pièces : facture normalisée manquante, paiement à réclamer (lien des notifications : ?alerte=reclamer).
  const [alerte, setAlerte] = useState<'' | 'manquante' | 'reclamer'>('');
  useEffect(() => {
    const a = new URLSearchParams(window.location.search).get('alerte');
    if (a === 'manquante' || a === 'reclamer') setAlerte(a);
  }, []);
  const [visibleCardLabels, setVisibleCardLabels] = useState<string[]>([
    "Valider & payer", "Brouillon", "Envoyée", "Validée", "Paiement en cours", "Soldée"
  ]);

  // Charger la liste des clients pour le filtre
  useEffect(() => {
    fetch('/api/clients')
      .then((res) => res.json())
      .then(setClients)
      .catch(() => setClients([]));
  }, []);

  // Charger les factures (sans filtre de statut pour permettre le calcul des stats de toutes les cartes)
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (year && year !== '') {
      params.set('year', year);
    } else {
      if (dateMin) params.set('dateMin', dateMin);
      if (dateMax) params.set('dateMax', dateMax);
    }
    if (clientId) params.set('clientId', clientId);

    fetch(`/api/factures?${params.toString()}`)
      .then((res) => res.json())
      .then(setAllFactures)
      .finally(() => setLoading(false));
  }, [clientId, dateMin, dateMax, year]);

  // Calcul des statistiques pour les cartes (dynamique selon les filtres de base)
  const stats = useMemo(() => {
    const initialStats: Record<string, { total: number; paid: number; remaining: number }> = {
      "Brouillon": { total: 0, paid: 0, remaining: 0 },
      "Envoyer": { total: 0, paid: 0, remaining: 0 },
      "Valider": { total: 0, paid: 0, remaining: 0 },
      "Payer": { total: 0, paid: 0, remaining: 0 },
      "Annuler": { total: 0, paid: 0, remaining: 0 },
      "Archiver": { total: 0, paid: 0, remaining: 0 },
      "Solde": { total: 0, paid: 0, remaining: 0 },
      "Total": { total: 0, paid: 0, remaining: 0 }
    };

    allFactures.forEach(f => {
      const rate = CONVERSION_RATES[f.devise] || 1;
      const totalTTC = Number(f.totalTTC) * rate;
      const remaining = Number(f.resteAPayer) * rate;
      const paid = totalTTC - remaining;
      
      if (initialStats[f.statut]) {
        initialStats[f.statut].total += totalTTC;
        initialStats[f.statut].paid += paid;
        initialStats[f.statut].remaining += remaining;
      }
      
      if (f.statut !== "Brouillon" && f.statut !== "Annuler" && f.statut !== "Archiver") {
        initialStats["Total"].total += totalTTC;
        initialStats["Total"].paid += paid;
        initialStats["Total"].remaining += remaining;
      }
    });

    return initialStats;
  }, [allFactures]);

  const alertes = useMemo(() => {
    const m = new Map<string, EtatPiecesProforma>();
    for (const f of allFactures) {
      m.set(f.id, etatPiecesProforma({ statut: f.statut, resteAPayer: Number(f.resteAPayer), aRecette: !!f.aRecette, documents: f.documents ?? [] }));
    }
    return m;
  }, [allFactures]);
  // Validée depuis le menu « … » : la ligne est mise à jour sans recharger la liste.
  const marquerValidee = (id: string) =>
    setAllFactures((prev) => prev.map((f) => (f.id === id ? { ...f, statut: 'Valider', dateValidation: new Date().toISOString() } : f)));
  const nbManquantes = Array.from(alertes.values()).filter((a) => a.factureManquante).length;
  const nbAReclamer = Array.from(alertes.values()).filter((a) => a.aReclamer).length;

  // Filtrage final pour le tableau (Objet + Statut sélectionné via les cartes)
  const filteredFactures = useMemo(() => {
    const searchTerms = objet.toLowerCase().trim().split(/\s+/).filter(t => t !== '');
    
    return allFactures.filter(f => {
      // Filtre d'alerte : tous statuts confondus (les alertes ignorent déjà brouillons, annulées, archivées).
      if (alerte === 'manquante' && !alertes.get(f.id)?.factureManquante) return false;
      if (alerte === 'reclamer' && !alertes.get(f.id)?.aReclamer) return false;
      const matchStatut = alerte !== '' || statut === '' 
        ? (f.statut !== 'Brouillon' && f.statut !== 'Annuler' && f.statut !== 'Archiver') 
        : f.statut === statut;
      
      if (!matchStatut) return false;

      if (searchTerms.length === 0) return true;

      const clientNom = (f.client?.nom || "").toLowerCase();
      const invoiceNumero = (f.numero || "").toLowerCase();
      const invoiceObjet = (f.objet || "").toLowerCase();

      // Vérifier si TOUS les mots clés sont présents dans au moins l'un des champs
      return searchTerms.every(term => 
        clientNom.includes(term) || 
        invoiceNumero.includes(term) || 
        invoiceObjet.includes(term)
      );
    });
  }, [allFactures, statut, objet, alerte, alertes]);

  const cards = [
    { label: "Valider & payer", value: "", stats: stats["Total"], icon: Wallet },
    { label: "Brouillon", value: "Brouillon", stats: stats["Brouillon"], icon: XCircle },
    { label: "Envoyée", value: "Envoyer", stats: stats["Envoyer"], icon: Send },
    { label: "Validée", value: "Valider", stats: stats["Valider"], icon: CheckCircle },
    { label: "Paiement en cours", value: "Payer", stats: stats["Payer"], icon: Banknote },
    { label: "Soldée", value: "Solde", stats: stats["Solde"], icon: Check },
    { label: "Annulée", value: "Annuler", stats: stats["Annuler"], icon: XCircle },
    { label: "Archivée", value: "Archiver", stats: stats["Archiver"], icon: Archive },
  ];

  /**
   * Clic sur une ligne : ouvre la proforma (Ctrl / Cmd / clic molette : dans un nouvel onglet). Ignoré
   * si l'utilisateur vient de sélectionner du texte. Le numéro (copie), le client (lien) et le menu
   * « … » arrêtent le clic avant la ligne.
   */
  const ouvrirProforma = (e: React.MouseEvent | React.KeyboardEvent, id: string) => {
    if ('button' in e && e.button === 2) return;
    if (window.getSelection()?.toString()) return;
    const url = `/facture/${id}`;
    if (e.ctrlKey || e.metaKey || ('button' in e && e.button === 1)) {
      window.open(url, '_blank', 'noopener');
      return;
    }
    router.push(url);
  };

  const copyToClipboard = (e: React.MouseEvent, value: string, label: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    toast.success(`${label} copié !`);
  };

  const toggleCardVisibility = (label: string) => {
    setVisibleCardLabels(prev =>
      prev.includes(label)
        ? prev.filter(l => l !== label)
        : [...prev, label]
    );
  };

  const handleExport = () => {
    if (filteredFactures.length === 0) {
      toast.warning("Aucune facture à exporter pour ce filtre.");
      return;
    }

    const dataToExport = filteredFactures.map((f) => {
      const totalTTC = Number(f.totalTTC);
      const resteAPayer = Number(f.resteAPayer);

      const produits = (f.produits || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((p: any) => `${p.designation} (x${p.quantite})`)
        .join(' | ');

      const gestionnaires = (f.gestionnaires || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((g: any) => `${g.gestionnaire.prenom} ${g.gestionnaire.nom}`)
        .join(', ');

      return {
        'Numéro': f.numero,
        'Date': formatDateFR(f.dateCreation),
        'Client': f.client?.nom || '-',
        'Objet': f.objet,
        'Produits': produits || '-',
        'Gestionnaire(s)': gestionnaires || '-',
        'Devise': f.devise,
        'Total HT': Number(f.totalHT),
        'Remise': Number(f.discountAmount) || 0,
        'TVA': Number(f.tva),
        'Total TTC': totalTTC,
        'Payé': totalTTC - resteAPayer,
        'Reste à payer': resteAPayer,
        'Statut': FACTURE_STATUS_META[f.statut as keyof typeof FACTURE_STATUS_META]?.label || f.statut,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    worksheet['!cols'] = [
      { wch: 18 }, // Numéro
      { wch: 14 }, // Date
      { wch: 22 }, // Client
      { wch: 30 }, // Objet
      { wch: 45 }, // Produits
      { wch: 22 }, // Gestionnaire(s)
      { wch: 8 },  // Devise
      { wch: 14 }, // Total HT
      { wch: 12 }, // TVA
      { wch: 14 }, // Total TTC
      { wch: 14 }, // Payé
      { wch: 14 }, // Reste à payer
      { wch: 14 }, // Statut
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Factures Proforma');

    const filtreLabel = statut
      ? (FACTURE_STATUS_META[statut as keyof typeof FACTURE_STATUS_META]?.label || statut)
      : 'Tout';
    const fileName = `Export_Factures_Proforma_${filtreLabel.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast.success('Exportation réussie !');
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap justify-between items-center mb-6">
        <h1 className="text-2xl font-bold mb-4">Liste des factures émises</h1>

        <div className="flex items-center gap-2 mb-4">
          {peut('proforma.exporter') && (
          <Button variant="outline" onClick={handleExport} title="Exporter la liste filtrée en Excel">
            <Download className="mr-2 h-4 w-4" />
            Exporter (Excel)
          </Button>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" title="Gérer la visibilité des cartes">
                <Eye className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
              <div className="space-y-2">
                <h4 className="font-medium leading-none mb-2">Visibilité des cartes</h4>
                {cards.map((card) => (
                  <div key={card.label} className="flex items-center justify-between py-1">
                    <span className="text-sm truncate mr-2">{card.label}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => toggleCardVisibility(card.label)}
                    >
                      {!visibleCardLabels.includes(card.label) ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Alertes : facture normalisée manquante, paiement à réclamer */}
      {(nbManquantes > 0 || nbAReclamer > 0 || alerte !== '') && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={alerte === 'manquante' ? 'destructive' : 'outline'}
            className={cn('h-8 gap-1.5', alerte !== 'manquante' && nbManquantes > 0 && 'border-red-300 text-red-700')}
            onClick={() => setAlerte(alerte === 'manquante' ? '' : 'manquante')}
          >
            <AlertTriangle className="h-3.5 w-3.5" /> Facture normalisée manquante ({nbManquantes})
          </Button>
          <Button
            size="sm"
            variant={alerte === 'reclamer' ? 'destructive' : 'outline'}
            className={cn('h-8 gap-1.5', alerte !== 'reclamer' && nbAReclamer > 0 && 'border-red-300 text-red-700')}
            onClick={() => setAlerte(alerte === 'reclamer' ? '' : 'reclamer')}
          >
            <BellRing className={cn('h-3.5 w-3.5', nbAReclamer > 0 && 'animate-pulse')} /> Paiement à réclamer ({nbAReclamer})
          </Button>
          {alerte !== '' && (
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setAlerte('')}>Retirer le filtre</Button>
          )}
        </div>
      )}

      {/* Cartes de sélection / Filtres de statut */}
      <div className="grid gap-2.5 mb-8 grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
        {cards.filter(c => visibleCardLabels.includes(c.label)).map((card) => {
          const count = allFactures.filter(f => card.value === "" ? (f.statut !== "Brouillon" && f.statut !== "Annuler" && f.statut !== "Archiver") : f.statut === card.value).length;
          const showBreakdown = card.value === "Payer" || (card.value === "" && card.stats.remaining > 0);
          const isActive = statut === card.value;
          return (
            <Card
              key={card.label}
              className={cn(
                "cursor-pointer transition-all py-0 gap-0 shadow-none",
                isActive
                  ? "border-primary/50 ring-1 ring-primary/30 bg-primary/[0.03]"
                  : "border-border/60 hover:border-border hover:shadow-sm"
              )}
              onClick={() => setStatut(card.value)}
            >
              <CardContent className="p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <card.icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide truncate">{card.label}</span>
                </div>
                <div className="text-base font-semibold tabular-nums truncate" title={`${card.stats.total.toLocaleString("fr-FR")} FCFA`}>
                  {card.stats.total.toLocaleString("fr-FR")} FCFA
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{count} facture(s)</p>

                {showBreakdown && (
                  <div className="mt-2 pt-2 border-t border-border/60 flex justify-between text-[10px] font-medium tabular-nums">
                    <span className="text-emerald-600">{card.stats.paid.toLocaleString("fr-FR")}</span>
                    <span className="text-rose-500">{card.stats.remaining.toLocaleString("fr-FR")}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filtres de recherche */}
      <div className="w-full">
        <div className="flex gap-4 mb-4">
          <Button
            onClick={() => setFiltersVisible(!filtersVisible)}
            variant="outline"
          >
            <Filter className="mr-2 h-4 w-4" />
            {filtersVisible ? "Masquer les filtres" : "Afficher les filtres"}
          </Button>
          <div className="flex-1">
            <Input
              id="search-objet"
              type="text"
              value={objet}
              onChange={(e) => setObjet(e.target.value)}
              placeholder="Rechercher par objet, client, numéro..."
              className="w-full md:w-1/3"
            />
          </div>
        </div>

        {filtersVisible && (
          <div className="mb-6 bg-white p-4 rounded-md shadow-sm border">
            <h2 className="text-lg font-semibold mb-2">Filtres avancés</h2>
            <div className="flex gap-4 flex-wrap items-end">
               <div>
                <label className="block text-sm font-medium mb-1">
                  Année
                </label>
                <select
                  value={year}
                  onChange={(e) => {
                    setYear(e.target.value);
                    setDateMin("");
                    setDateMax("");
                  }}
                  className="border-gray-300 rounded-md shadow-sm p-2"
                >
                  <option value="">Toutes les années</option>
                  <option value="2027">2027</option>
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Client
                </label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="border-gray-300 rounded-md shadow-sm p-2"
                >
                  <option value="">Tous les clients</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Date min
                </label>
                <Input
                  type="date"
                  value={dateMin}
                  onChange={(e) => {
                    setDateMin(e.target.value);
                    setYear("");
                  }}
                  className="border-gray-300 rounded-md shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Date max
                </label>
                <Input
                  type="date"
                  value={dateMax}
                  onChange={(e) => {
                    setDateMax(e.target.value);
                    setYear("");
                  }}
                  className="border-gray-300 rounded-md shadow-sm"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tableau sans défilement horizontal : colonnes à largeur fixe, textes tronqués (info-bulle) ou
          renvoyés à la ligne ; gestionnaire et total TTC masqués sur les écrans étroits. Le numéro de
          proforma n'est jamais coupé : sa colonne est assez large pour RP-PRO-AA/MM-NNNN. */}
      <div className="rounded-md bg-white border">
        <Table className="table-fixed">
          <TableHeader className="bg-rpcolor/10 sticky top-0 z-10">
            <TableRow>
              <TableHead className="w-[11.5rem]">Numéro / date</TableHead>
              <TableHead className="w-[18%]">Client</TableHead>
              <TableHead>Objet</TableHead>
              <TableHead className="hidden xl:table-cell w-[13%]">Gestionnaire</TableHead>
              <TableHead className="hidden lg:table-cell w-[8.5rem] text-right">Total TTC</TableHead>
              <TableHead className="w-[8.5rem] text-right">Reste à payer</TableHead>
              <TableHead className="w-[9.5rem] text-center">Statut</TableHead>
              <TableHead className="w-12 text-center"><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <FactureTableSkeleton />
            ) : filteredFactures.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                  Aucune facture trouvée.
                </TableCell>
              </TableRow>
            ) : (
              filteredFactures.map((facture) => {
                const etat = alertes.get(facture.id);
                const gestionnaires = facture.gestionnaires?.length > 0
                  ? facture.gestionnaires
                      .map((g: { gestionnaire: { prenom: string; nom: string } }) => `${g.gestionnaire.prenom} ${g.gestionnaire.nom}`)
                      .join(", ")
                  : "-";
                return (
                <TableRow
                  key={facture.id}
                  role="link"
                  tabIndex={0}
                  aria-label={`Ouvrir la proforma ${facture.numero}`}
                  title="Cliquer pour ouvrir la proforma"
                  onClick={(e) => ouvrirProforma(e, facture.id)}
                  onAuxClick={(e) => e.button === 1 && ouvrirProforma(e, facture.id)}
                  onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && ouvrirProforma(e, facture.id)}
                  className={cn(
                    "group/ligne cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                    etat?.alerteRouge ? "bg-red-50/70 hover:bg-red-100" : "hover:bg-blue-50"
                  )}
                >
                  <TableCell>
                    <button
                      type="button"
                      onClick={(e) => copyToClipboard(e, facture.numero, "Numéro")}
                      title="Cliquer pour copier le numéro"
                      className="group inline-flex items-center gap-1 whitespace-nowrap rounded px-1 -mx-1 font-mono text-sm group-hover/ligne:text-primary hover:bg-white hover:shadow-sm"
                    >
                      <span>{facture.numero}</span>
                      <Copy className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100" />
                    </button>
                    <span className="block text-[11px] text-muted-foreground">{formatDateFR(facture.dateCreation)}</span>
                  </TableCell>
                  <TableCell onAuxClick={(e) => e.stopPropagation()}>
                    {facture.client?.id ? (
                      <Link
                        href={`/client/${facture.client.id}`}
                        title={`Voir la fiche de ${facture.client?.nom || "-"}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-block max-w-full truncate align-bottom text-primary hover:underline"
                      >
                        {facture.client?.nom || "-"}
                      </Link>
                    ) : (
                      <span className="block truncate">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="block truncate" title={facture.objet}>{facture.objet}</span>
                    <span className="block truncate text-[11px] text-muted-foreground xl:hidden" title={gestionnaires}>{gestionnaires}</span>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-sm">
                    <span className="block truncate" title={gestionnaires}>{gestionnaires}</span>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-right font-semibold">
                    {formatMoney(facture.totalTTC, facture.devise)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-red-600">
                    {formatMoney(facture.resteAPayer, facture.devise)}
                  </TableCell>
                  <TableCell className="text-center whitespace-normal">
                    <FactureStatusBadge
                      status={facture.statut}
                      animate={!["Solde", "Annuler", "Archiver"].includes(facture.statut)}
                      percentPaid={
                        facture.statut === "Payer" && Number(facture.totalTTC) > 0
                          ? Math.round(((Number(facture.totalTTC) - Number(facture.resteAPayer)) / Number(facture.totalTTC)) * 100)
                          : undefined
                      }
                    />
                    {etat?.aReclamer ? (
                      <span className="mt-1 flex items-center justify-center gap-1 text-[10px] font-semibold leading-tight text-red-700">
                        <BellRing className="h-3 w-3 shrink-0 animate-pulse" /> À réclamer
                      </span>
                    ) : etat?.factureManquante ? (
                      <span className="mt-1 flex items-center justify-center gap-1 text-[10px] font-semibold leading-tight text-red-700" title="Facture normalisée manquante">
                        <AlertTriangle className="h-3 w-3 shrink-0 animate-pulse" /> Facture manquante
                      </span>
                    ) : etat?.relanceProche ? (
                      <span className="mt-1 block text-[10px] font-semibold leading-tight text-amber-700">Échéance proche</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-center px-1" onClick={(e) => e.stopPropagation()} onAuxClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <ActionsProformaMenu facture={facture} onValidee={marquerValidee} />
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}