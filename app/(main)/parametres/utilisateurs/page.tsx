"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useActionEnCours } from "@/lib/useActionEnCours";
import { Indicateur } from "@/components/ui/indicateur";
import { ChevronLeft, Users, Plus, KeyRound } from "lucide-react";

interface Role {
  id: string;
  nom: string;
}

interface AppUser {
  id: string;
  email: string;
  nom: string;
  active: boolean;
  createdAt: string;
  role: { id: string; nom: string };
}

const emptyForm = { email: "", nom: "", password: "", roleId: "" };

export default function UtilisateursPage() {
  const { enCours, lancer } = useActionEnCours();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [resetTarget, setResetTarget] = useState<AppUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/roles"),
      ]);
      if (usersRes.status === 403 || rolesRes.status === 403) {
        setForbidden(true);
        return;
      }
      if (!usersRes.ok || !rolesRes.ok) throw new Error();
      setUsers(await usersRes.json());
      setRoles(await rolesRes.json());
    } catch {
      toast.error("Erreur lors de la récupération des utilisateurs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setForm({ ...emptyForm, roleId: roles[0]?.id ?? "" });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(typeof err.error === "string" ? err.error : "Impossible de créer le compte.");
      }
      toast.success("Compte créé !");
      setIsModalOpen(false);
      await fetchData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erreur.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRoleChange = async (userId: string, roleId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId }),
      });
      if (!res.ok) throw new Error();
      toast.success("Rôle mis à jour !");
      await fetchData();
    } catch {
      toast.error("Erreur lors du changement de rôle.");
    }
  };

  const handleToggleActive = async (user: AppUser) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !user.active }),
      });
      if (!res.ok) throw new Error();
      toast.success(user.active ? "Compte désactivé." : "Compte réactivé.");
      await fetchData();
    } catch {
      toast.error("Erreur lors de la mise à jour du compte.");
    }
  };

  const openReset = (user: AppUser) => {
    setResetTarget(user);
    setResetPassword("");
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setIsResetting(true);
    try {
      const res = await fetch(`/api/users/${resetTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(typeof err.error === "string" ? err.error : "Impossible de changer le mot de passe.");
      }
      toast.success("Mot de passe réinitialisé !");
      setResetTarget(null);
      setResetPassword("");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erreur.");
    } finally {
      setIsResetting(false);
    }
  };

  if (forbidden) {
    return (
      <div className="max-w-5xl mx-auto text-center py-20 text-muted-foreground">
        Accès réservé aux administrateurs.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Button asChild variant="ghost" size="icon" className="rounded-full">
          <Link href="/parametres"><ChevronLeft className="w-5 h-5" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Users className="h-6 w-6 text-blue-700" />
            Utilisateurs
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Créez des comptes et attribuez-leur un rôle.</p>
        </div>
        <Button onClick={openCreate} disabled={roles.length === 0}>
          <Plus className="mr-2 h-4 w-4" /> Créer un compte
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead className="text-center">Actif</TableHead>
                <TableHead className="text-center">Mot de passe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24">Chargement...</TableCell></TableRow>
              ) : users.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">Aucun utilisateur.</TableCell></TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.nom}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                      <Select value={user.role.id} onValueChange={(v) => lancer(`role:${user.id}`, () => handleRoleChange(user.id, v))} disabled={enCours(`role:${user.id}`)}>
                        <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.nom}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {enCours(`role:${user.id}`) && <Indicateur label="Changement de rôle…" />}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Switch checked={user.active} onCheckedChange={() => lancer(`actif:${user.id}`, () => handleToggleActive(user))} disabled={enCours(`actif:${user.id}`)} />
                        {enCours(`actif:${user.id}`) && <Indicateur label="Mise à jour du compte…" />}
                        {!user.active && <Badge variant="destructive" className="text-[10px]">Désactivé</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" title="Réinitialiser le mot de passe" onClick={() => openReset(user)}>
                        <KeyRound className="h-4 w-4" />
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Créer un compte</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nom">Nom</Label>
              <Input id="nom" value={form.nom} onChange={(e) => setForm((p) => ({ ...p, nom: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" minLength={8} value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} required />
              <p className="text-xs text-muted-foreground">Au moins 8 caractères. Communiquez-le à l&apos;utilisateur en dehors de l&apos;application.</p>
            </div>
            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select value={form.roleId} onValueChange={(v) => setForm((p) => ({ ...p, roleId: v }))}>
                <SelectTrigger><SelectValue placeholder="Choisir un rôle" /></SelectTrigger>
                <SelectContent>
                  {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Annuler</Button>
              <Button type="submit" loading={isSaving} disabled={isSaving || !form.roleId}>
                {isSaving ? "Création..." : "Créer le compte"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetTarget} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
          </DialogHeader>
          {resetTarget && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Nouveau mot de passe pour <span className="font-medium text-foreground">{resetTarget.nom}</span> ({resetTarget.email}).
              </p>
              <div className="space-y-2">
                <Label htmlFor="resetPassword">Nouveau mot de passe</Label>
                <Input
                  id="resetPassword"
                  type="password"
                  minLength={8}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  required
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Au moins 8 caractères. L&apos;utilisateur sera déconnecté de ses autres sessions. Communiquez-le en dehors de l&apos;application.
                </p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setResetTarget(null)}>Annuler</Button>
                <Button type="submit" loading={isResetting} disabled={isResetting || resetPassword.length < 8}>
                  {isResetting ? "Réinitialisation..." : "Réinitialiser"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
