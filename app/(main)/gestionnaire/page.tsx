"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next-nprogress-bar";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { GestionnaireCardSkeleton } from "@/components/GestionnaireCardSkeleton";
import { Badge } from "@/components/ui/badge";
import { useDroits } from "@/components/DroitsProvider";
import { cn } from "@/lib/utils";

interface Gestionnaire {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  actif?: boolean;
}

export default function GestionnairesPage() {
  const [gestionnaires, setGestionnaires] = useState<Gestionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { peut } = useDroits();
  const boutonAjout = peut("commercial.creer") && (
    <Button onClick={() => router.push("/gestionnaire/new")}>Ajouter un commercial</Button>
  );

  useEffect(() => {
    const fetchGestionnaires = async () => {
      try {
        const res = await fetch("/api/gestionnaires");
        if (!res.ok) {
          throw new Error("Erreur lors du chargement des commerciaux.");
        }
        const data = await res.json();
        setGestionnaires(data);
      } catch (error) {
        toast.error((error as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchGestionnaires();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Liste des Commerciaux</h1>
          {boutonAjout}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <GestionnaireCardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Liste des Commerciaux</h1>
        {boutonAjout}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...gestionnaires].sort((a, b) => Number(b.actif !== false) - Number(a.actif !== false)).map((g) => (
          <Link key={g.id} href={`/gestionnaire/${g.id}`} passHref>
            <Card className={cn("cursor-pointer hover:shadow-lg transition-shadow", g.actif === false && "opacity-60")}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="truncate">{g.prenom} {g.nom}</span>
                  {g.actif === false && <Badge variant="outline" className="font-normal shrink-0">Inactif</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">{g.email}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
