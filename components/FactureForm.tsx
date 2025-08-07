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
const productSchema = z.object({
  designation: z.string().min(1, "La désignation est requise.").default(""),
  quantite: z.coerce.number().min(1, "Qté. min. 1.").default(1),
  prixUnitaire: z.coerce
    .number()
    .min(0, "Le prix ne peut être négatif.")
    .default(0),
  duree: z.coerce.number().min(1, "Durée min. 1.").optional(),
  uniteDuree: z.enum(["jour", "heure", "mois"]).optional(),
  inclureDuree: z.boolean().default(false),
});

const schema = z.object({
  clientNom: z.string().min(1, "Le nom du client est requis."),
  objet: z.string().min(1, "L'objet de la facture est requis."),
  produits: z.array(productSchema).min(1, "Au moins un produit est requis."),
  gestionnaireId: z.string().optional(),
});

type FactureFormType = z.infer<typeof schema>;

const defaultProduct = {
  designation: "",
  quantite: 1,
  prixUnitaire: 0,
  duree: 1,
  uniteDuree: "jour" as const,
  inclureDuree: false,
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
        if (!res.ok) throw new Error("Erreur chargement clients");
        const data = await res.json();
        setClients(data);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        toast.error("Impossible de charger les clients.");
      }
    };

    const fetchProduits = async () => {
      try {
        const res = await fetch("/api/produits");
        if (!res.ok) throw new Error("Erreur chargement produits");
        const data = await res.json();
        setProduits(data);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        toast.error("Impossible de charger les produits.");
      }
    };

    const fetchGestionnaires = async () => {
      try {
        const res = await fetch("/api/gestionnaires");
        if (!res.ok) throw new Error("Erreur chargement gestionnaires");
        const data = await res.json();
        setGestionnaires(data);
      } catch (error) {
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
  } = useForm<FactureFormType>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientNom: "",
      objet: "",
      produits: [defaultProduct],
      gestionnaireId: "", // Ajout du champ gestionnaire
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "produits",
  });
  const watchedProduits = watch("produits");

  // --- Calculs des totaux ---
  const totalHT = watchedProduits.reduce((acc, p) => {
    const quantite = p.quantite || 0;
    const prix = p.prixUnitaire || 0;
    const duree = p.duree || 1;
    const inclureDuree = p.inclureDuree;

    let totalLigne = quantite * prix;
    if (inclureDuree) {
      totalLigne *= duree;
    }
    return acc + totalLigne;
  }, 0);

  const tva = totalHT * 0.18;
  const totalTTC = totalHT + tva;

  // --- Soumission du formulaire ---
  const onSubmit: SubmitHandler<FactureFormType> = async (data) => {
    // 🔹 Transformation de la valeur "none" en undefined
    if (data.gestionnaireId === "null") {
      data.gestionnaireId = undefined;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/factures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Une erreur est survenue.");
      }

      toast.success("Facture enregistrée avec succès !");
      router.push("/"); // Redirection vers la page d'accueil
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // --- Gestion de l'autocomplétion des produits ---
  const handleProductChange = (index: number, value: string) => {
    const selectedProduit = produits.find((p) => p.nom === value);
    setValue(`produits.${index}.designation`, value);
    if (selectedProduit) {
      setValue(`produits.${index}.prixUnitaire`, selectedProduit.prixUnitaire);
    } else {
      // Si le produit n'est pas dans la liste, on réinitialise le prix
      setValue(`produits.${index}.prixUnitaire`, 0);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* --- Section Client et Objet --- */}
      <Card>
        <CardHeader>
          <CardTitle>Informations Générales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="clientNom">Client</label>
            <Input
              id="clientNom"
              list="clients-list"
              {...register("clientNom")}
              placeholder="Saisir ou sélectionner un client"
              autoComplete="off"
            />
            <datalist id="clients-list">
              {clients.map((client) => (
                <option key={client.id} value={client.nom} />
              ))}
            </datalist>
            {errors.clientNom && (
              <p className="text-red-500 text-xs mt-1">
                {errors.clientNom.message}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="objet">Objet de la facture</label>
            <Input
              id="objet"
              {...register("objet")}
              placeholder="Ex: Prestation de services"
            />
            {
              <p className="text-red-500 text-xs mt-1">
                {errors.objet?.message}
              </p>
            }
          </div>
          {/* Gestionnaire */}
          <div>
            <label htmlFor="gestionnaireId">Gestionnaire (Optionnel)</label>
            <Controller
              name="gestionnaireId"
              control={control}
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un gestionnaire" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="null">Aucun</SelectItem>
                    {gestionnaires.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.prenom} {g.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* --- Section Produits / Services --- */}
      <Card>
        <CardHeader>
          <CardTitle>Produits / Services</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-2/5">Produit/Service</TableHead>
                <TableHead>Qté</TableHead>
                <TableHead>Prix U.</TableHead>
                <TableHead>Durée</TableHead>
                <TableHead>Unité</TableHead>
                <TableHead>Inclure Durée</TableHead>
                <TableHead>Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => (
                <TableRow key={field.id}>
                  {/* Désignation */}
                  <TableCell>
                    <Input
                      list={`produits-list-${index}`}
                      {...register(`produits.${index}.designation`)}
                      placeholder="Saisir ou rechercher un produit"
                      autoComplete="off"
                      onChange={(e) =>
                        handleProductChange(index, e.target.value)
                      }
                    />
                    <datalist id={`produits-list-${index}`}>
                      {produits.map((p) => (
                        <option key={p.id} value={p.nom} />
                      ))}
                    </datalist>
                    {errors.produits?.[index]?.designation && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.produits[index]?.designation?.message}
                      </p>
                    )}
                  </TableCell>
                  {/* Quantité */}
                  <TableCell>
                    <Input
                      type="number"
                      {...register(`produits.${index}.quantite`)}
                    />
                    {errors.produits?.[index]?.quantite && (
                      <p className="text-red-500 text-xs mt-1">
                        {errors.produits[index]?.quantite?.message}
                      </p>
                    )}
                  </TableCell>
                  {/* Prix Unitaire */}
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      {...register(`produits.${index}.prixUnitaire`)}
                    />
                  </TableCell>
                  {/* Durée */}
                  <TableCell>
                    <Input
                      type="number"
                      step="1"
                      {...register(`produits.${index}.duree`)}
                    />
                  </TableCell>
                  {/* Unité Durée */}
                  <TableCell>
                    <Controller
                      name={`produits.${index}.uniteDuree`}
                      control={control}
                      render={({ field }) => (
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="jour">Jour</SelectItem>
                            <SelectItem value="heure">Heure</SelectItem>
                            <SelectItem value="mois">Mois</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </TableCell>
                  {/* Inclure Durée */}
                  <TableCell>
                    <Controller
                      name={`produits.${index}.inclureDuree`}
                      control={control}
                      render={({ field }) => (
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                  </TableCell>
                  {/* Montant Total Ligne */}
                  <TableCell>
                    {(() => {
                      const {
                        quantite = 0,
                        prixUnitaire = 0,
                        duree = 1,
                        inclureDuree = false,
                      } = watchedProduits[index] || {};
                      let total = (quantite || 0) * (prixUnitaire || 0);
                      if (inclureDuree) {
                        total *= duree || 1;
                      }
                      return total.toFixed(2) + " XOF";
                    })()}
                  </TableCell>
                  {/* Bouton Supprimer */}
                  <TableCell>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => remove(index)}
                    >
                      X
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => append(defaultProduct)}
          >
            Ajouter une ligne
          </Button>
          {errors.produits && (
            <p className="text-red-500 text-xs mt-2">
              {errors.produits.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* --- Section Récapitulatif --- */}
      <Card>
        <CardHeader>
          <CardTitle>Récapitulatif</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span>Total HT</span>
            <span>{totalHT.toFixed(2)} XOF</span>
          </div>
          <div className="flex justify-between">
            <span>TVA (18%)</span>
            <span>{tva.toFixed(2)} XOF</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>Total TTC</span>
            <span>{totalTTC.toFixed(2)} XOF</span>
          </div>
        </CardContent>
      </Card>

      {/* --- Bouton de soumission --- */}
      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
              Enregistrement...
            </span>
          ) : (
            "Enregistrer la facture"
          )}
        </Button>
      </div>
    </form>
  );
}
