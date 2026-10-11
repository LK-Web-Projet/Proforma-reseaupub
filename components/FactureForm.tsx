"use client";

import React, { useState, useEffect } from "react";
import {
  useForm,
  useFieldArray,
  Controller,
  SubmitHandler,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRouter } from "next/navigation";
import { ClientCombobox } from "./ClientCombobox";
import { DEVISE, DEVISE_OPTIONS, UNITE_DUREE, UNITE_DUREE_OPTIONS, DISCOUNT_TYPE_OPTIONS } from "@/lib/constants";
import { Textarea } from "./ui/textarea";
import { 
    User, Info, Settings, Package, 
    Plus, Trash2, Calculator, Receipt, 
    Coins, Percent, Tag, ShieldCheck
} from "lucide-react";
import { Badge } from "./ui/badge";

// --- Définition des types pour les données ---
interface Client {
  id: string;
  nom: string;
}

interface Produit {
  id: string;
  nom: string;
  prixUnitaire: number;
}

// --- Schéma de validation ---
const uniteDureeKeys = Object.keys(UNITE_DUREE) as [string, ...string[]];
const deviseKeys = Object.keys(DEVISE) as [string, ...string[]];

const productSchema = z.object({
  designation: z.string().min(1, "La désignation est requise.").default(""),
  quantite: z.coerce.number().min(1, "Qté. min. 1.").default(1),
  prixUnitaire: z.coerce
    .number()
    .min(0, "Le prix ne peut être négatif.")
    .default(0),
  duree: z.coerce.number().min(1, "Durée min. 1.").optional(),
  uniteDuree: z.enum(uniteDureeKeys).optional(),
  includeduree: z.boolean().default(false),
});

const schema = z.object({
  clientNom: z.string().min(1, "Le nom du client est requis."),
  objet: z.string().min(1, "L'objet de la facture est requis."),
  info: z.string().optional(),
  isTaxExempt: z.boolean().optional(),
  isDiscountEnabled: z.boolean().optional(),
  discountType: z.enum(["POURCENTAGE", "MONTANT"]).optional(),
  discountValue: z.coerce.number().min(0).optional(),
  produits: z.array(productSchema)
    .min(1, "Au moins un produit est requis.")
    .refine(
      (items) => {
        const designations = items.map((item) => item.designation);
        return new Set(designations).size === designations.length;
      },
      {
        message: "Chaque produit ne peut être ajouté qu'une seule fois.",
      }
    ),
  gestionnaireId: z.string().optional(),
  devise: z.enum(deviseKeys).default("XOF"),
  paymentConditionPercentage: z.number().optional(),
});

type FactureFormInput = z.input<typeof schema>;
type FactureFormOutput = z.output<typeof schema>;

const defaultProduct = {
  designation: "",
  quantite: 1,
  prixUnitaire: 0,
  duree: 1,
  uniteDuree: "jour" as const,
  includeduree: false,
};

