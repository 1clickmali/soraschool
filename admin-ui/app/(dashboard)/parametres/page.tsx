"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle,
  Globe,
  Image as ImageIcon,
  Mail,
  MapPin,
  Palette,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Shield,
  Trash2,
  Upload,
  User,
  Users,
} from "lucide-react";
import { authApi, superAdminApi, type PlatformBranding } from "@/lib/api";
import { cn } from "@/lib/utils";

const inputCls =
  "w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none transition focus:border-soraBlue/60 focus:bg-white/[0.07] disabled:opacity-50";

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-6 shadow-xl shadow-black/10">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-soraBlue">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-heading text-base font-bold text-white">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Feedback({ error, success }: { error?: string | null; success?: string | null }) {
  if (!error && !success) return null;
  return (
    <div className={cn("flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm", error ? "border-red-500/20 bg-red-500/10 text-red-300" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300")}>
      {error ? <AlertCircle className="h-4 w-4 shrink-0" /> : <CheckCircle className="h-4 w-4 shrink-0" />}
      {error || success}
    </div>
  );
}

export default function ParametresPage() {
  const [me, setMe] = useState<{ id: string; firstName?: string; lastName?: string; phone: string; email?: string } | null>(null);
  const [branding, setBranding] = useState<PlatformBranding | null>(null);
  const [admins, setAdmins] = useState<Array<{ id: string; firstName: string; lastName: string; phone: string; email?: string; createdAt: string; lastLoginAt?: string }>>([]);

  const [brandingForm, setBrandingForm] = useState<Partial<PlatformBranding>>({});
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingFeedback, setBrandingFeedback] = useState<{ error?: string; success?: string }>({});

  const [newAdmin, setNewAdmin] = useState({ firstName: "", lastName: "", phone: "", email: "" });
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminFeedback, setAdminFeedback] = useState<{ error?: string; success?: string }>({});

  const [logoUploading, setLogoUploading] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [meRes, brandingRes, adminsRes] = await Promise.all([
      authApi.me(),
      superAdminApi.platformBranding(),
      superAdminApi.superAdmins(),
    ]);
    if (meRes.data?.user) setMe(meRes.data.user as any);
    if (brandingRes.data?.branding) {
      setBranding(brandingRes.data.branding);
      setBrandingForm(brandingRes.data.branding);
    }
    if (adminsRes.data?.admins) setAdmins(adminsRes.data.admins);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveBranding = async () => {
    setBrandingSaving(true);
    setBrandingFeedback({});
    const { data, error } = await superAdminApi.updatePlatformBranding(brandingForm);
    setBrandingSaving(false);
    if (error) { setBrandingFeedback({ error }); return; }
    if (data?.branding) { setBranding(data.branding); setBrandingForm(data.branding); }
    setBrandingFeedback({ success: "Paramètres sauvegardés !" });
    setTimeout(() => setBrandingFeedback({}), 3000);
  };

  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    const { data, error } = await superAdminApi.uploadPlatformBrandingAsset("logo", file);
    setLogoUploading(false);
    if (error) { setBrandingFeedback({ error }); return; }
    if (data?.branding) { setBranding(data.branding); setBrandingForm((f) => ({ ...f, logoUrl: data.branding.logoUrl })); }
    setBrandingFeedback({ success: "Logo mis à jour !" });
    setTimeout(() => setBrandingFeedback({}), 3000);
  };

  const createAdmin = async () => {
    if (!newAdmin.firstName.trim() || !newAdmin.lastName.trim() || !newAdmin.phone.trim()) {
      setAdminFeedback({ error: "Prénom, nom et téléphone sont requis" });
      return;
    }
    setAdminSaving(true);
    setAdminFeedback({});
    const { error } = await superAdminApi.createSuperAdmin(newAdmin);
    setAdminSaving(false);
    if (error) { setAdminFeedback({ error }); return; }
    setAdminFeedback({ success: "Super admin créé !" });
    setNewAdmin({ firstName: "", lastName: "", phone: "", email: "" });
    load();
    setTimeout(() => setAdminFeedback({}), 3000);
  };

  const myName = me ? [me.firstName, me.lastName].filter(Boolean).join(" ") || me.phone : "—";

  return (
    <div className="max-w-4xl space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-2xl font-bold text-white">Paramètres</h1>
        <p className="mt-1 text-sm text-gray-400">Gérez votre profil, le branding de la plateforme et les accès super admin.</p>
      </motion.div>

      {/* Mon profil */}
      <SectionCard icon={User} title="Mon profil" subtitle="Informations de votre compte super admin">
        <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-soraBlue/20 text-xl font-bold text-white">
            {myName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-white">{myName}</p>
            <p className="mt-0.5 text-sm text-gray-500">{me?.phone}</p>
            {me?.email && <p className="text-xs text-gray-600">{me.email}</p>}
          </div>
          <div className="ml-auto flex items-center gap-1.5 rounded-full border border-soraBlue/30 bg-soraBlue/10 px-3 py-1 text-xs font-semibold text-soraBlue">
            <Shield className="h-3 w-3" /> Super Admin
          </div>
        </div>
      </SectionCard>

      {/* Branding plateforme */}
      <SectionCard icon={Settings} title="Branding de la plateforme" subtitle="Nom, logo, couleurs et contact de votre logiciel">
        <div className="space-y-5">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05]">
              {brandingForm.logoUrl
                ? <img src={brandingForm.logoUrl} alt="Logo" className="h-full w-full object-contain" />
                : <ImageIcon className="h-7 w-7 text-gray-600" />
              }
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium text-white">Logo de la plateforme</p>
              <button
                onClick={() => logoRef.current?.click()}
                disabled={logoUploading}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-gray-300 transition hover:bg-white/[0.08] disabled:opacity-50"
              >
                {logoUploading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {logoUploading ? "Upload en cours..." : "Changer le logo"}
              </button>
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={uploadLogo} />
            </div>
            {brandingForm.logoUrl && (
              <button onClick={() => setBrandingForm((f) => ({ ...f, logoUrl: null as any }))} className="ml-auto text-gray-600 hover:text-red-400 transition">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-500">Nom de l'application</label>
              <input className={inputCls} value={brandingForm.appName || ""} onChange={(e) => setBrandingForm((f) => ({ ...f, appName: e.target.value }))} placeholder="SoraSchool" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-500">Slogan</label>
              <input className={inputCls} value={brandingForm.slogan || ""} onChange={(e) => setBrandingForm((f) => ({ ...f, slogan: e.target.value }))} placeholder="La plateforme scolaire intelligente" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-500 flex items-center gap-1.5"><Mail className="h-3 w-3" /> Email support</label>
              <input className={inputCls} value={brandingForm.supportEmail || ""} onChange={(e) => setBrandingForm((f) => ({ ...f, supportEmail: e.target.value }))} placeholder="contact@soratech.ci" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-500 flex items-center gap-1.5"><Phone className="h-3 w-3" /> Téléphone support</label>
              <input className={inputCls} value={brandingForm.supportPhone || ""} onChange={(e) => setBrandingForm((f) => ({ ...f, supportPhone: e.target.value }))} placeholder="+225 07 04 92 80 68" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-500 flex items-center gap-1.5"><MapPin className="h-3 w-3" /> Adresse</label>
              <input className={inputCls} value={brandingForm.supportAddress || ""} onChange={(e) => setBrandingForm((f) => ({ ...f, supportAddress: e.target.value }))} placeholder="Abidjan, Côte d'Ivoire" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-500 flex items-center gap-1.5"><Globe className="h-3 w-3" /> Site web</label>
              <input className={inputCls} value={brandingForm.website || ""} onChange={(e) => setBrandingForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://soratech.ci" />
            </div>
          </div>

          {/* Couleurs */}
          <div>
            <label className="mb-3 block text-xs font-semibold text-gray-500 flex items-center gap-1.5"><Palette className="h-3 w-3" /> Couleurs</label>
            <div className="flex flex-wrap gap-4">
              {([["primaryColor", "Principale"], ["secondaryColor", "Secondaire"], ["accentColor", "Accent"]] as const).map(([field, label]) => (
                <div key={field} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={(brandingForm as any)[field] || "#0F6BFF"}
                    onChange={(e) => setBrandingForm((f) => ({ ...f, [field]: e.target.value }))}
                    className="h-10 w-10 cursor-pointer rounded-xl border border-white/10 bg-transparent"
                  />
                  <div>
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="font-mono text-xs text-gray-300">{(brandingForm as any)[field] || "#0F6BFF"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Feedback {...brandingFeedback} />

          <button
            onClick={saveBranding}
            disabled={brandingSaving}
            className="flex items-center gap-2 rounded-xl bg-soraBlue px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-soraBlue/80 disabled:opacity-60"
          >
            {brandingSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Sauvegarder le branding
          </button>
        </div>
      </SectionCard>

      {/* Super Admins */}
      <SectionCard icon={Users} title="Super Administrateurs" subtitle="Gérez les comptes ayant accès total à la plateforme">
        {/* Liste */}
        <div className="mb-5 space-y-2">
          {admins.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 py-6 text-center text-sm text-gray-500">Aucun super admin</p>
          ) : admins.map((admin) => (
            <div key={admin.id} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-soraBlue/15 text-sm font-bold text-soraBlue">
                {admin.firstName?.charAt(0)?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{admin.firstName} {admin.lastName}</p>
                <p className="text-xs text-gray-500">{admin.phone}{admin.email ? ` · ${admin.email}` : ""}</p>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-soraBlue/20 bg-soraBlue/[0.08] px-2.5 py-1 text-[11px] font-semibold text-soraBlue">
                <Shield className="h-3 w-3" /> Super Admin
              </div>
            </div>
          ))}
        </div>

        {/* Formulaire nouveau super admin */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Ajouter un super admin</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input className={inputCls} placeholder="Prénom" value={newAdmin.firstName} onChange={(e) => setNewAdmin({ ...newAdmin, firstName: e.target.value })} />
            <input className={inputCls} placeholder="Nom" value={newAdmin.lastName} onChange={(e) => setNewAdmin({ ...newAdmin, lastName: e.target.value })} />
            <input className={inputCls} placeholder="Téléphone (+2250700000001)" value={newAdmin.phone} onChange={(e) => setNewAdmin({ ...newAdmin, phone: e.target.value })} />
            <input className={inputCls} placeholder="Email (optionnel)" value={newAdmin.email} onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })} />
          </div>
          <div className="mt-3 space-y-2">
            <Feedback {...adminFeedback} />
            <button
              onClick={createAdmin}
              disabled={adminSaving}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
            >
              {adminSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Créer le super admin
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
