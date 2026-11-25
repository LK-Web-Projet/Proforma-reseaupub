"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ChevronLeft, ShieldCheck, Plus, Pencil } from "lucide-react";
import { PAGE_LABELS, PageKey, permissionsCoherentes } from "@/lib/permissions";
import { useDroits } from "@/components/DroitsProvider";

type TypeBudgetValue = "MENSUEL" | "PONCTUEL" | "CAMPAGNE" | "TIERS";
const TYPES_BUDGET: { value: TypeBudgetValue; label: string }[] = [
  { value: "CAMPAGNE", label: "Budgets de campagne" },
  { value: "MENSUEL", label: "Budgets mensuels" },
  { value: "PONCTUEL", label: "Budgets ponctuels" },
  { value: "TIERS", label: "Budgets pour un tiers" },
];

interface Role {
  id: string;
  nom: string;
  canManageUsers: boolean;
  canValidateBudgetMensuel: boolean;
  canValidateBudget: boolean;
  canPayBudget: boolean;
  canSaisirCaisse: boolean;
  canSaisirPetiteDepense: boolean;
  pages: PageKey[];
  permissions?: string[];
  nombreUtilisateurs: number;
}

type BudgetFlag = "canValidateBudgetMensuel" | "canValidateBudget" | "canPayBudget" | "canSaisirCaisse" | "canSaisirPetiteDepense";

// Droits du circuit budget : cochables sur n'importe quel rôle (aucun nom de rôle codé en dur).
const BUDGET_FLAGS: { key: BudgetFlag; label: string; short: string; description: string }[] = [
  {
    key: "canValidateBudgetMensuel",
    label: "Valider les budgets mensuels, de campagne et au-dessus du plafond",
    short: "Valid. admin",
    description: "Niveau administrateur : budgets mensuels, budgets de campagne, budgets dépassant le plafond délégué. Peut ouvrir un commentaire sur une ligne.",
  },
  {
    key: "canValidateBudget",
    label: "Valider les budgets (hors mensuels et campagne)",
    short: "Valid. déléguée",
    description: "Budgets ponctuels et pour tiers, jusqu'au plafond délégué (ex. Assistant-Direction).",
  },
  {
    key: "canPayBudget",
    label: "Enregistrer les dépenses de budget",
    short: "Dépenses",
    description: "Comptable : enregistre les dépenses dans le journal de caisse, clôture les budgets, ouvre des commentaires.",
  },
  {
    key: "canSaisirCaisse",
    label: "Saisir au journal de caisse (hors budget)",
    short: "Caisse",
    description: "Opérations manuelles, transferts entre caisses, création de caisses, dépenses imputées à une proforma. Sans ce droit, l'argent ne sort que par le circuit budget.",
  },
  {
    key: "canSaisirPetiteDepense",
    label: "Saisir les petites dépenses (espèces, plafonnées)",
    short: "Petites dép.",
    description: "Accueil : réparations, imprévus… sur une ligne de budget, en espèces, jusqu'au maximum réglé ci-dessous. Ne paie ni bon de commande ni facture.",
  },
];

