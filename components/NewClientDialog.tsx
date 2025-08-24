"use client";

import { useState, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface NewClientDialogProps {
  onClientCreated: (client: { id: string; nom: string }) => void;
  setIsOpen: (isOpen: boolean) => void;
}

export function NewClientDialog({ onClientCreated, setIsOpen }: NewClientDialogProps) {
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [adresse, setAdresse] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom, email, telephone, adresse }),
      });

      if (!res.ok) {
        throw new Error("La création du client a échoué");
      }

      const newClient = await res.json();
      toast.success("Client créé avec succès!");
      onClientCreated(newClient);
      setIsOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Impossible de créer le client.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Créer un nouveau client</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="nom-dialog">Nom de l&apos;entreprise</label>
          <Input
            id="nom-dialog"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="email-dialog">Email</label>
          <Input
            id="email-dialog"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="telephone-dialog">Téléphone</label>
          <Input
            id="telephone-dialog"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="adresse-dialog">Adresse</label>
          <Input
            id="adresse-dialog"
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Annuler
            </Button>
          </DialogClose>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Création en cours..." : "Créer le client"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
