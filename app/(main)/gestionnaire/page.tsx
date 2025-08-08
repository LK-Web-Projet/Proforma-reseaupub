"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface Gestionnaire {
  id: string;
  nom: string;
  prenom: string;
  email: string;
}

export default function GestionnairesPage() {
  const [gestionnaires, setGestionnaires] = useState<Gestionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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
    return <div>Chargement...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Liste des Commerciaux</h1>
        {/* Vous pouvez ajouter un bouton pour créer un nouveau commercial ici si nécessaire */}
        <Button onClick={() => router.push("/gestionnaire/new")}>
          Ajouter un commercial
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {gestionnaires.map((g) => (
          <Link key={g.id} href={`/gestionnaire/${g.id}`} passHref>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle>
                  {g.prenom} {g.nom}
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