export default function RolesPage() {
  const { peut, charge } = useDroits();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [plafond, setPlafond] = useState("");
  const [isSavingPlafond, setIsSavingPlafond] = useState(false);
  const [typesSigne, setTypesSigne] = useState<TypeBudgetValue[]>([]);
  const [plafondPetite, setPlafondPetite] = useState("");
  const [liasseExigee, setLiasseExigee] = useState(true);
  const [isSavingDepenses, setIsSavingDepenses] = useState(false);
  const [isSavingTypesSigne, setIsSavingTypesSigne] = useState(false);
  // Délais de paiement des factures prestataires, selon le type (jours après la date de la facture).
  const [delais, setDelais] = useState({ fournisseur: "", interne: "", externe: "" });
  const [isSavingDelais, setIsSavingDelais] = useState(false);
  // Délai de relance proposé pour une facture normalisée envoyée au client.
  const [delaiRelance, setDelaiRelance] = useState("");
  const [isSavingRelance, setIsSavingRelance] = useState(false);

  useEffect(() => {
    fetch("/api/budget-config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setPlafond(String(data.plafondValidationDeleguee));
        setTypesSigne(data.typesBudgetSigneRequis ?? []);
        setPlafondPetite(String(data.plafondPetiteDepense ?? ""));
        setLiasseExigee(data.liasseExigeePourSolde ?? true);
        if (data.delaiRelanceFactureClient) setDelaiRelance(String(data.delaiRelanceFactureClient));
        if (data.delaisPaiement) {
          setDelais({
            fournisseur: String(data.delaisPaiement.fournisseur),
            interne: String(data.delaisPaiement.interne),
            externe: String(data.delaisPaiement.externe),
          });
        }
      })
      .catch(() => undefined);
  }, []);

  const enregistrerDelais = async () => {
    const valeurs = { fournisseur: Number(delais.fournisseur), interne: Number(delais.interne), externe: Number(delais.externe) };
    if (Object.values(valeurs).some((v) => !Number.isInteger(v) || v < 1 || v > 365)) {
      return void toast.error("Chaque délai doit être un nombre entier de jours, entre 1 et 365.");
    }
    setIsSavingDelais(true);
    try {
      const res = await fetch("/api/budget-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delaisPaiement: valeurs }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(typeof err.error === "string" ? err.error : "Erreur lors de l'enregistrement.");
      }
      const data = await res.json();
      setDelais({
        fournisseur: String(data.delaisPaiement.fournisseur),
        interne: String(data.delaisPaiement.interne),
        externe: String(data.delaisPaiement.externe),
      });
      toast.success("Délais de paiement enregistrés !");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur.");
    } finally {
      setIsSavingDelais(false);
    }
  };

  const enregistrerDelaiRelance = async () => {
    const valeur = Number(delaiRelance);
    if (!Number.isInteger(valeur) || valeur < 1 || valeur > 365) {
      return void toast.error("Le délai de relance est un nombre entier de jours, entre 1 et 365.");
    }
    setIsSavingRelance(true);
    try {
      const res = await fetch("/api/budget-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delaiRelanceFactureClient: valeur }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Erreur lors de l'enregistrement.");
      setDelaiRelance(String(data.delaiRelanceFactureClient));
      toast.success("Délai de relance enregistré !");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur.");
    } finally {
      setIsSavingRelance(false);
    }
  };

  const enregistrerReglagesDepenses = async (reglages: { plafondPetiteDepense?: number; liasseExigeePourSolde?: boolean }) => {
    setIsSavingDepenses(true);
    try {
      const res = await fetch("/api/budget-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reglages),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(typeof err.error === "string" ? err.error : "Erreur lors de l'enregistrement.");
      }
      const data = await res.json();
      setPlafondPetite(String(data.plafondPetiteDepense));
      setLiasseExigee(data.liasseExigeePourSolde);
      toast.success("Réglage enregistré !");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur.");
    } finally {
      setIsSavingDepenses(false);
    }
  };

  const handleSaveTypesSigne = async (types: TypeBudgetValue[]) => {
    const precedent = typesSigne;
    setTypesSigne(types);
    setIsSavingTypesSigne(true);
    try {
      const res = await fetch("/api/budget-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typesBudgetSigneRequis: types }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(typeof err.error === "string" ? err.error : "Erreur lors de l'enregistrement.");
      }
      toast.success("Réglage du budget signé enregistré !");
    } catch (error) {
      setTypesSigne(precedent);
      toast.error(error instanceof Error ? error.message : "Erreur.");
    } finally {
      setIsSavingTypesSigne(false);
    }
  };

  const handleSavePlafond = async () => {
    const value = Number(plafond);
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Montant de plafond invalide.");
      return;
    }
    setIsSavingPlafond(true);
    try {
      const res = await fetch("/api/budget-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plafondValidationDeleguee: value }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(typeof err.error === "string" ? err.error : "Erreur lors de l'enregistrement.");
      }
      toast.success("Plafond enregistré !");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur.");
    } finally {
      setIsSavingPlafond(false);
    }
  };

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/roles");
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) throw new Error();
      setRoles(await res.json());
    } catch {
      toast.error("Erreur lors de la récupération des rôles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const peutReglages = peut("parametres.reglages");

  if (forbidden && charge && !peutReglages) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20 text-muted-foreground">
        Accès réservé aux administrateurs.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Button asChild variant="ghost" size="icon" className="rounded-full">
          <Link href="/parametres"><ChevronLeft className="w-5 h-5" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-blue-700" />
            Rôles &amp; Permissions
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Pour chaque rôle : les pages accessibles, puis les actions permises sur chaque page.
          </p>
        </div>
        {!forbidden && (
          <Button asChild>
            <Link href="/parametres/roles/nouveau">
              <Plus className="mr-2 h-4 w-4" /> Nouveau rôle
            </Link>
          </Button>
        )}
      </div>

      {!forbidden && (
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rôle</TableHead>
                <TableHead>Pages autorisées</TableHead>
                <TableHead className="text-center">Droits d&apos;action</TableHead>
                <TableHead>Circuit budget</TableHead>
                <TableHead className="text-center">Utilisateurs</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center h-24">Chargement...</TableCell></TableRow>
              ) : roles.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">Aucun rôle créé.</TableCell></TableRow>
              ) : (
                roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.nom}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {role.pages.length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">Aucune</span>
                        ) : (
                          role.pages.map((p) => (
                            <Badge key={p} variant="secondary" className="font-normal">{PAGE_LABELS[p]}</Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="font-normal">
                        {permissionsCoherentes(role.permissions ?? [], role.pages).length + (role.canManageUsers ? 1 : 0)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {BUDGET_FLAGS.filter((f) => role[f.key]).length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">Aucun</span>
                        ) : (
                          BUDGET_FLAGS.filter((f) => role[f.key]).map((f) => (
                            <Badge key={f.key} variant="outline" className="font-normal">{f.short}</Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">{role.nombreUtilisateurs}</TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/parametres/roles/${role.id}`} aria-label={`Modifier le rôle ${role.nom}`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}

      {peutReglages && (
      <>

      <Card className="mt-6">
        <CardContent className="pt-6 space-y-3">
          <div>
            <p className="text-sm font-medium">Plafond de validation déléguée (FCFA)</p>
            <p className="text-xs text-muted-foreground">
              Un budget ponctuel ou pour tiers jusqu&apos;à ce montant peut être validé par un rôle « Valider les budgets (hors mensuels et campagne) ».
              Au-dessus, et pour tout budget mensuel ou de campagne, il doit être validé par un rôle « Valider les budgets mensuels, de campagne et au-dessus du plafond ».
            </p>
          </div>
          <div className="flex items-center gap-2 max-w-sm">
            <Input type="number" min={0} step="1000" value={plafond} onChange={(e) => setPlafond(e.target.value)} />
            <Button onClick={handleSavePlafond} loading={isSavingPlafond} disabled={isSavingPlafond}>
              {isSavingPlafond ? "..." : "Enregistrer"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="pt-6 space-y-3">
          <div>
            <p className="text-sm font-medium">Budget signé exigé</p>
            <p className="text-xs text-muted-foreground">
              Pour les types cochés, la Direction décide d&apos;abord les lignes, puis le demandeur imprime le budget, le fait signer et joint
              le scan. Tant que ce scan manque, le budget reste en « Validation partielle » et aucune dépense n&apos;est possible. Les budgets
              déjà validés ne sont pas concernés.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
            {TYPES_BUDGET.map((t) => (
              <label key={t.value} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                <span>{t.label}</span>
                <Switch
                  checked={typesSigne.includes(t.value)}
                  disabled={isSavingTypesSigne}
                  onCheckedChange={(on) =>
                    handleSaveTypesSigne(on ? [...typesSigne, t.value] : typesSigne.filter((x) => x !== t.value))
                  }
                />
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="pt-6 space-y-5">
          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium">Maximum d&apos;une petite dépense (FCFA)</p>
              <p className="text-xs text-muted-foreground">
                Avec le droit « Saisir les petites dépenses » (accueil), une dépense hors bon de commande, en espèces, peut être enregistrée
                jusqu&apos;à ce montant. Au-delà, elle passe par le comptable.
              </p>
            </div>
            <div className="flex items-center gap-2 max-w-sm">
              <Input type="number" min={0} step="1000" value={plafondPetite} onChange={(e) => setPlafondPetite(e.target.value)} />
              <Button
                onClick={() => {
                  const v = Number(plafondPetite);
                  if (!Number.isFinite(v) || v < 0) return void toast.error("Montant invalide.");
                  enregistrerReglagesDepenses({ plafondPetiteDepense: v });
                }}
                loading={isSavingDepenses} disabled={isSavingDepenses}
              >
                {isSavingDepenses ? "..." : "Enregistrer"}
              </Button>
            </div>
          </div>
          <label className="flex items-start justify-between gap-4 max-w-xl">
            <span>
              <span className="block text-sm font-medium">Exiger la liasse complète pour payer un bon de commande</span>
              <span className="block text-xs text-muted-foreground">
                Activé : le solde d&apos;un bon exige le bordereau de livraison signé (ou l&apos;attestation de service fait), en plus de la
                facture. Désactivé : la facture suffit. Le scan du bon signé reste toujours exigé. La proforma fournisseur et le BAT
                ne bloquent jamais le paiement.
              </span>
            </span>
            <Switch checked={liasseExigee} disabled={isSavingDepenses} onCheckedChange={(on) => enregistrerReglagesDepenses({ liasseExigeePourSolde: on })} />
          </label>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="pt-6 space-y-3">
          <div>
            <p className="text-sm font-medium">Délais de paiement des prestataires (jours)</p>
            <p className="text-xs text-muted-foreground">
              Une facture prestataire non payée est « en retard » quand ce délai, compté à partir de la date de la facture, est
              dépassé : sa ligne passe en rouge avec un bouton clignotant (liste des factures, liste et fiche des prestataires), et
              les comptables et la direction sont notifiés une fois, le matin (canal réglable dans Paramètres &gt; Notifications).
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl">
            {(
              [
                { cle: "fournisseur", label: "Fournisseur" },
                { cle: "interne", label: "Prestataire interne" },
                { cle: "externe", label: "Prestataire externe" },
              ] as const
            ).map((d) => (
              <div key={d.cle} className="space-y-1">
                <Label htmlFor={`delai-${d.cle}`} className="text-xs">{d.label}</Label>
                <Input
                  id={`delai-${d.cle}`}
                  type="number"
                  min={1}
                  max={365}
                  step={1}
                  value={delais[d.cle]}
                  onChange={(e) => setDelais((prev) => ({ ...prev, [d.cle]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <Button onClick={enregistrerDelais} loading={isSavingDelais} disabled={isSavingDelais}>
            {isSavingDelais ? "..." : "Enregistrer les délais"}
          </Button>
          <div className="border-t pt-4 space-y-2">
            <div>
              <p className="text-sm font-medium">Relance des factures clients (jours)</p>
              <p className="text-xs text-muted-foreground">
                Délai proposé à l&apos;ajout d&apos;une facture normalisée, compté à partir de sa date d&apos;envoi au client (modifiable pour
                chaque facture). Échéance atteinte et proforma non soldée : « paiement à réclamer » en rouge, et les comptables et la
                direction sont notifiés une fois, le matin.
              </p>
            </div>
            <div className="flex items-end gap-3">
              <div className="space-y-1 w-40">
                <Label htmlFor="delai-relance" className="text-xs">Délai de relance</Label>
                <Input id="delai-relance" type="number" min={1} max={365} step={1} value={delaiRelance} onChange={(e) => setDelaiRelance(e.target.value)} />
              </div>
              <Button onClick={enregistrerDelaiRelance} loading={isSavingRelance} disabled={isSavingRelance}>
                {isSavingRelance ? "..." : "Enregistrer"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      </>
      )}
    </div>
  );
}
