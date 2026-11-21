"use client";

import React, { useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next-nprogress-bar";
import { useDroits } from "@/components/DroitsProvider";

// Schéma de validation avec Zod
const schema = z.object({
  prenom: z.string().min(1, "Le prénom est requis."),
  nom: z.string().min(1, "Le nom est requis."),
  email: z.string().email("Adresse email invalide."),
  telephone: z.string().optional(),
});

type GestionnaireFormType = z.infer<typeof schema>;

export default function NewGestionnairePage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { peut, charge } = useDroits();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GestionnaireFormType>({
    resolver: zodResolver(schema),
  });

  const onSubmit: SubmitHandler<GestionnaireFormType> = async (data) => {
    setLoading(true);
    try {
      const res = await fetch("/api/gestionnaires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Une erreur est survenue.");
      }

      toast.success("Gestionnaire ajouté avec succès !");
      router.push("/gestionnaire"); // Redirige vers la liste des gestionnaires
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (charge && !peut("commercial.creer")) {
    return (
      <div className="container mx-auto p-4 text-center py-20 text-muted-foreground">
        Votre rôle n&apos;a pas le droit de créer un commercial.
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 flex justify-center">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Ajouter un nouveau Commercial</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="prenom">Prénom</label>
              <Input id="prenom" {...register("prenom")} />
              {errors.prenom && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.prenom.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="nom">Nom</label>
              <Input id="nom" {...register("nom")} />
              {errors.nom && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.nom.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="email">Email</label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="telephone">Téléphone (Optionnel)</label>
              <Input id="telephone" {...register("telephone")} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={loading} disabled={loading}>
                {loading ? "Ajout en cours..." : "Ajouter le commercial"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
