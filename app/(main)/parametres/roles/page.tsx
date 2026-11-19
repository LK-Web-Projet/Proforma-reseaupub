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
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ChevronLeft, ShieldCheck, Plus, Pencil } from "lucide-react";
import { PAGE_KEYS, PAGE_LABELS, PageKey } from "@/lib/permissions";

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

const emptyForm = {
  nom: "",
  pages: [] as PageKey[],
  canManageUsers: false,
  canValidateBudgetMensuel: false,
  canValidateBudget: false,
  canPayBudget: false,
  canSaisirCaisse: false,
  canSaisirPetiteDepense: false,
};

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
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

  useEffect(() => {
    fetch("/api/budget-config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setPlafond(String(data.plafondValidationDeleguee));
        setTypesSigne(data.typesBudgetSigneRequis ?? []);
        setPlafondPetite(String(data.plafondPetiteDepense ?? ""));
        setLiasseExigee(data.liasseExigeePourSolde ?? true);
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

  const openCreate = () => {
    setEditingRole(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEdit = (role: Role) => {
    setEditingRole(role);
    setForm({
      nom: role.nom,
      pages: role.pages,
      canManageUsers: role.canManageUsers,
      canValidateBudgetMensuel: role.canValidateBudgetMensuel,
      canValidateBudget: role.canValidateBudget,
      canPayBudget: role.canPayBudget,
      canSaisirCaisse: role.canSaisirCaisse,
      canSaisirPetiteDepense: role.canSaisirPetiteDepense,
    });
    setIsModalOpen(true);
  };

  const togglePage = (page: PageKey) => {
    setForm((prev) => ({
      ...prev,
      pages: prev.pages.includes(page) ? prev.pages.filter((p) => p !== page) : [...prev.pages, page],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const url = editingRole ? `/api/roles/${editingRole.id}` : "/api/roles";
      const method = editingRole ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.nom?._errors?.[0] || err.error || "Erreur lors de l'enregistrement.");
      }
      toast.success(editingRole ? "Rôle mis à jour !" : "Rôle créé !");
      setIsModalOpen(false);
      await fetchRoles();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erreur.");
    } finally {
      setIsSaving(false);
    }
  };

  if (forbidden) {
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
            Définissez quelles sections de l&apos;application chaque rôle peut consulter.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Nouveau rôle
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rôle</TableHead>
                <TableHead>Pages autorisées</TableHead>
                <TableHead className="text-center">Gère les comptes</TableHead>
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
                      {role.canManageUsers ? <Badge>Oui</Badge> : <span className="text-muted-foreground text-xs">Non</span>}
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
                      <Button variant="ghost" size="icon" onClick={() => openEdit(role)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
            <Button onClick={handleSavePlafond} disabled={isSavingPlafond}>
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
                disabled={isSavingDepenses}
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
          <Button onClick={enregistrerDelais} disabled={isSavingDelais}>
            {isSavingDelais ? "..." : "Enregistrer les délais"}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Modifier le rôle" : "Nouveau rôle"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="nom">Nom du rôle</Label>
              <Input
                id="nom"
                value={form.nom}
                onChange={(e) => setForm((prev) => ({ ...prev, nom: e.target.value }))}
                placeholder="Ex: Commercial, Comptable..."
                required
              />
            </div>

            <div className="space-y-3">
              <Label>Pages accessibles</Label>
              <div className="space-y-2 rounded-lg border p-3">
                {PAGE_KEYS.map((page) => (
                  <div key={page} className="flex items-center justify-between">
                    <span className="text-sm">{PAGE_LABELS[page]}</span>
                    <Switch checked={form.pages.includes(page)} onCheckedChange={() => togglePage(page)} />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Peut gérer les comptes</p>
                <p className="text-xs text-muted-foreground">Créer des comptes, gérer les rôles et permissions.</p>
              </div>
              <Switch
                checked={form.canManageUsers}
                onCheckedChange={(v) => setForm((prev) => ({ ...prev, canManageUsers: v }))}
              />
            </div>

            <div className="space-y-3">
              <Label>Circuit budget et caisse</Label>
              <div className="space-y-3 rounded-lg border p-3">
                {BUDGET_FLAGS.map((f) => (
                  <div key={f.key} className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">{f.label}</p>
                      <p className="text-xs text-muted-foreground">{f.description}</p>
                    </div>
                    <Switch
                      checked={form[f.key]}
                      onCheckedChange={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
                    />
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Enregistrement..." : editingRole ? "Enregistrer" : "Créer le rôle"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
