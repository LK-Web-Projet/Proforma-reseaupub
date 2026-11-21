"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRouter } from "next-nprogress-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ChevronLeft, ShieldCheck, Save, Eye, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDroits } from "@/components/DroitsProvider";
import {
  MODULES_DROITS,
  ROLE_FLAGS,
  permissionsCoherentes,
  type ActionDroit,
  type ModuleDroits,
  type PageKey,
  type RoleFlag,
} from "@/lib/permissions";

interface RoleApi {
  id: string;
  nom: string;
  pages: PageKey[];
  permissions: string[];
  nombreUtilisateurs: number;
  canManageUsers: boolean;
  canValidateBudgetMensuel: boolean;
  canValidateBudget: boolean;
  canPayBudget: boolean;
  canSaisirCaisse: boolean;
  canSaisirPetiteDepense: boolean;
}

type Flags = Record<RoleFlag, boolean>;

const FLAGS_VIDES = Object.fromEntries(ROLE_FLAGS.map((f) => [f, false])) as Flags;

/**
 * Éditeur d'un rôle (Paramètres → Rôles → rôle) : une carte par module, avec l'accès à la page
 * puis les actions. Règle descendante : sans la page, les actions du module sont grisées et
 * retirées à l'enregistrement (les cases historiques du budget et de la caisse restent libres).
 */
