"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
    Building2, Mail, Phone, MapPin, Globe, FileText,
    User, Save, Upload, Image as ImageIcon, Users, ShieldCheck, ChevronRight, BellRing,
} from "lucide-react";
import type { AppPublicMetadata } from "@/lib/permissions";
import { useDroits } from "@/components/DroitsProvider";

interface EntrepriseConfig {
    id: string;
    nom: string;
    slogan: string | null;
    adresse: string;
    telephone: string;
    email: string;
    emailFinance: string;
    siteWeb: string | null;
    ifu: string;
    rccm: string | null;
    nomDirecteur: string;
    logoPath: string;
    updatedAt: string;
}

type FormData = Omit<EntrepriseConfig, "id" | "updatedAt">;

const defaultForm: FormData = {
    nom: "",
    slogan: "",
    adresse: "",
    telephone: "",
    email: "",
    emailFinance: "",
    siteWeb: "",
    ifu: "",
    rccm: "",
    nomDirecteur: "",
    logoPath: "rplogo.png",
};

export default function ParametresPage() {
    const { user } = useUser();
    const canManageUsers = Boolean((user?.publicMetadata as AppPublicMetadata | undefined)?.canManageUsers);
    // Sous-droits des Paramètres (Paramètres → Rôles) : chaque carte selon son droit.
    const { peut } = useDroits();
    const peutEntreprise = peut("parametres.entreprise");
    const peutReglages = peut("parametres.reglages");
    const peutNotifications = peut("parametres.notifications");
    const [form, setForm] = useState<FormData>(defaultForm);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [logoPreview, setLogoPreview] = useState<string>("/rplogo.png");
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const res = await fetch("/api/entreprise");
                if (!res.ok) throw new Error();
                const data: EntrepriseConfig = await res.json();
                setForm({
                    nom: data.nom,
                    slogan: data.slogan ?? "",
                    adresse: data.adresse,
                    telephone: data.telephone,
                    email: data.email,
                    emailFinance: data.emailFinance,
                    siteWeb: data.siteWeb ?? "",
                    ifu: data.ifu,
                    rccm: data.rccm ?? "",
                    nomDirecteur: data.nomDirecteur,
                    logoPath: data.logoPath,
                });
                setLogoPreview(`/${data.logoPath}`);
            } catch {
                toast.error("Impossible de charger la configuration.");
            } finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validation type
        if (!file.type.startsWith("image/")) {
            toast.error("Seuls les fichiers image sont acceptés.");
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            toast.error("Le logo ne doit pas dépasser 2 Mo.");
            return;
        }

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/entreprise/logo", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) throw new Error();
            const { filename } = await res.json();

            setForm((prev) => ({ ...prev, logoPath: filename }));
            setLogoPreview(`/${filename}?t=${Date.now()}`);
            toast.success("Logo mis à jour !");
        } catch {
            toast.error("Erreur lors de l'upload du logo.");
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch("/api/entreprise", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (!res.ok) throw new Error();
            toast.success("Configuration enregistrée !");
        } catch {
            toast.error("Erreur lors de la sauvegarde.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-48 bg-gray-200 rounded-lg" />
                ))}
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold flex items-center gap-3">
                    <Building2 className="h-7 w-7 text-blue-700" />
                    Paramètres de l&apos;Entreprise
                </h1>
                <p className="text-gray-500 mt-1 text-sm">
                    Ces informations apparaîtront sur tous les documents générés (proformas, bons de commande…).
                </p>
            </div>

            {(canManageUsers || peutReglages || peutNotifications) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    {canManageUsers && (
                    <Link href="/parametres/utilisateurs">
                        <Card className="hover:shadow-md hover:border-primary/40 transition-all cursor-pointer">
                            <CardContent className="flex items-center gap-4 py-5">
                                <div className="p-3 rounded-xl bg-blue-100 text-blue-700"><Users className="w-5 h-5" /></div>
                                <div className="flex-1">
                                    <p className="font-semibold text-sm">Utilisateurs</p>
                                    <p className="text-xs text-muted-foreground">Créer des comptes et attribuer des rôles</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </CardContent>
                        </Card>
                    </Link>
                    )}
                    {(canManageUsers || peutReglages) && (
                    <Link href="/parametres/roles">
                        <Card className="hover:shadow-md hover:border-primary/40 transition-all cursor-pointer">
                            <CardContent className="flex items-center gap-4 py-5">
                                <div className="p-3 rounded-xl bg-purple-100 text-purple-700"><ShieldCheck className="w-5 h-5" /></div>
                                <div className="flex-1">
                                    <p className="font-semibold text-sm">Rôles &amp; Permissions</p>
                                    <p className="text-xs text-muted-foreground">
                                        {canManageUsers ? "Pages et actions permises par rôle, délais et plafonds" : "Délais et plafonds"}
                                    </p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </CardContent>
                        </Card>
                    </Link>
                    )}
                    {peutNotifications && (
                    <Link href="/parametres/notifications">
                        <Card className="hover:shadow-md hover:border-primary/40 transition-all cursor-pointer">
                            <CardContent className="flex items-center gap-4 py-5">
                                <div className="p-3 rounded-xl bg-amber-100 text-amber-700"><BellRing className="w-5 h-5" /></div>
                                <div className="flex-1">
                                    <p className="font-semibold text-sm">Notifications</p>
                                    <p className="text-xs text-muted-foreground">Email, application ou les deux, par événement</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </CardContent>
                        </Card>
                    </Link>
                    )}
                </div>
            )}

            {!peutEntreprise && (
                <p className="mb-4 rounded-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                    Consultation seule : votre rôle n&apos;a pas le droit de modifier les informations de l&apos;entreprise.
                </p>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              <fieldset disabled={!peutEntreprise} className="space-y-6 disabled:opacity-90">
                {/* Logo */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2 text-blue-900">
                            <ImageIcon className="h-4 w-4" />
                            Logo de l&apos;entreprise
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-6">
                            <div className="w-32 h-24 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden flex-shrink-0">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={logoPreview}
                                    alt="Logo aperçu"
                                    className="max-w-full max-h-full object-contain"
                                    onError={() => setLogoPreview("/rplogo.png")}
                                />
                            </div>
                            <div className="space-y-2">
                                <p className="text-sm text-gray-600">
                                    Fichier actuel : <code className="bg-gray-100 px-1 rounded">{form.logoPath}</code>
                                </p>
                                <p className="text-xs text-gray-400">PNG ou JPEG — max 2 Mo</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleLogoUpload}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={uploading}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload className="mr-2 h-4 w-4" />
                                    {uploading ? "Upload en cours..." : "Changer le logo"}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Informations générales */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2 text-blue-900">
                            <Building2 className="h-4 w-4" />
                            Informations Générales
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="nom">Nom de l&apos;entreprise *</Label>
                            <Input id="nom" name="nom" value={form.nom} onChange={handleChange} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="slogan">Slogan</Label>
                            <Input id="slogan" name="slogan" value={form.slogan ?? ""} onChange={handleChange} placeholder="Votre partenaire pub" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="adresse">
                                <MapPin className="inline h-3.5 w-3.5 mr-1" />
                                Adresse *
                            </Label>
                            <Input id="adresse" name="adresse" value={form.adresse} onChange={handleChange} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="siteWeb">
                                <Globe className="inline h-3.5 w-3.5 mr-1" />
                                Site Web
                            </Label>
                            <Input id="siteWeb" name="siteWeb" value={form.siteWeb ?? ""} onChange={handleChange} placeholder="www.exemple.com" />
                        </div>
                    </CardContent>
                </Card>

                {/* Contacts */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2 text-blue-900">
                            <Phone className="h-4 w-4" />
                            Contacts
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="telephone">
                                <Phone className="inline h-3.5 w-3.5 mr-1" />
                                Téléphone *
                            </Label>
                            <Input id="telephone" name="telephone" value={form.telephone} onChange={handleChange} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">
                                <Mail className="inline h-3.5 w-3.5 mr-1" />
                                Email principal *
                            </Label>
                            <Input id="email" name="email" type="email" value={form.email} onChange={handleChange} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="emailFinance">
                                <Mail className="inline h-3.5 w-3.5 mr-1" />
                                Email Finance *
                            </Label>
                            <Input id="emailFinance" name="emailFinance" type="email" value={form.emailFinance} onChange={handleChange} required />
                        </div>
                    </CardContent>
                </Card>

                {/* Informations légales */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2 text-blue-900">
                            <FileText className="h-4 w-4" />
                            Informations Légales
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="ifu">IFU *</Label>
                            <Input id="ifu" name="ifu" value={form.ifu} onChange={handleChange} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="rccm">RCCM</Label>
                            <Input id="rccm" name="rccm" value={form.rccm ?? ""} onChange={handleChange} placeholder="BJ-COT-2017-B-..." />
                        </div>
                    </CardContent>
                </Card>

                {/* Direction */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2 text-blue-900">
                            <User className="h-4 w-4" />
                            Direction
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 max-w-sm">
                            <Label htmlFor="nomDirecteur">Nom du/de la Directeur(trice) Général(e) *</Label>
                            <Input id="nomDirecteur" name="nomDirecteur" value={form.nomDirecteur} onChange={handleChange} required />
                        </div>
                    </CardContent>
                </Card>

                <Separator />

                {peutEntreprise && (
                <div className="flex justify-end">
                    <Button type="submit" disabled={saving} size="lg" className="gap-2 min-w-[180px]">
                        <Save className="h-4 w-4" />
                        {saving ? "Enregistrement..." : "Enregistrer"}
                    </Button>
                </div>
                )}
              </fieldset>
            </form>
        </div>
    );
}
