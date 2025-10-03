/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, Receipt, Upload, Trash2, PlusCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { DEVISE_OPTIONS, STATUT_FACTURE_OPTIONS, UNITE_DUREE_OPTIONS, StatutFacture, UniteDuree, Devise } from "@/lib/constants";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner"; // Import toast

type Paiement = {
  id: string;
  montant: number;
  datePaiement: string;
  methode?: string | null;
  reference?: string | null;
  notes?: string | null;
  cashJournalEntry?: {
    attachments: {
      id: string;
      url: string;
      fileName: string;
    }[];
  } | null;
};

type Facture = {
  id: string;
  numero: string;
  dateCreation: string;
  objet: string;
  statut: StatutFacture;
  totalHT: number;
  tva: number;
  totalTTC: number;
  resteAPayer: number;
  paiements: Paiement[];
  societeNom: string;
  societeIFU: string;
  societeAdresse?: string;
  devise: Devise;
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
    prixUnitaire: number;
    duree?: number;
    uniteDuree?: UniteDuree;
    montantTotal: number;
    includeduree?: boolean;
  }>;
  gestionnaires: Array<{
    gestionnaire: { prenom: string; nom: string };
  }>;
  bonCommande: { url: string } | null;
  factureNormaliser: { url: string } | null;
  paymentConditionPercentage?: number | null;
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

  const [bonCommandeFile, setBonCommandeFile] = useState<File | undefined>();
  const [factureNormaliseeFile, setFactureNormaliseeFile] = useState<File | undefined>();
  const [isUploadingBon, setIsUploadingBon] = useState(false);
  const [isUploadingFacture, setIsUploadingFacture] = useState(false);
  const [isDeletingBon, setIsDeletingBon] = useState(false);
  const [isDeletingFacture, setIsDeletingFacture] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [fileToDeleteType, setFileToDeleteType] = useState<'bon' | 'facture' | null>(null);

  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [newPayment, setNewPayment] = useState({ montant: 0, methode: 'Virement', datePaiement: new Date().toISOString().split('T')[0], reference: '', notes: '' });
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const [cashRegisters, setCashRegisters] = useState<{id: number, name: string}[]>([]);
  const [selectedCashRegisterId, setSelectedCashRegisterId] = useState<string>('');
  const [paymentFiles, setPaymentFiles] = useState<FileList | null>(null);

  const fetchFacture = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const res = await fetch(`/api/factures/${id}`);
    const data = await res.json();
    setFacture(data.error ? null : data);
    setFormData(data.error ? {} : data);

    // Fetch cash registers
    const cashRes = await fetch('/api/cash-journal');
    const cashData = await cashRes.json();
    setCashRegisters(cashData.cashRegisters || []);
    if (cashData.cashRegisters?.length > 0) {
      setSelectedCashRegisterId(cashData.cashRegisters[0].id.toString());
    }

    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchFacture();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleFileUpload = async (type: 'bon' | 'facture') => {
    const file = type === 'bon' ? bonCommandeFile : factureNormaliseeFile;
    if (!file) return;

    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    type === 'bon' ? setIsUploadingBon(true) : setIsUploadingFacture(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    try {
      const res = await fetch(`/api/factures/${id}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        await fetchFacture(); // Refresh data
      } else {
        console.error(`Failed to upload ${type}`);
      }
    } catch (error) {
      console.error(`Failed to upload ${type}:`, error);
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      type === 'bon' ? setIsUploadingBon(false) : setIsUploadingFacture(false);
    }
  };

  // Modified to open dialog
  const handleFileDelete = (type: 'bon' | 'facture') => {
    setFileToDeleteType(type);
    setIsDialogOpen(true);
  };

  // New function for actual deletion after confirmation
  const confirmDeleteFile = async () => {
    if (!fileToDeleteType) return;

    const type = fileToDeleteType;
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    type === 'bon' ? setIsDeletingBon(true) : setIsDeletingFacture(true);
    setIsDialogOpen(false); // Close dialog immediately

    try {
      const res = await fetch(`/api/factures/${id}/upload?type=${type}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchFacture(); // Refresh data
      } else {
        console.error(`Failed to delete ${type}`);
      }
    } catch (error) {
      console.error(`Failed to delete ${type}:`, error);
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      type === 'bon' ? setIsDeletingBon(false) : setIsDeletingFacture(false);
      setFileToDeleteType(null); // Reset
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

  const handleAddPayment = async () => {
    if (!newPayment.montant || newPayment.montant <= 0) {
      setPaymentError("Le montant doit être supérieur à zéro.");
      return;
    }
    if (facture && newPayment.montant > facture.resteAPayer) {
      setPaymentError(`Le montant du paiement ne peut pas dépasser le reste à payer.`);
      return;
    }

    setIsAddingPayment(true);
    setPaymentError(null);

    const formData = new FormData();
    const paymentData = {
      montant: Number(newPayment.montant),
      methode: newPayment.methode,
      reference: newPayment.reference,
      notes: newPayment.notes,
      datePaiement: newPayment.datePaiement ? new Date(newPayment.datePaiement) : undefined,
      cashRegisterId: newPayment.methode === 'Espèces' ? 1 : parseInt(selectedCashRegisterId, 10),
    };
    formData.append('paymentData', JSON.stringify(paymentData));

    if (paymentFiles) {
      Array.from(paymentFiles).forEach(file => {
        formData.append('files', file);
      });
    }

    try {
      const res = await fetch(`/api/factures/${id}/paiements`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setIsPaymentDialogOpen(false);
        setNewPayment({ montant: 0, methode: 'Virement', datePaiement: new Date().toISOString().split('T')[0], reference: '', notes: '' });
        setPaymentFiles(null);
        await fetchFacture();
        toast.success("Paiement enregistré avec succès !");
      } else {
        const err = await res.json();
        setPaymentError(err.error || "Une erreur est survenue.");
      }
    } catch (error) {
      setPaymentError("Une erreur réseau est survenue.");
    } finally {
      setIsAddingPayment(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-96">Chargement...</div>;
  if (!facture) return <div className="text-center text-red-500 mt-10">Facture non trouvée.</div>;

  const displayTotalHT = isEditing ? formData.produits?.reduce((acc, p) => acc + computeLineTotal(p), 0) || 0 : facture.totalHT;
  const displayTVA = isEditing ? displayTotalHT * 0.18 : facture.tva;
  const displayTotalTTC = isEditing ? displayTotalHT + displayTVA : facture.totalTTC;
  const displayDevise = isEditing ? formData.devise : facture.devise;

  return (
    <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-lg p-8 my-10">
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
              {!facture.bonCommande && (
                <Select
                  name="statut"
                  value={formData.statut}
                  onValueChange={(value) =>
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    setFormData((prev) => ({ ...prev, statut: value as any }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Statut"   />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUT_FACTURE_OPTIONS.filter(option => ["Envoyer", "Annuler"].includes(option.value)).map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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
                  {DEVISE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                name="paymentConditionPercentage"
                value={String(formData.paymentConditionPercentage ?? 0)}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, paymentConditionPercentage: Number(value) }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Acompte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Aucun acompte</SelectItem>
                  <SelectItem value="50">50%</SelectItem>
                  <SelectItem value="70">70%</SelectItem>
                  <SelectItem value="100">100%</SelectItem>
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
                  : facture.statut === "Payer"
                  ? "payer" // Using 'valider' style for 'Payer'
                  : facture.statut === "Solde" // NEW STATUS
                  ? "success" // Assuming 'success' variant for 'Solde' or similar
                  : "default"
              }
            >
              {facture.statut.toUpperCase()}
            </Badge>
          )}
        </div>
        <div className="text-right">
          {!facture.bonCommande && !facture.factureNormaliser && (
            <Button onClick={() => setIsEditing(!isEditing)} variant="outline">
              {isEditing ? "Annuler" : "Modifier"}
            </Button>
          )}
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
            <div className="font-medium text-red-500">Email : email non défini</div>
          )}
          <div className="commercial items-center flex flex-wrap gap-2">
            <h2 className="font-bold underline text-lg text-primary">
              Commercial :
            </h2>
            <div className="font-medium">
              {facture.gestionnaires?.length > 0
                ? facture.gestionnaires
                    .map(
                      (g) => `${g.gestionnaire?.prenom} ${g.gestionnaire?.nom}`
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
        {isEditing ? (
          <Input
            name="objet"
            value={formData.objet}
            onChange={handleInputChange}
            placeholder="Ex: Prestation de services"
          />
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="truncate max-w-xs inline-block align-bottom">
                  {facture.objet}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{facture.objet}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {facture.paymentConditionPercentage && facture.paymentConditionPercentage > 0 && !isEditing && (
        <div className="mb-6">
          <span className="font-semibold text-primary">Condition de paiement :</span>{" "}
          {`Un acompte de ${facture.paymentConditionPercentage}% du montant total de la facture est exigé avant le démarrage de la prestation`}
        </div>
      )}

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
            {(isEditing ? formData.produits : facture.produits)?.map(
              (p, index) => (
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
                          {UNITE_DUREE_OPTIONS.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
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
              )
            )}
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
        <div className={`text-lg font-bold ${facture.resteAPayer > 0 ? 'text-orange-600' : 'text-green-600'}`}>
          Reste à Payer :{" "}
          {Number(facture.resteAPayer).toLocaleString("fr-FR", {
            style: "currency",
            currency: displayDevise,
          })}
        </div>
      </div>

      {/* Historique des Paiements */}
      <div className="mt-8 border-t pt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-primary">Historique des Paiements</h2>
          {facture.resteAPayer > 0 && (
            <Button onClick={() => setIsPaymentDialogOpen(true)}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Ajouter un paiement
            </Button>
          )}
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Méthode</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Preuves</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {facture.paiements && facture.paiements.length > 0 ? (
                  facture.paiements.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{new Date(p.datePaiement).toLocaleDateString('fr-FR')}</TableCell>
                      <TableCell>{p.methode || '-'}</TableCell>
                      <TableCell>{p.reference || '-'}</TableCell>
                      <TableCell className="text-right font-medium">
                        {Number(p.montant).toLocaleString("fr-FR", {
                          style: "currency",
                          currency: displayDevise,
                        })}
                      </TableCell>
                      <TableCell>
                        {p.cashJournalEntry?.attachments && p.cashJournalEntry.attachments.length > 0 ? (
                          <div className="flex flex-col">
                            {p.cashJournalEntry.attachments.map((att) => (
                              <a
                                key={att.id}
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:underline"
                              >
                                {att.fileName}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <span>-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500 py-4">
                      Aucun paiement enregistré.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Documents Associés */}
      <div className="mt-8 border-t pt-6">
        <h2 className="text-xl font-semibold text-primary mb-4">
          Documents Associés
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Bon de Commande Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 ">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-500" /> Bon de Commande
              </CardTitle>
            </CardHeader>
            <CardContent>
              {facture.bonCommande ? (
                <div className="flex items-center justify-around  border-3 rounded-lg p-2 bg-gray-900 cursor-pointer">
                  <a
                    href={`/Upload/Bon/${
                      facture.numero
                    }/${facture.bonCommande.url.split("/").pop()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-100 font-bold flex items-center gap-1 h-full hover:text-pink-400"
                  >
                    <FileText className="h-4 w-4" /> Voir le bon de commande
                  </a>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleFileDelete("bon")}
                    disabled={isDeletingBon}
                  >
                    {isDeletingBon ? "..." : <Trash2 className="h-4 w-4" />}{" "}
                    {isDeletingBon ? "" : ""}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx,image/*,.png,.jpeg,.jpg"
                    onChange={(e) => setBonCommandeFile(e.target.files?.[0])}
                  />
                  <Button
                    onClick={() => handleFileUpload("bon")}
                    disabled={!bonCommandeFile || isUploadingBon}
                  >
                    <Upload className="h-4 w-4 mr-1" />{" "}
                    {isUploadingBon ? "Chargement..." : "Uploader"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Facture Normalisée Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Receipt className="h-5 w-5 text-green-500" /> Facture
                (Normalisée , Chèque ,etc)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {facture.factureNormaliser ? (
                <div className="flex items-center justify-around  border-3 rounded-lg p-2 bg-gray-900 cursor-pointer">
                  <a
                    href={`/Upload/Facture/${
                      facture.numero
                    }/${facture.factureNormaliser.url.split("/").pop()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-100 font-bold flex items-center gap-1 h-full hover:text-pink-400"
                  >
                    <Receipt className="h-4 w-4" /> Voir la facture
                  </a>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleFileDelete("facture")}
                    disabled={isDeletingFacture}
                  >
                    {isDeletingFacture ? "..." : <Trash2 className="h-4 w-4" />}{" "}
                    {isDeletingFacture ? "" : ""}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx,image/*,.png,.jpeg,.jpg"
                    onChange={(e) =>
                      setFactureNormaliseeFile(e.target.files?.[0])
                    }
                  />
                  <Button
                    onClick={() => handleFileUpload("facture")}
                    disabled={!factureNormaliseeFile || isUploadingFacture}
                  >
                    <Upload className="h-4 w-4 mr-1" />{" "}
                    {isUploadingFacture ? "Chargement..." : "Uploader"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      {/* Footer */}
      <div className="text-xs text-gray-400 text-center pt-4 border-t">
        Facture générée le{" "}
        {new Date(facture.dateCreation).toLocaleDateString("fr-FR")} &mdash;
        Proforma Générateur
      </div>

      {/* Add Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un paiement</DialogTitle>
            <DialogDescription>
              Enregistrez un nouveau versement pour la facture {facture.numero}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="montant" className="text-right">Montant</label>
              <Input id="montant" type="number" value={newPayment.montant} onChange={(e) => setNewPayment({...newPayment, montant: parseFloat(e.target.value)})} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="datePaiement" className="text-right">Date</label>
              <Input id="datePaiement" type="date" value={newPayment.datePaiement} onChange={(e) => setNewPayment({...newPayment, datePaiement: e.target.value})} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="methode" className="text-right">Méthode</label>
              <Select value={newPayment.methode} onValueChange={(value) => setNewPayment({...newPayment, methode: value})}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Méthode de paiement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Virement">Virement</SelectItem>
                  <SelectItem value="Espèces">Espèces</SelectItem>
                  <SelectItem value="Chèque">Chèque</SelectItem>
                  <SelectItem value="MobileMoney">Mobile Money</SelectItem>
                  <SelectItem value="Autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newPayment.methode !== 'Espèces' && (
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="cashRegister" className="text-right">Caisse</label>
                <Select value={selectedCashRegisterId} onValueChange={setSelectedCashRegisterId}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Sélectionner une caisse" />
                  </SelectTrigger>
                  <SelectContent>
                    {cashRegisters.map(register => (
                      <SelectItem key={register.id} value={register.id.toString()}>
                        {register.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="files" className="text-right">Preuve(s)</label>
              <Input id="files" type="file" multiple onChange={(e) => setPaymentFiles(e.target.files)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="reference" className="text-right">Référence</label>
              <Select value={newPayment.reference} onValueChange={(value) => setNewPayment({...newPayment, reference: value})} >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Sélectionner une référence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Paiement Total">Paiement Total</SelectItem>
                  <SelectItem value="Avance">Avance</SelectItem>
                  <SelectItem value="1er tranche">1er tranche</SelectItem>
                  <SelectItem value="2eme Tranche">2eme Tranche</SelectItem>
                  <SelectItem value="3e tranche">3e tranche</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {paymentError && <p className="text-red-500 text-sm text-center">{paymentError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleAddPayment} disabled={isAddingPayment}>
              {isAddingPayment ? "Enregistrement..." : "Enregistrer le paiement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Deletion */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer ce fichier ? Cette action est
              irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annuler
              </Button>
            </DialogClose>
            <Button variant="destructive" onClick={confirmDeleteFile}>
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
