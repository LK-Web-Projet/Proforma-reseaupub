import FactureForm from "@/components/FactureForm";

export default function NewFacturePage() {
  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Créer une nouvelle facture</h1>
      <FactureForm />
    </div>
  );
}
