/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

type Facture = {
  id: string;
  numero: string;
  dateCreation: string;
  objet: string;
  statut: "Brouillon" | "Envoyer" | "Valider" | "Annuler" | "Archiver";
  totalHT: number;
  tva: number;
  totalTTC: number;
  societeNom: string;
  societeIFU: string;
  societeAdresse?: string;
  devise: "XOF" | "EUR" | "USD";
  client: {
    nom: string;
    email?: string;
    telephone?: string;
    adresse?: string;
    ifu?: string;
  };
  produits: Array<{
    id: string;
    produitId: string;
    designation: string;
    quantite: number;
    prixUnitaire: number; // changer en number
    duree?: number; // changer en number
    uniteDuree?: "jour" | "heure" | "mois";
    montantTotal: number; // changer en number
    includeduree?: boolean;
  }>;

  gestionnaires: Array<{
    gestionnaire: { prenom: string; nom: string };
  }>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const computeLineTotal = (p: any) => {
    const quantite = Number(p.quantite) || 0;
    const prixUnitaire = Number(p.prixUnitaire) || 0;
    const duree = Number(p.duree) || 1;
    const inclureDuree = p.includeduree ?? false;
    return inclureDuree
        ? quantite * prixUnitaire * duree
        : quantite * prixUnitaire;
};


export default function FactureDetailPage() {
  const { id } = useParams();
  const [facture, setFacture] = useState<Facture | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<"success" | "error" | null>(
    null
  );
  const [updateStatus, setUpdateStatus] = useState<"success" | "error" | null>(
    null
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<Facture>>({});

  useEffect(() => {
    async function fetchFacture() {
      setLoading(true);
      const res = await fetch(`/api/factures/${id}`);
      const data = await res.json();
      setFacture(data.error ? null : data);
      setFormData(data.error ? {} : data);
      setLoading(false);
    }
    if (id) fetchFacture();
  }, [id]);

  const handleSendEmail = async () => {
    setIsSending(true);
    setSendStatus(null);
    try {
      const response = await fetch(`/api/factures/${id}/send-email`, {
        method: "POST",
      });
      if (response.ok) {
        setSendStatus("success");
      } else {
        setSendStatus("error");
      }
    } catch (error) {
      setSendStatus("error");
    } finally {
      setIsSending(false);
    }
  };

  const handleUpdateFacture = async () => {
    if (!formData) return;
    setIsSaving(true);

    const totalHT = formData.produits?.reduce((acc, p) => acc + computeLineTotal(p), 0) || 0;
    const tva = totalHT * 0.18;
    const totalTTC = totalHT + tva;

    const updatedData = {
        ...formData,
        totalHT,
        tva,
        totalTTC,
        produits: formData.produits?.map(p => ({...p, montantTotal: computeLineTotal(p)}))
    }

    try {
      const res = await fetch(`/api/factures/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData),
      });

      if (res.ok) {
        const data = await res.json();
        setFacture(data);
        setFormData(data);
        setIsEditing(false);
        setUpdateStatus("success");
        setTimeout(() => setUpdateStatus(null), 3000);
      } else {
        const errorData = await res.json();
        console.error("Failed to update facture:", errorData);
        setUpdateStatus("error");
        setTimeout(() => setUpdateStatus(null), 3000);
      }
    } catch (error) {
      console.error("Failed to update facture:", error);
      setUpdateStatus("error");
      setTimeout(() => setUpdateStatus(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleProductChange = (index: number, e: React.ChangeEvent<HTMLInputElement> | { target: { name: string; value: string } }) => {
    const { name, value } = e.target;
    const produits = [...(formData.produits || [])];
    const isNumeric = (e.target as HTMLInputElement).type === 'number';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    produits[index] = { ...produits[index], [name]: isNumeric ? parseFloat(value) : value } as any;
    setFormData((prev) => ({ ...prev, produits }));
  };

  const handleProductSwitchChange = (index: number, name: string, value: boolean) => {
    const produits = [...(formData.produits || [])];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    produits[index] = { ...produits[index], [name]: value } as any;
    setFormData((prev) => ({ ...prev, produits }));
  };

  if (loading) return <div className="flex justify-center items-center h-96">Chargement...</div>;
  if (!facture) return <div className="text-center text-red-500 mt-10">Facture non trouvée.</div>;

  const displayTotalHT = isEditing ? formData.produits?.reduce((acc, p) => acc + computeLineTotal(p), 0) || 0 : facture.totalHT;
  const displayTVA = isEditing ? displayTotalHT * 0.18 : facture.tva;
  const displayTotalTTC = isEditing ? displayTotalHT + displayTVA : facture.totalTTC;
  const displayDevise = isEditing ? formData.devise : facture.devise;

  return (
    <div className="max-w-3xl mx-auto bg-white shadow-lg rounded-lg p-8 my-10">
      {/* En-tête facture */}
      <div className="flex justify-between items-center mb-8 border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold text-primary mb-2">
            Facture Proforma
          </h1>
          <div className="text-gray-600">
            N° <span className="font-mono">{facture.numero}</span>
          </div>
          <div className="text-sm text-gray-500">
            Date : {new Date(facture.dateCreation).toLocaleDateString("fr-FR")}
          </div>
        </div>
        <div className="text-right">
          {isEditing ? (
            <div className="flex gap-2">
            <Select
              name="statut"
              value={formData.statut}
              onValueChange={(value) =>
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setFormData((prev) => ({ ...prev, statut: value as any }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Brouillon">Brouillon</SelectItem>
                <SelectItem value="Envoyer">Envoyer</SelectItem>
                <SelectItem value="Valider">Valider</SelectItem>
                <SelectItem value="Annuler">Annuler</SelectItem>
                <SelectItem value="Archiver">Archiver</SelectItem>
              </SelectContent>
            </Select>
            <Select
              name="devise"
              value={formData.devise}
              onValueChange={(value) =>
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setFormData((prev) => ({ ...prev, devise: value as any }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Devise" />
              </SelectTrigger>
              <SelectContent>
                    <SelectItem value="XOF">XOF (Franc CFA)</SelectItem>
                    <SelectItem value="EUR">EUR (Euro)</SelectItem>
                    <SelectItem value="USD">USD (Dollar)</SelectItem>
              </SelectContent>
            </Select>
            </div>
          ) : (
            <Badge
              className="text-md"
              variant={
                facture.statut === "Envoyer"
                  ? "envoyer"
                  : facture.statut === "Valider"
                  ? "valider"
                  : facture.statut === "Annuler"
                  ? "annuler"
                  : facture.statut === "Archiver"
                  ? "archiver"
                  : "default" // Fallback to "default" if no match
              }
            >
              {facture.statut.toUpperCase()}
            </Badge>
          )}
        </div>
        <div className="text-right">
          <Button onClick={() => setIsEditing(!isEditing)} variant="outline">
            {isEditing ? "Annuler" : "Modifier"}
          </Button>
        </div>
      </div>

      {/* Société & Client */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div>
          <h2 className="font-semibold text-lg mb-2 text-primary">Émetteur</h2>
          <div className="font-bold">{facture.societeNom}</div>
          <div>IFU : {facture.societeIFU}</div>
          {facture.societeAdresse && (
            <div>Adresse : {facture.societeAdresse}</div>
          )}
        </div>
        <div>
          <h2 className="text-lg  text-primary font-bold underline">Client</h2>
          <div className="font-medium">
            Nom : {facture.client?.nom ?? "Client non défini"}
          </div>
          {facture.client?.email ? (
            <div className="font-medium">Email : {facture.client.email}</div>
          ) : (
            <div className="font-medium">Email : email non défini</div>
          )}
          <div className="commercial items-center flex flex-wrap gap-2">
            <h2 className="font-bold underline text-lg text-primary">
              Commercial :
            </h2>
            <div className="font-medium">
              {facture.gestionnaires?.length > 0
                ? facture.gestionnaires
                    .map((g) =>
                        `${g.gestionnaire?.prenom} ${g.gestionnaire?.nom}`
                    )
                    .join(", ")
                : "-"}
            </div>
          </div>
        </div>
      </div>

      {/* Objet */}
      <div className="mb-6">
        <span className="font-semibold text-primary">Objet :</span>{" "}
        {facture.objet}
      </div>

      {/* Tableau des produits/services */}
      <div className="overflow-x-auto mb-8">
        <table className="min-w-full border rounded">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left">Désignation</th>
              <th className="px-4 py-2 text-center">Qté</th>
              <th className="px-4 py-2 text-right">Prix U.</th>
              <th className="px-4 py-2 text-center">Durée</th>
              <th className="px-4 py-2 text-center">Unité</th>
              <th className="px-4 py-2 text-center">Inclure Durée</th>
              <th className="px-4 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(isEditing ? formData.produits : facture.produits)?.map((p, index) => (
                  <tr key={p.id} className="border-b">
                    <td className="px-4 py-2">
                      {isEditing ? (
                        <Input
                          name="designation"
                          value={p.designation}
                          onChange={(e) => handleProductChange(index, e)}
                        />
                      ) : (
                        p.designation
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {isEditing ? (
                        <Input
                          name="quantite"
                          type="number"
                          value={p.quantite}
                          onChange={(e) => handleProductChange(index, e)}
                        />
                      ) : (
                        p.quantite
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {isEditing ? (
                        <Input
                          name="prixUnitaire"
                          type="number"
                          value={p.prixUnitaire}
                          onChange={(e) => handleProductChange(index, e)}
                        />
                      ) : (
                        Number(p.prixUnitaire).toLocaleString("fr-FR", {
                          style: "currency",
                          currency: displayDevise,
                        })
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {isEditing ? (
                        <Input
                          name="duree"
                          type="number"
                          value={p.duree}
                          onChange={(e) => handleProductChange(index, e)}
                        />
                      ) : (
                        p.duree ?? "-"
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {isEditing ? (
                        <Select
                          name="uniteDuree"
                          value={p.uniteDuree}
                          onValueChange={(value) =>
                            handleProductChange(index, {
                              target: { name: "uniteDuree", value },
                              // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            } as any)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Unité" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="jour">Jour</SelectItem>
                            <SelectItem value="heure">Heure</SelectItem>
                            <SelectItem value="mois">Mois</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        p.uniteDuree ?? "-"
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <Switch
                        checked={p.includeduree}
                        disabled={!isEditing}
                        onCheckedChange={(value) =>
                          handleProductSwitchChange(index, "includeduree", value)
                        }
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      {isEditing
                        ? computeLineTotal(p).toLocaleString("fr-FR", {
                            style: "currency",
                            currency: displayDevise,
                          })
                        : Number(p.montantTotal).toLocaleString("fr-FR", {
                            style: "currency",
                            currency: displayDevise,
                          })}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {/* Bouton PDF */}
      <div className="flex justify-end mb-6 space-x-2">
        <a
          href={`/api/factures/${id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded shadow hover:bg-primary/80 transition"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Télécharger PDF
        </a>
        <button
          onClick={handleSendEmail}
          disabled={isSending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded shadow hover:bg-blue-600 transition disabled:bg-blue-300"
        >
          {isSending ? "Envoi en cours..." : "Envoyer par e-mail"}
        </button>
        {isEditing && (
          <Button onClick={handleUpdateFacture} disabled={isSaving}>
            {isSaving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        )}
      </div>
      {sendStatus === "success" && (
        <p className="text-green-500 text-right">E-mail envoyé avec succès!</p>
      )}
      {sendStatus === "error" && (
        <p className="text-red-500 text-right">
          Erreur lors de l&apos;envoi de l&apos;e-mail.
        </p>
      )}
      {updateStatus === "success" && (
        <p className="text-green-500 text-right">
          Facture mise à jour avec succès!
        </p>
      )}
      {updateStatus === "error" && (
        <p className="text-red-500 text-right">
          Erreur lors de la mise à jour de la facture.
        </p>
      )}

      {/* Totaux */}
      <div className="flex flex-col items-end gap-2 mb-8">
        <div>
          Total HT :{" "}
          <span className="font-semibold">
            {Number(displayTotalHT).toLocaleString("fr-FR", {
              style: "currency",
              currency: displayDevise,
            })}
          </span>
        </div>
        <div>
          TVA (18%) :{" "}
          <span className="font-semibold">
            {Number(displayTVA).toLocaleString("fr-FR", {
              style: "currency",
              currency: displayDevise,
            })}
          </span>
        </div>
        <div className="text-xl font-bold text-primary">
          Total TTC :{" "}
          {Number(displayTotalTTC).toLocaleString("fr-FR", {
            style: "currency",
            currency: displayDevise,
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="text-xs text-gray-400 text-center pt-4 border-t">
        Facture générée le{" "}
        {new Date(facture.dateCreation).toLocaleDateString("fr-FR")} &mdash;
        Proforma Générateur
      </div>
    </div>
  );
}