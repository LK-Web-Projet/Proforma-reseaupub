"use client";

import FactureForm from "@/components/FactureForm";
import { useDroits } from "@/components/DroitsProvider";

export default function NewFacturePage() {
  const { peut, charge } = useDroits();
  if (charge && !peut("proforma.creer")) {
    return (
      <div className="max-w-6xl mx-auto text-center py-20 text-muted-foreground">
        Votre rôle n&apos;a pas le droit de créer une proforma.
      </div>
    );
  }
  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Créer une nouvelle facture</h1>
      {charge && <FactureForm />}
    </div>
  );
}
