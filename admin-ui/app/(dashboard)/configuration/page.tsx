"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle,
  Crown,
  ExternalLink,
  FileText,
  Image,
  Languages,
  Link2,
  Lock,
  Mail,
  MapPin,
  Palette,
  Phone,
  Plus,
  RefreshCw,
  Save,
  School,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { StatusBadge, TierBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  downloadProtectedFile,
  superAdminApi,
  type CreateEstablishmentInput,
  type Establishment,
  type Institution,
} from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";

const KIND_OPTIONS = [
  ["PRIMARY", "Primaire"],
  ["COLLEGE", "Collège"],
  ["LYCEE", "Lycée"],
  ["UNIVERSITY", "Université"],
  ["TRAINING_CENTER", "Centre de formation"],
  ["RELIGIOUS", "Institut religieux"],
  ["BILINGUAL", "Bilingue"],
  ["OTHER", "Autre"],
] as const;

const LANGUAGE_OPTIONS = [
  ["FR", "Français"],
  ["EN", "Anglais"],
  ["AR", "Arabe"],
] as const;

const CURRENCY_OPTIONS = ["XOF", "EUR", "USD", "GHS", "NGN"];

function initials(name?: string) {
  const parts = (name || "SoraSchool").split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function getPortalUrl(slug: string) {
  if (typeof window === "undefined") return `/${slug}/login`;
  return `${window.location.origin}/${slug}/login`;
}

function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function structureLabel(value?: Institution["structure"]) {
  return value === "CENTRAL_ADMINISTRATION" ? "Administration Centrale" : "École unique";
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">{children}</label>;
}

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
  className,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-5 shadow-2xl shadow-black/10", className)}>
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-soraBlue">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-heading text-base font-bold text-white">{title}</h2>
          {subtitle && <p className="mt-1 text-sm leading-snug text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function ConfigurationPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selected, setSelected] = useState<Institution | null>(null);
  const [form, setForm] = useState<Partial<Institution>>({});
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingBranch, setSavingBranch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [branchMessage, setBranchMessage] = useState<string | null>(null);
  const [branchForm, setBranchForm] = useState<CreateEstablishmentInput>({
    name: "",
    city: "",
    district: "",
    address: "",
    phone: "",
    email: "",
    directorName: "",
    directorPhone: "",
    directorEmail: "",
  });

  useEffect(() => {
    superAdminApi.institutions().then(({ data }) => {
      const list = data?.institutions || [];
      setInstitutions(list);
      if (list.length > 0) setSelected(list[0]);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setForm(selected);
    loadEstablishments(selected.id);
  }, [selected]);

  const filteredInstitutions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return institutions;
    return institutions.filter((institution) =>
      [institution.name, institution.slug, institution.city, institution.plan?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [institutions, search]);

  const canCreateBranches = Boolean(selected?.plan?.canCreateBranches || selected?.plan?.tier === "ENTERPRISE");
  const portalUrl = selected ? getPortalUrl(selected.slug) : "";
  const primaryColor = form.primaryColor || "#064E3B";
  const secondaryColor = form.secondaryColor || "#F7F1DE";
  const accentColor = form.accentColor || "#C89B3C";

  const inputCls =
    "w-full rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none transition focus:border-soraBlue/60 focus:bg-white/[0.075] disabled:cursor-not-allowed disabled:opacity-55";
  const compactInputCls =
    "w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 outline-none transition focus:border-soraBlue/60 disabled:cursor-not-allowed disabled:opacity-50";

  const setField = <K extends keyof Institution>(field: K, value: Institution[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const loadEstablishments = async (institutionId: string) => {
    const { data } = await superAdminApi.establishments(institutionId);
    setEstablishments(data?.establishments || []);
  };

  const handleSave = async () => {
    if (!selected) return;
    const clean = (value?: string) => value?.trim() || undefined;
    setSaving(true);
    setError(null);

    const { data, error: err } = await superAdminApi.updateInstitution(selected.id, {
      name: clean(form.name),
      kind: form.kind,
      logoUrl: clean(form.logo),
      city: clean(form.city),
      district: clean(form.district),
      country: clean(form.country),
      address: clean(form.address),
      phone: clean(form.phone),
      whatsapp: clean(form.whatsapp),
      email: clean(form.email),
      website: clean(form.website),
      motto: clean(form.motto),
      activeAcademicYearName: clean(form.activeAcademicYearName),
      currency: clean(form.currency),
      primaryColor: form.primaryColor,
      secondaryColor: form.secondaryColor,
      accentColor: form.accentColor,
      languages: form.languages,
      levels: form.levels,
    });

    setSaving(false);
    if (err || !data) {
      setError(err || "Impossible de sauvegarder");
      return;
    }

    setSelected(data.institution);
    setInstitutions((prev) => prev.map((institution) => institution.id === data.institution.id ? data.institution : institution));
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const toggleLanguage = (code: string) => {
    setForm((prev) => {
      const current = prev.languages || [];
      return {
        ...prev,
        languages: current.includes(code)
          ? current.filter((language) => language !== code)
          : [...current, code],
      };
    });
  };

  const createEstablishment = async () => {
    if (!selected) return;
    if (!branchForm.name?.trim()) {
      setBranchMessage("Le nom de l’établissement est obligatoire.");
      return;
    }

    setSavingBranch(true);
    setBranchMessage(null);
    const clean = (value?: string) => value?.trim() || undefined;
    const { error: apiError } = await superAdminApi.createEstablishment(selected.id, {
      name: branchForm.name.trim(),
      kind: selected.kind,
      country: selected.country,
      city: clean(branchForm.city),
      district: clean(branchForm.district),
      address: clean(branchForm.address),
      phone: clean(branchForm.phone),
      email: clean(branchForm.email),
      directorName: clean(branchForm.directorName),
      directorPhone: clean(branchForm.directorPhone),
      directorEmail: clean(branchForm.directorEmail),
    });

    setSavingBranch(false);
    if (apiError) {
      setBranchMessage(apiError);
      return;
    }

    setBranchForm({ name: "", city: "", district: "", address: "", phone: "", email: "", directorName: "", directorPhone: "", directorEmail: "" });
    setBranchMessage("Établissement créé avec succès.");
    loadEstablishments(selected.id);
  };

  const downloadContract = async () => {
    if (!selected) return;
    await downloadProtectedFile(
      `/api/super-admin/institutions/${selected.id}/installation-contract`,
      `fiche-contrat-installation-${selected.slug}.pdf`
    );
  };

  return (
    <div className="max-w-[1700px] space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.28),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] p-6 shadow-2xl shadow-black/25"
      >
        <div className="absolute right-10 top-8 h-28 w-28 rounded-full bg-soraBlue/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-24 w-48 rounded-full bg-soraGold/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-soraGold">
              <Sparkles className="h-3.5 w-3.5" />
              Centre de configuration premium
            </div>
            <h1 className="font-heading text-3xl font-black tracking-tight text-white">Configuration des écoles clientes</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">
              Ajustez l’identité, le portail, les couleurs, les langues et les établissements rattachés sans quitter le panneau Super Admin.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:justify-end">
            {selected && (
              <>
                <Button variant="secondary" icon={<ExternalLink className="h-4 w-4" />} onClick={() => window.open(portalUrl, "_blank", "noopener,noreferrer")}>
                  Portail
                </Button>
                <Button variant="secondary" icon={<FileText className="h-4 w-4" />} onClick={downloadContract}>
                  Contrat PDF
                </Button>
              </>
            )}
            <Button loading={saving} icon={saved ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />} onClick={handleSave} disabled={!selected}>
              {saved ? "Sauvegardé" : "Sauvegarder"}
            </Button>
          </div>
        </div>
      </motion.div>

      {error && (
        <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
        <motion.aside
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.08 }}
          className="space-y-4"
        >
          <section className="rounded-[1.75rem] border border-white/10 bg-soraCard/90 p-4 shadow-2xl shadow-black/20">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Institutions</p>
                <p className="mt-1 text-sm text-gray-400">{institutions.length} client{institutions.length > 1 ? "s" : ""} enregistré{institutions.length > 1 ? "s" : ""}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-soraBlue/15 text-soraBlue">
                <Building2 className="h-5 w-5" />
              </div>
            </div>

            <div className="relative mb-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher une école..."
                className="w-full rounded-2xl border border-white/10 bg-white/[0.045] py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-gray-600 focus:border-soraBlue/50"
              />
            </div>

            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {filteredInstitutions.length === 0 && (
                <p className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-8 text-center text-sm text-gray-500">Aucune institution trouvée.</p>
              )}
              {filteredInstitutions.map((institution) => (
                <button
                  key={institution.id}
                  onClick={() => setSelected(institution)}
                  className={cn(
                    "group w-full rounded-2xl border p-3 text-left transition",
                    selected?.id === institution.id
                      ? "border-soraBlue/45 bg-soraBlue/15 shadow-lg shadow-soraBlue/10"
                      : "border-white/8 bg-white/[0.025] hover:border-white/14 hover:bg-white/[0.055]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-soraBlue/35 to-soraGold/20 text-sm font-black text-white">
                      {institution.logo ? (
                        <img src={institution.logo} alt="" className="h-full w-full object-cover" />
                      ) : (
                        initials(institution.name)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white">{institution.name}</p>
                      <p className="mt-0.5 truncate font-mono text-xs text-gray-500">/{institution.slug}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusBadge status={institution.status} />
                    {institution.plan && <TierBadge tier={institution.plan.tier} />}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {selected && (
            <section className="rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.025] p-4">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Résumé client</p>
              <div className="space-y-3">
                {[
                  { icon: Crown, label: "Plan", value: selected.plan?.name || "Non défini" },
                  { icon: School, label: "Structure", value: structureLabel(selected.structure) },
                  { icon: Users, label: "Capacité élèves", value: selected.plan?.maxStudents ? selected.plan.maxStudents.toLocaleString("fr-FR") : "Illimité" },
                  { icon: CalendarDays, label: "Expiration", value: selected.expiresAt ? new Date(selected.expiresAt).toLocaleDateString("fr-FR") : "Non définie" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl bg-black/15 px-3 py-2.5">
                    <div className="flex items-center gap-2 text-gray-400">
                      <item.icon className="h-4 w-4" />
                      <span className="text-xs">{item.label}</span>
                    </div>
                    <span className="max-w-[165px] truncate text-right text-sm font-semibold text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </motion.aside>

        <motion.main
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="space-y-5"
        >
          {!selected ? (
            <div className="rounded-[2rem] border border-white/10 bg-soraCard p-14 text-center">
              <Building2 className="mx-auto mb-3 h-11 w-11 text-gray-700" />
              <p className="text-sm text-gray-500">Sélectionnez une institution à configurer.</p>
            </div>
          ) : (
            <>
              <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-soraCard shadow-2xl shadow-black/15">
                <div
                  className="relative p-6"
                  style={{
                    background: `radial-gradient(circle at top left, ${primaryColor}66, transparent 38%), linear-gradient(135deg, rgba(15,23,42,0.96), rgba(2,6,23,0.98))`,
                  }}
                >
                  <div className="absolute right-8 top-8 h-24 w-24 rounded-full opacity-30 blur-2xl" style={{ backgroundColor: accentColor }} />
                  <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-white/15 text-2xl font-black text-white shadow-xl" style={{ backgroundColor: primaryColor }}>
                        {form.logo ? <img src={form.logo} alt="" className="h-full w-full object-cover" /> : initials(form.name)}
                      </div>
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <StatusBadge status={selected.status} />
                          {selected.plan && <TierBadge tier={selected.plan.tier} />}
                        </div>
                        <h2 className="font-heading text-2xl font-black text-white">{form.name || selected.name}</h2>
                        <p className="mt-1 text-sm text-gray-400">{form.motto || "Devise de l’établissement non renseignée"}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[520px]">
                      {[
                        { label: "Portail", value: `/${selected.slug}`, icon: Link2 },
                        { label: "Plan", value: selected.plan?.monthlyPrice ? formatCurrency(selected.plan.monthlyPrice) : "—", icon: Crown },
                        { label: "Langues", value: `${(form.languages || []).length || 0}`, icon: Languages },
                        { label: "Sites", value: String(Math.max(establishments.length, selected.structure === "SINGLE_SCHOOL" ? 1 : establishments.length)), icon: Building2 },
                      ].map((stat) => (
                        <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.055] p-3">
                          <stat.icon className="mb-2 h-4 w-4 text-soraGold" />
                          <p className="truncate text-sm font-bold text-white">{stat.value}</p>
                          <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-gray-500">{stat.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <SectionCard
                icon={Building2}
                title="Identité officielle"
                subtitle="Informations visibles sur les portails, documents PDF, reçus, cartes et contrats."
              >
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                  <div className="lg:col-span-7">
                    <FieldLabel>Nom officiel</FieldLabel>
                    <input value={form.name || ""} onChange={(event) => setField("name", event.target.value)} className={inputCls} />
                  </div>
                  <div className="lg:col-span-5">
                    <FieldLabel>Type d’établissement</FieldLabel>
                    <select value={form.kind || "OTHER"} onChange={(event) => setField("kind", event.target.value)} className={inputCls}>
                      {KIND_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value} className="bg-soraCard">{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="lg:col-span-4">
                    <FieldLabel>Slug URL</FieldLabel>
                    <input value={selected.slug} disabled className={cn(inputCls, "font-mono")} />
                  </div>
                  <div className="lg:col-span-4">
                    <FieldLabel>Structure</FieldLabel>
                    <input value={structureLabel(selected.structure)} disabled className={inputCls} />
                  </div>
                  <div className="lg:col-span-4">
                    <FieldLabel>Année scolaire active</FieldLabel>
                    <input value={form.activeAcademicYearName || ""} onChange={(event) => setField("activeAcademicYearName", event.target.value)} placeholder="2025-2026" className={inputCls} />
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                icon={MapPin}
                title="Coordonnées & accès"
                subtitle="Informations utilisées pour les contacts, les factures et les documents officiels."
              >
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                  <div className="lg:col-span-4">
                    <FieldLabel>Ville</FieldLabel>
                    <input value={form.city || ""} onChange={(event) => setField("city", event.target.value)} placeholder="Abidjan" className={inputCls} />
                  </div>
                  <div className="lg:col-span-4">
                    <FieldLabel>Commune / quartier</FieldLabel>
                    <input value={form.district || ""} onChange={(event) => setField("district", event.target.value)} placeholder="Cocody Riviera" className={inputCls} />
                  </div>
                  <div className="lg:col-span-4">
                    <FieldLabel>Pays</FieldLabel>
                    <input value={form.country || ""} onChange={(event) => setField("country", event.target.value)} placeholder="Côte d'Ivoire" className={inputCls} />
                  </div>
                  <div className="lg:col-span-12">
                    <FieldLabel>Adresse complète</FieldLabel>
                    <input value={form.address || ""} onChange={(event) => setField("address", event.target.value)} placeholder="Rue, quartier, ville" className={inputCls} />
                  </div>
                  <div className="lg:col-span-3">
                    <FieldLabel>Téléphone</FieldLabel>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
                      <input value={form.phone || ""} onChange={(event) => setField("phone", event.target.value)} className={cn(inputCls, "pl-11")} />
                    </div>
                  </div>
                  <div className="lg:col-span-3">
                    <FieldLabel>WhatsApp</FieldLabel>
                    <input value={form.whatsapp || ""} onChange={(event) => setField("whatsapp", event.target.value)} placeholder="+225..." className={inputCls} />
                  </div>
                  <div className="lg:col-span-3">
                    <FieldLabel>Email</FieldLabel>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
                      <input value={form.email || ""} onChange={(event) => setField("email", event.target.value)} className={cn(inputCls, "pl-11")} />
                    </div>
                  </div>
                  <div className="lg:col-span-3">
                    <FieldLabel>Site web</FieldLabel>
                    <input value={form.website || ""} onChange={(event) => setField("website", event.target.value)} placeholder="https://..." className={inputCls} />
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                icon={Palette}
                title="Branding, langues & documents"
                subtitle="Personnalisez l’apparence utilisée dans les PDF, cartes, portails et espaces clients."
              >
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                  <div className="space-y-4">
                    <div>
                      <FieldLabel>Logo URL</FieldLabel>
                      <div className="relative">
                        <Image className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
                        <input value={form.logo || ""} onChange={(event) => setField("logo", event.target.value)} placeholder="https://.../logo.png" className={cn(inputCls, "pl-11")} />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div>
                        <FieldLabel>Devise / slogan</FieldLabel>
                        <input value={form.motto || ""} onChange={(event) => setField("motto", event.target.value)} placeholder="Excellence, Discipline, Réussite" className={inputCls} />
                      </div>
                      <div>
                        <FieldLabel>Devise monétaire</FieldLabel>
                        <select value={form.currency || "XOF"} onChange={(event) => setField("currency", event.target.value)} className={inputCls}>
                          {CURRENCY_OPTIONS.map((currency) => <option key={currency} value={currency} className="bg-soraCard">{currency}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Niveaux disponibles</FieldLabel>
                      <input
                        value={(form.levels || []).join(", ")}
                        onChange={(event) => setField("levels", splitList(event.target.value))}
                        placeholder="CP1, CP2, CE1, 6e, 5e, Terminale..."
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <FieldLabel>Langues du portail</FieldLabel>
                      <div className="flex flex-wrap gap-2">
                        {LANGUAGE_OPTIONS.map(([code, label]) => {
                          const active = (form.languages || []).includes(code);
                          return (
                            <button
                              key={code}
                              type="button"
                              onClick={() => toggleLanguage(code)}
                              className={cn(
                                "rounded-2xl border px-4 py-2 text-sm font-semibold transition",
                                active ? "border-soraBlue/45 bg-soraBlue/20 text-white" : "border-white/10 bg-white/[0.035] text-gray-400 hover:text-white"
                              )}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-white/10 bg-black/15 p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Palette officielle</p>
                    {[
                      ["primaryColor", "Principale", primaryColor],
                      ["secondaryColor", "Secondaire", secondaryColor],
                      ["accentColor", "Accent", accentColor],
                    ].map(([field, label, value]) => (
                      <div key={field} className="mb-3 last:mb-0">
                        <FieldLabel>{label}</FieldLabel>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={value}
                            onChange={(event) => setField(field as keyof Institution, event.target.value)}
                            className="h-11 w-12 cursor-pointer rounded-xl border border-white/10 bg-transparent"
                          />
                          <input
                            value={value}
                            onChange={(event) => setField(field as keyof Institution, event.target.value)}
                            className={cn(compactInputCls, "font-mono")}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                icon={ShieldCheck}
                title="Filiales / établissements"
                subtitle="Réservé au plan Entreprise : créez des campus, annexes ou établissements rattachés au groupe."
              >
                {!canCreateBranches && (
                  <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                    Cette institution est sur le plan {selected.plan?.name || "non défini"}. Le multi-établissement est réservé au plan Entreprise.
                  </div>
                )}

                <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
                  <input className={compactInputCls} disabled={!canCreateBranches} value={branchForm.name || ""} onChange={(event) => setBranchForm({ ...branchForm, name: event.target.value })} placeholder="Nom de l’établissement" />
                  <input className={compactInputCls} disabled={!canCreateBranches} value={branchForm.district || ""} onChange={(event) => setBranchForm({ ...branchForm, district: event.target.value })} placeholder="Commune / quartier" />
                  <input className={compactInputCls} disabled={!canCreateBranches} value={branchForm.city || ""} onChange={(event) => setBranchForm({ ...branchForm, city: event.target.value })} placeholder="Ville" />
                  <input className={compactInputCls} disabled={!canCreateBranches} value={branchForm.address || ""} onChange={(event) => setBranchForm({ ...branchForm, address: event.target.value })} placeholder="Adresse" />
                  <input className={compactInputCls} disabled={!canCreateBranches} value={branchForm.phone || ""} onChange={(event) => setBranchForm({ ...branchForm, phone: event.target.value })} placeholder="Téléphone établissement" />
                  <input className={compactInputCls} disabled={!canCreateBranches} value={branchForm.email || ""} onChange={(event) => setBranchForm({ ...branchForm, email: event.target.value })} placeholder="Email établissement" />
                  <input className={compactInputCls} disabled={!canCreateBranches} value={branchForm.directorName || ""} onChange={(event) => setBranchForm({ ...branchForm, directorName: event.target.value })} placeholder="Directeur affecté" />
                  <input className={compactInputCls} disabled={!canCreateBranches} value={branchForm.directorPhone || ""} onChange={(event) => setBranchForm({ ...branchForm, directorPhone: event.target.value })} placeholder="Téléphone directeur" />
                  <input className={compactInputCls} disabled={!canCreateBranches} value={branchForm.directorEmail || ""} onChange={(event) => setBranchForm({ ...branchForm, directorEmail: event.target.value })} placeholder="Email directeur" />
                </div>

                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    {branchMessage && (
                      <p className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-gray-300">
                        <AlertCircle className="h-4 w-4 text-soraGold" />
                        {branchMessage}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={() => selected && loadEstablishments(selected.id)}>
                      Actualiser
                    </Button>
                    <Button disabled={!canCreateBranches} loading={savingBranch} icon={<Plus className="h-4 w-4" />} onClick={createEstablishment}>
                      Créer l’établissement
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {establishments.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-gray-500 xl:col-span-2">
                      Aucun établissement rattaché pour le moment.
                    </p>
                  ) : establishments.map((establishment) => (
                    <div key={establishment.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{establishment.name}</p>
                          <p className="mt-1 text-xs text-gray-500">
                            {[establishment.district, establishment.city].filter(Boolean).join(" · ") || "Localisation non renseignée"} · /{establishment.slug}
                          </p>
                        </div>
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">{establishment.status}</span>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-gray-400 sm:grid-cols-2">
                        <span>{establishment.phone || "Téléphone non renseigné"}</span>
                        <span>{establishment.directorName || "Directeur non nommé"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </>
          )}
        </motion.main>
      </div>
    </div>
  );
}
