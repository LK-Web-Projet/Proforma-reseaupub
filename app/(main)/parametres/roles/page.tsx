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

interface Role {
  id: string;
  nom: string;
  canManageUsers: boolean;
  pages: PageKey[];
  nombreUtilisateurs: number;
}

const emptyForm = {
  nom: "",
  pages: [] as PageKey[],
  canManageUsers: false,
};

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);

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
    setForm({ nom: role.nom, pages: role.pages, canManageUsers: role.canManageUsers });
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
                <TableHead className="text-center">Utilisateurs</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24">Chargement...</TableCell></TableRow>
              ) : roles.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">Aucun rôle créé.</TableCell></TableRow>
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

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-lg">
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