export default function FactureForm() {
  const [clients, setClients] = useState<Client[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [gestionnaires, setGestionnaires] = useState<
    { id: string; nom: string; prenom: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // --- Chargement des données initiales ---
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await fetch("/api/clients");
        const data = await res.json();
        setClients(data);
      } catch {
        toast.error("Impossible de charger les clients.");
      }
    };

    const fetchProduits = async () => {
      try {
        const res = await fetch("/api/produits");
        const data = await res.json();
        setProduits(data);
      } catch {
        toast.error("Impossible de charger les produits.");
      }
    };

    const fetchGestionnaires = async () => {
      try {
        const res = await fetch("/api/gestionnaires");
        const data = await res.json();
        setGestionnaires(data);
      } catch {
        toast.error("Impossible de charger les gestionnaires.");
      }
    };

    fetchClients();
    fetchProduits();
    fetchGestionnaires();
  }, []);

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FactureFormInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientNom: "",
      objet: "",
      produits: [defaultProduct],
      gestionnaireId: "",
      devise: "XOF",
      paymentConditionPercentage: 50,
      isTaxExempt: false,
      isDiscountEnabled: false,
      discountType: "POURCENTAGE",
      discountValue: 0,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "produits",
  });
  const watchedProduits = watch("produits");
  const watchedDevise = watch("devise");
  const watchedIsTaxExempt = watch("isTaxExempt");
  const watchedIsDiscountEnabled = watch("isDiscountEnabled");
  const watchedDiscountType = watch("discountType");
  const watchedDiscountValue = watch("discountValue");

  const handleClientCreated = (newClient: Client) => {
    setClients((prevClients) => [...prevClients, newClient]);
    setValue("clientNom", newClient.nom, { shouldValidate: true });
  };

  // --- Calculs des totaux ---
  const totalHT = watchedProduits.reduce((acc, p) => {
    const quantite = Number(p.quantite) || 0;
    const prix = Number(p.prixUnitaire) || 0;
    const duree = Number(p.duree) || 1;
    const inclureDuree = p.includeduree;
    let totalLigne = quantite * prix;
    if (inclureDuree) totalLigne *= duree;
    return acc + totalLigne;
  }, 0);

  const discountAmount = watchedIsDiscountEnabled
    ? Math.min(
        watchedDiscountType === "MONTANT"
          ? Number(watchedDiscountValue) || 0
          : totalHT * ((Number(watchedDiscountValue) || 0) / 100),
        totalHT
      )
    : 0;
  const totalHTApresRemise = totalHT - discountAmount;
  const tva = watchedIsTaxExempt ? 0 : totalHTApresRemise * 0.18;
  const totalTTC = totalHTApresRemise + tva;

  const onSubmit: SubmitHandler<FactureFormInput> = async (data) => {
    const validatedData: FactureFormOutput = schema.parse(data);
    if (validatedData.gestionnaireId === "null") validatedData.gestionnaireId = undefined;

    setLoading(true);
    try {
      const res = await fetch("/api/factures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validatedData),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Une erreur est survenue.");
      }

      toast.success("Facture enregistrée avec succès !");
      router.push("/");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleProductChange = (index: number, value: string) => {
    const selectedProduit = produits.find((p) => p.nom === value);
    setValue(`produits.${index}.designation`, value);
    if (selectedProduit) {
      setValue(`produits.${index}.prixUnitaire`, selectedProduit.prixUnitaire);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="container mx-auto py-8 space-y-8 pb-32">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Nouvelle Facture</h1>
          <p className="text-muted-foreground">Créez une facture proforma professionnelle en quelques clics.</p>
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Annuler</Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Traitement..." : "Enregistrer la facture"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Section Client & Objet */}
          <Card className="border-none shadow-md overflow-hidden">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="w-5 h-5 text-primary" /> Détails du Client & Mission
              </CardTitle>
              <CardDescription>Identifiez votre client et l&apos;objet de cette facturation.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
                    <User className="w-3 h-3" /> Client
                  </label>
                  <Controller
                    name="clientNom"
                    control={control}
                    render={({ field }) => (
                      <ClientCombobox
                        clients={clients}
                        value={field.value}
                        onChange={field.onChange}
                        onClientCreated={handleClientCreated}
                      />
                    )}
                  />
                  {errors.clientNom && <p className="text-red-500 text-xs">{errors.clientNom.message}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
                    <Tag className="w-3 h-3" /> Objet
                  </label>
                  <Input {...register("objet")} placeholder="Ex: Campagne d'affichage Mars 2024" />
                  {errors.objet && <p className="text-red-500 text-xs">{errors.objet.message}</p>}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
                  <Info className="w-3 h-3" /> Note complémentaire
                </label>
                <Textarea 
                    {...register("info")} 
                    placeholder="Précisions sur la mission, conditions de livraison, etc..." 
                    className="min-h-[100px] resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Section Produits */}
          <Card className="border-none shadow-md overflow-hidden">
            <CardHeader className="bg-slate-50 border-b flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="w-5 h-5 text-primary" /> Produits & Services
                </CardTitle>
                <CardDescription>Détaillez les prestations à facturer.</CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => append(defaultProduct)} className="bg-white">
                <Plus className="w-4 h-4 mr-2" /> Ajouter
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="pl-6">Désignation</TableHead>
                    <TableHead className="w-20">Qté</TableHead>
                    <TableHead className="w-32">Prix Unitaire</TableHead>
                    <TableHead className="w-32">Durée (Option)</TableHead>
                    <TableHead className="w-32">Montant</TableHead>
                    <TableHead className="w-12 pr-6"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => (
                    <TableRow key={field.id} className="group transition-colors hover:bg-slate-50/50">
                      <TableCell className="pl-6 align-top">
                        <Input
                          list={`produits-list-${index}`}
                          {...register(`produits.${index}.designation`)}
                          placeholder="Désignation"
                          autoComplete="off"
                          onChange={(e) => handleProductChange(index, e.target.value)}
                        />
                        <datalist id={`produits-list-${index}`}>
                          {produits.map((p) => <option key={p.id} value={p.nom} />)}
                        </datalist>
                      </TableCell>
                      <TableCell className="align-top">
                        <Input type="number" {...register(`produits.${index}.quantite`)} className="px-2" />
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="relative">
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground uppercase font-bold">{watchedDevise}</span>
                            <Input type="number" step="0.01" {...register(`produits.${index}.prixUnitaire`)} className="pr-12" />
                        </div>
                      </TableCell>
                      <TableCell className="align-top space-y-2">
                        <div className="flex items-center gap-2">
                            <Input type="number" step="1" {...register(`produits.${index}.duree`)} className="w-16 h-8" disabled={!watchedProduits[index]?.includeduree} />
                            <Controller
                                name={`produits.${index}.uniteDuree`}
                                control={control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!watchedProduits[index]?.includeduree}>
                                        <SelectTrigger className="h-8 w-20 text-[10px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>{UNITE_DUREE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                )}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                             <Controller
                                name={`produits.${index}.includeduree`}
                                control={control}
                                render={({ field }) => (
                                    <Switch checked={field.value} onCheckedChange={field.onChange} className="scale-75" />
                                )}
                            />
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">Appliquer durée</span>
                        </div>
                      </TableCell>
                      <TableCell className="align-top font-bold text-slate-700 pt-5">
                        {(() => {
                           const p = watchedProduits[index];
                           const qte = Number(p?.quantite) || 0;
                           const pu = Number(p?.prixUnitaire) || 0;
                           const duree = Number(p?.duree) || 1;
                           let total = qte * pu;
                           if (p?.includeduree) total *= duree;
                           return total.toLocaleString() + " " + watchedDevise;
                        })()}
                      </TableCell>
                      <TableCell className="align-top pr-6 pt-3">
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="text-red-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {fields.length === 0 && (
                  <div className="p-8 text-center border-t border-dashed">
                      <p className="text-muted-foreground italic">Aucun produit ajouté. Cliquez sur &quot;Ajouter&quot; pour commencer.</p>
                  </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Section Paramètres */}
          <Card className="border-none shadow-md overflow-hidden">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings className="w-5 h-5 text-primary" /> Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
               <div className="space-y-2">
                <label className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
                  <ShieldCheck className="w-3 h-3" /> Commercial
                </label>
                <Controller
                  name="gestionnaireId"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="null">Aucun</SelectItem>
                        {gestionnaires.map((g) => <SelectItem key={g.id} value={g.id}>{g.prenom} {g.nom}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
                    <Coins className="w-3 h-3" /> Devise
                    </label>
                    <Controller
                    name="devise"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{DEVISE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                    )}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
                    <Percent className="w-3 h-3" /> Acompte
                    </label>
                    <Controller
                    name="paymentConditionPercentage"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={(v) => field.onChange(Number(v))} defaultValue={String(field.value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((v) => <SelectItem key={v} value={String(v)}>{v}%</SelectItem>)}
                        </SelectContent>
                        </Select>
                    )}
                    />
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl flex items-center justify-between border">
                <div className="space-y-0.5">
                    <label className="text-sm font-bold text-slate-700">TVA 18%</label>
                    <p className="text-[10px] text-muted-foreground">Appliquer ou exonérer</p>
                </div>
                <Controller
                    name="isTaxExempt"
                    control={control}
                    render={({ field }) => (
                        <div className="flex items-center gap-2">
                            <Badge variant={field.value ? "destructive" : "default"} className="text-[8px] uppercase">{field.value ? "Exonéré" : "Appliquée"}</Badge>
                            <Switch checked={!field.value} onCheckedChange={(c) => field.onChange(!c)} />
                        </div>
                    )}
                />
              </div>

              <div className="p-4 bg-slate-50 rounded-xl space-y-3 border">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-bold text-slate-700">Remise</label>
                    <p className="text-[10px] text-muted-foreground">Déduire un montant du Total HT</p>
                  </div>
                  <Controller
                    name="isDiscountEnabled"
                    control={control}
                    render={({ field }) => (
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    )}
                  />
                </div>
                {watchedIsDiscountEnabled && (
                  <div className="flex gap-2">
                    <Controller
                      name="discountType"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {DISCOUNT_TYPE_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      {...register("discountValue")}
                      placeholder={watchedDiscountType === "MONTANT" ? watchedDevise : "%"}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Section Totaux */}
          <Card className="border-none shadow-lg bg-primary text-primary-foreground overflow-hidden">
            <CardHeader className="pb-2 border-b border-white/10">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calculator className="w-5 h-5" /> Récapitulatif
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {watchedIsDiscountEnabled && discountAmount > 0 && (
                <div className="flex justify-between items-center text-sm text-red-200">
                  <span>Remise {watchedDiscountType === "POURCENTAGE" ? `(${watchedDiscountValue || 0}%)` : ""}</span>
                  <span className="font-mono">− {discountAmount.toLocaleString()} {watchedDevise}</span>
                </div>
              )}
              <div className="flex justify-between items-center opacity-80 text-sm">
                <span>Total HT</span>
                <span className="font-mono">
                  {watchedIsDiscountEnabled && discountAmount > 0 && (
                    <span className="line-through opacity-50 mr-2">{totalHT.toLocaleString()}</span>
                  )}
                  {totalHTApresRemise.toLocaleString()} {watchedDevise}
                </span>
              </div>
              <div className="flex justify-between items-center opacity-80 text-sm">
                <span>TVA (18%)</span>
                <span className="font-mono">{tva.toLocaleString()} {watchedDevise}</span>
              </div>
              <div className="pt-4 border-t border-white/20 flex justify-between items-end">
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold opacity-60">Total à payer</span>
                    <span className="text-3xl font-black tracking-tighter">{totalTTC.toLocaleString()} {watchedDevise}</span>
                </div>
                <Receipt className="w-8 h-8 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