export default function RoleEditeurPage() {
  const { id } = useParams<{ id: string }>();
  const creation = id === "nouveau";
  const router = useRouter();
  const { recharger } = useDroits();

  const [nom, setNom] = useState("");
  const [pages, setPages] = useState<PageKey[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [flags, setFlags] = useState<Flags>(FLAGS_VIDES);
  const [nbUtilisateurs, setNbUtilisateurs] = useState(0);
  const [loading, setLoading] = useState(!creation);
  const [saving, setSaving] = useState(false);
  const [interdit, setInterdit] = useState(false);

  useEffect(() => {
    if (creation) return;
    fetch("/api/roles")
      .then(async (res) => {
        if (res.status === 403) {
          setInterdit(true);
          return;
        }
        if (!res.ok) throw new Error();
        const roles: RoleApi[] = await res.json();
        const role = roles.find((r) => r.id === id);
        if (!role) {
          toast.error("Rôle introuvable.");
          router.push("/parametres/roles");
          return;
        }
        setNom(role.nom);
        setPages(role.pages);
        setPermissions(role.permissions);
        setFlags(Object.fromEntries(ROLE_FLAGS.map((f) => [f, role[f]])) as Flags);
        setNbUtilisateurs(role.nombreUtilisateurs);
      })
      .catch(() => toast.error("Erreur lors du chargement du rôle."))
      .finally(() => setLoading(false));
  }, [creation, id, router]);

  const pageActive = (m: ModuleDroits) => m.page === null || pages.includes(m.page);

  const estCoche = (a: ActionDroit) => (a.flag ? flags[a.flag] : permissions.includes(a.key));

  const basculer = (a: ActionDroit, on: boolean) => {
    if (a.flag) {
      setFlags((prev) => ({ ...prev, [a.flag as RoleFlag]: on }));
      return;
    }
    setPermissions((prev) => (on ? Array.from(new Set([...prev, a.key])) : prev.filter((k) => k !== a.key)));
  };

  const basculerPage = (m: ModuleDroits, on: boolean) => {
    if (!m.page) return;
    const page = m.page;
    setPages((prev) => (on ? Array.from(new Set([...prev, page])) : prev.filter((p) => p !== page)));
    // Règle descendante : fermer la page retire les actions du module.
    if (!on) {
      const cles = new Set(m.actions.filter((a) => !a.flag).map((a) => a.key));
      setPermissions((prev) => prev.filter((k) => !cles.has(k)));
    }
  };

  const toutModule = (m: ModuleDroits, on: boolean) => {
    for (const a of m.actions) {
      if (!a.flag && !pageActive(m)) continue;
      basculer(a, on);
    }
  };

  const resume = useMemo(() => {
    const nbDroits = permissionsCoherentes(permissions, pages).length + ROLE_FLAGS.filter((f) => flags[f]).length;
    return { nbPages: pages.length, nbDroits };
  }, [permissions, pages, flags]);

  const enregistrer = async () => {
    if (!nom.trim()) return void toast.error("Le nom du rôle est requis.");
    setSaving(true);
    try {
      const corps = { nom: nom.trim(), pages, permissions: permissionsCoherentes(permissions, pages), ...flags };
      const res = await fetch(creation ? "/api/roles" : `/api/roles/${id}`, {
        method: creation ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.nom?._errors?.[0] || (typeof err.error === "string" ? err.error : "Erreur lors de l'enregistrement."));
      }
      toast.success(creation ? "Rôle créé !" : "Rôle enregistré !");
      recharger();
      router.push("/parametres/roles");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur.");
    } finally {
      setSaving(false);
    }
  };

  if (interdit) {
    return <div className="max-w-4xl mx-auto text-center py-20 text-muted-foreground">Accès réservé aux administrateurs.</div>;
  }
  if (loading) {
    return <div className="max-w-4xl mx-auto text-center py-20 text-muted-foreground">Chargement…</div>;
  }

  return (
    <div className="max-w-4xl mx-auto pb-24">
      <div className="flex items-center gap-3 mb-6">
        <Button asChild variant="ghost" size="icon" className="rounded-full">
          <Link href="/parametres/roles" aria-label="Retour aux rôles">
            <ChevronLeft className="w-5 h-5" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-blue-700 shrink-0" />
            <span className="truncate">{creation ? "Nouveau rôle" : `Rôle « ${nom} »`}</span>
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Cochez d&apos;abord l&apos;accès à la page, puis les actions permises sur cette page.
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="nom-role">Nom du rôle</Label>
            <Input id="nom-role" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Commercial, Comptable…" />
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary" className="font-normal">{resume.nbPages} page(s)</Badge>
            <Badge variant="secondary" className="font-normal">{resume.nbDroits} droit(s)</Badge>
            {!creation && (
              <Badge variant="outline" className="font-normal gap-1">
                <Users className="h-3 w-3" /> {nbUtilisateurs} utilisateur(s)
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {MODULES_DROITS.map((m) => {
          const ouvert = pageActive(m);
          const actions = m.actions.filter((a) => a.key !== "proforma.voirTout");
          const groupes = Array.from(new Set(actions.map((a) => a.groupe ?? "")));
          return (
            <Card key={m.id} className={cn("transition-colors", !ouvert && "bg-muted/30")}>
              <CardContent className="pt-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold">{m.label}</h2>
                    {m.note && <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">{m.note}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    {m.page ? (
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <Eye className="h-4 w-4 text-muted-foreground" />
                        Accès à la page
                        <Switch checked={ouvert} onCheckedChange={(on) => basculerPage(m, on)} />
                      </label>
                    ) : (
                      <Badge variant="outline" className="font-normal">Toujours visible</Badge>
                    )}
                  </div>
                </div>

                {m.id === "proforma" && (
                  <div className={cn("flex flex-wrap items-center gap-2 text-sm", !ouvert && "opacity-50 pointer-events-none")}>
                    <span className="text-muted-foreground">Proformas visibles :</span>
                    {[
                      { on: true, label: "Toutes" },
                      { on: false, label: "Seulement les siennes" },
                    ].map((o) => {
                      const actif = permissions.includes("proforma.voirTout") === o.on;
                      return (
                        <button
                          key={o.label}
                          type="button"
                          aria-pressed={actif}
                          onClick={() => basculer({ key: "proforma.voirTout", label: "" }, o.on)}
                          className={cn(
                            "rounded-md border px-3 py-1 transition-colors",
                            actif ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"
                          )}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                    <span className="text-xs text-muted-foreground w-full">
                      « Les siennes » : créées par l&apos;utilisateur, ou dont il est le commercial (même email).
                    </span>
                  </div>
                )}

                {groupes.map((g) => (
                  <div key={g || "principal"} className="space-y-1">
                    {g && <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">{g}</p>}
                    <div className="grid gap-1 sm:grid-cols-2">
                      {actions
                        .filter((a) => (a.groupe ?? "") === g)
                        .map((a) => {
                          const grise = !a.flag && !ouvert;
                          return (
                            <label
                              key={a.key}
                              className={cn(
                                "flex items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/60 cursor-pointer",
                                grise && "opacity-50 cursor-not-allowed hover:bg-transparent"
                              )}
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
                                checked={!grise && estCoche(a)}
                                disabled={grise}
                                onChange={(e) => basculer(a, e.target.checked)}
                              />
                              <span className="min-w-0">
                                <span className="block text-sm">{a.label}</span>
                                {a.description && <span className="block text-xs text-muted-foreground">{a.description}</span>}
                              </span>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                ))}

                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toutModule(m, true)} disabled={!ouvert && !m.actions.some((a) => a.flag)}>
                    Tout cocher
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => toutModule(m, false)}>
                    Tout décocher
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="fixed bottom-0 inset-x-0 z-20 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-end gap-2">
          <Button variant="outline" asChild>
            <Link href="/parametres/roles">Annuler</Link>
          </Button>
          <Button onClick={enregistrer} loading={saving} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Enregistrement…" : creation ? "Créer le rôle" : "Enregistrer"}
          </Button>
        </div>
      </div>
    </div>
  );
}
