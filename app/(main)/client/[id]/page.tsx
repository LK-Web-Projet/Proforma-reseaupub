"use client";

import { useEffect, useState, FormEvent, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { 
    Search, FileText, CheckCircle2, Wallet, 
    CheckSquare, AlertCircle, Archive, 
    Mail, Phone, MapPin, Edit3, X, Save,
    TrendingUp, Clock, Ban, LucideIcon
} from "lucide-react";

type Client = {
  id: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
};

type InvoiceProduct = {
    designation: string;
};

type Facture = {
  id: string;
  numero: string;
  dateCreation: string;
  statut: string;
  totalTTC: number;
  resteAPayer: number;
  devise: string;
  objet: string;
  produits: InvoiceProduct[];
};

type StatCardProps = {
    title: string;
    count: number;
    amount: number;
    paidAmount?: number;
    remainingAmount?: number;
    icon: LucideIcon;
    isActive: boolean;
    onClick: () => void;
};

const StatCard = ({ title, count, amount, paidAmount, remainingAmount, icon: Icon, isActive, onClick }: StatCardProps) => (
  <Card
    className={cn(
      "cursor-pointer transition-all py-0 gap-0 shadow-none",
      isActive
        ? "border-primary/50 ring-1 ring-primary/30 bg-primary/[0.03]"
        : "border-border/60 hover:border-border hover:shadow-sm"
    )}
    onClick={onClick}
  >
    <CardContent className="p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide truncate">{title}</span>
      </div>
      <div className="flex items-center justify-between gap-1">
        <span className="text-sm font-semibold tabular-nums truncate" title={formatMoney(amount, "XOF")}>
          {formatMoney(amount, "XOF")}
        </span>
        <span className="text-[10px] text-muted-foreground shrink-0">{count}</span>
      </div>
      {(paidAmount !== undefined || remainingAmount !== undefined) && (
        <div className="mt-2 pt-2 border-t border-border/60 flex justify-between text-[10px] font-medium tabular-nums">
          <span className="text-emerald-600">{formatMoney(paidAmount ?? 0, "XOF")}</span>
          <span className="text-rose-500">{formatMoney(remainingAmount ?? 0, "XOF")}</span>
        </div>
      )}
    </CardContent>
  </Card>
);

function formatMoney(amount: number, currency: string) {
  return Number(amount).toLocaleString("fr-FR", {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 0
  });
}

const statusConfig: Record<string, { label: string; color: string; icon: LucideIcon }> = {
    "Brouillon": { label: "Brouillon", color: "bg-slate-100 text-slate-700", icon: Clock },
    "Envoyer": { label: "Envoyée", color: "bg-blue-100 text-blue-700", icon: Mail },
    "Valider": { label: "Validée", color: "bg-indigo-100 text-indigo-700", icon: CheckCircle2 },
    "Payer": { label: "Paiement Partiel", color: "bg-orange-100 text-orange-700", icon: Wallet },
    "Solde": { label: "Soldée", color: "bg-green-100 text-green-700", icon: CheckSquare },
    "Annuler": { label: "Annulée", color: "bg-red-100 text-red-700", icon: Ban },
    "Archiver": { label: "Archivée", color: "bg-gray-100 text-gray-700", icon: Archive },
};

export default function ClientDetailPage() {
  const { id } = useParams();
  const [client, setClient] = useState<Client | null>(null);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [loadingClient, setLoadingClient] = useState(true);
  const [loadingFactures, setLoadingFactures] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoadingClient(true);
    setLoadingFactures(true);
    try {
      const [clientRes, facturesRes] = await Promise.all([
        fetch(`/api/clients/${id}`),
        fetch(`/api/factures?clientId=${id}`)
      ]);
      
      if (!clientRes.ok) throw new Error("Client non trouvé");
      const clientData = await clientRes.json();
      setClient(clientData);

      if (!facturesRes.ok) throw new Error("Factures non trouvées");
      const facturesData = await facturesRes.json();
      setFactures(facturesData);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la récupération des données");
    } finally {
      setLoadingClient(false);
      setLoadingFactures(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!client) return;

    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(client),
      });
      if (!res.ok) throw new Error("La mise à jour a échoué");
      toast.success("Client mis à jour avec succès!");
      setIsEditing(false);
    } catch (error) {
      console.error(error);
      toast.error("Impossible de mettre à jour le client.");
    }
  };

  const stats = useMemo(() => {
      const initialStats: Record<string, { count: number; total: number; paid: number; remaining: number }> = {
          "Brouillon": { count: 0, total: 0, paid: 0, remaining: 0 },
          "Envoyer": { count: 0, total: 0, paid: 0, remaining: 0 },
          "Valider": { count: 0, total: 0, paid: 0, remaining: 0 },
          "Payer": { count: 0, total: 0, paid: 0, remaining: 0 },
          "Solde": { count: 0, total: 0, paid: 0, remaining: 0 },
          "Annuler": { count: 0, total: 0, paid: 0, remaining: 0 },
          "Archiver": { count: 0, total: 0, paid: 0, remaining: 0 },
      };

      factures.forEach(f => {
          if (initialStats[f.statut]) {
              initialStats[f.statut].count++;
              initialStats[f.statut].total += Number(f.totalTTC);
              initialStats[f.statut].remaining += Number(f.resteAPayer);
              initialStats[f.statut].paid += (Number(f.totalTTC) - Number(f.resteAPayer));
          }
      });

      return initialStats;
  }, [factures]);

  const filteredFactures = useMemo(() => {
    return factures.filter(f => {
        const matchesStatus = activeStatusFilter ? f.statut === activeStatusFilter : true;
        const matchesSearch = searchTerm ? (
            f.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.objet.toLowerCase().includes(searchTerm.toLowerCase()) ||
            f.produits.some(p => p.designation.toLowerCase().includes(searchTerm.toLowerCase()))
        ) : true;
        return matchesStatus && matchesSearch;
    });
  }, [factures, activeStatusFilter, searchTerm]);

  if (loadingClient) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <TrendingUp className="w-12 h-12 text-primary animate-pulse" />
            <p className="text-muted-foreground animate-pulse">Chargement de la fiche client...</p>
        </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 text-center p-10">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <h2 className="text-xl font-bold italic">Oups ! Client introuvable</h2>
          <Button asChild variant="outline">
              <Link href="/client">Retour à la liste</Link>
          </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-10">
      {/* Header Section */}
      <div className="bg-white rounded-2xl border shadow-sm p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16" />
        <div className="flex flex-col space-y-2 relative">
            <Badge variant="outline" className="w-fit mb-2 uppercase tracking-widest text-[10px] font-bold">Fiche Client</Badge>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">{client.nom}</h1>
            <div className="flex flex-wrap gap-4 pt-2">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4 text-primary" /> {client.email || "Non renseigné"}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4 text-primary" /> {client.telephone || "Non renseigné"}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 text-primary" /> {client.adresse || "Non renseigné"}
                </div>
            </div>
        </div>
        <div className="flex gap-2 relative">
            <Button onClick={() => setIsEditing(!isEditing)} variant={isEditing ? "destructive" : "outline"} size="sm">
                {isEditing ? <><X className="w-4 h-4 mr-2" /> Annuler</> : <><Edit3 className="w-4 h-4 mr-2" /> Modifier</>}
            </Button>
            <Button asChild size="sm">
                <Link href={`/facture/new?clientId=${client.id}`}><FileText className="w-4 h-4 mr-2" /> Créer une facture</Link>
            </Button>
        </div>
      </div>

      {isEditing && (
        <Card className="border-2 border-primary/20 animate-in slide-in-from-top-4 duration-300">
            <CardHeader>
                <CardTitle className="text-lg">Édition des informations</CardTitle>
                <CardDescription>Mettez à jour les coordonnées du client.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleUpdate} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-muted-foreground">Nom / Raison Sociale</label>
                            <Input value={client.nom} onChange={(e) => setClient({ ...client, nom: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-muted-foreground">Email Professionnel</label>
                            <Input type="email" value={client.email ?? ""} onChange={(e) => setClient({ ...client, email: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-muted-foreground">Téléphone</label>
                            <Input value={client.telephone ?? ""} onChange={(e) => setClient({ ...client, telephone: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-muted-foreground">Adresse complète</label>
                            <Input value={client.adresse ?? ""} onChange={(e) => setClient({ ...client, adresse: e.target.value })} />
                        </div>
                    </div>
                    <div className="flex justify-end pt-4">
                        <Button type="submit"><Save className="w-4 h-4 mr-2" /> Enregistrer les modifications</Button>
                    </div>
                </form>
            </CardContent>
        </Card>
      )}

      {/* Stats Dashboard */}
      <div className="grid gap-2.5 grid-cols-[repeat(auto-fit,minmax(130px,1fr))]">
        {Object.entries(statusConfig).map(([status, config]) => (
            <StatCard
                key={status}
                title={config.label}
                count={stats[status].count}
                amount={stats[status].total}
                paidAmount={status === "Payer" ? stats[status].paid : undefined}
                remainingAmount={status === "Payer" ? stats[status].remaining : undefined}
                icon={config.icon}
                isActive={activeStatusFilter === status}
                onClick={() => setActiveStatusFilter(activeStatusFilter === status ? null : status)}
            />
        ))}
      </div>

      {/* Factures List */}
      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 pb-6 border-b">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <CardTitle className="text-xl">Journal des Facturations</CardTitle>
                <CardDescription>
                    {activeStatusFilter ? `Affichage des factures avec le statut : ${activeStatusFilter}` : "Historique complet des transactions"}
                </CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                        placeholder="Rechercher par N°, objet ou produit..." 
                        className="pl-9 bg-white" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                {activeStatusFilter && (
                    <Button variant="ghost" size="sm" onClick={() => setActiveStatusFilter(null)} className="text-xs text-red-500 hover:text-red-600">
                        Réinitialiser
                    </Button>
                )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/30">
                <TableHead className="pl-6 w-32">N° Facture</TableHead>
                <TableHead>Date & Objet</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Total TTC</TableHead>
                <TableHead className="text-right">Payé</TableHead>
                <TableHead className="text-right">Reste</TableHead>
                <TableHead className="text-center pr-6">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingFactures ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-32">
                    <div className="flex items-center justify-center gap-2">
                        <Clock className="w-5 h-5 animate-spin text-primary" />
                        Chargement des factures...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredFactures.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-48 text-muted-foreground italic">
                    Aucune facture ne correspond aux critères sélectionnés.
                  </TableCell>
                </TableRow>
              ) : (
                filteredFactures.map((facture) => {
                    const paid = Number(facture.totalTTC) - Number(facture.resteAPayer);
                    const config = statusConfig[facture.statut] || { label: facture.statut, color: "bg-gray-100" };
                    return (
                        <TableRow key={facture.id} className="hover:bg-slate-50/50 transition-colors group">
                            <TableCell className="pl-6 font-mono text-xs font-bold text-slate-600">
                                {facture.numero}
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col">
                                    <span className="font-semibold text-slate-800 line-clamp-1">{facture.objet}</span>
                                    <span className="text-[10px] text-muted-foreground">{new Date(facture.dateCreation).toLocaleDateString("fr-FR", { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className={`${config.color} border-transparent font-bold text-[10px]`}>
                                    {config.label}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right font-bold text-slate-900">
                                {formatMoney(facture.totalTTC, facture.devise)}
                            </TableCell>
                            <TableCell className="text-right font-medium text-green-600">
                                {formatMoney(paid, facture.devise)}
                            </TableCell>
                            <TableCell className="text-right font-medium text-orange-600">
                                {formatMoney(facture.resteAPayer, facture.devise)}
                            </TableCell>
                            <TableCell className="text-center pr-6">
                                <Button asChild variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Link href={`/facture/${facture.id}`}>
                                        Voir plus
                                    </Link>
                                </Button>
                            </TableCell>
                        </TableRow>
                    );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
