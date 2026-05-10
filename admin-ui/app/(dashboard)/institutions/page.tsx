"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  Building2,
  MoreVertical,
  Eye,
  ExternalLink,
  Copy,
  PauseCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Palette,
  ShieldCheck,
  UserCog,
  MapPin,
  CalendarDays,
  FileText,
  RefreshCw,
} from "lucide-react";
import { StatusBadge, TierBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { TableRowSkeleton } from "@/components/ui/skeleton";
import { downloadProtectedFile, superAdminApi, type Establishment, type Institution, type Plan } from "@/lib/api";
import { formatDate, cn } from "@/lib/utils";

const ITEMS_PER_PAGE = 10;

const STATUS_FILTERS = [
  { label: "Toutes", value: "all" },
  { label: "Actives", value: "active" },
  { label: "Essai", value: "trial" },
  { label: "Suspendues", value: "suspended" },
  { label: "Expirées", value: "expired" },
];

const KIND_OPTIONS = [
  ["MATERNELLE", "Maternelle"],
  ["PRIMARY", "Primaire"],
  ["COLLEGE", "Collège"],
  ["LYCEE", "Lycée"],
  ["GROUPE_SCOLAIRE", "Groupe Scolaire"],
  ["UNIVERSITY", "Université"],
  ["TRAINING_CENTER", "Centre de formation"],
  ["RELIGIOUS", "Institut religieux"],
  ["BILINGUAL", "Bilingue"],
  ["OTHER", "Autre"],
] as const;

const COUNTRIES = [
  { code: "CI", name: "Côte d'Ivoire", currency: "XOF", lang: "FR", family: "francophone" },
  { code: "SN", name: "Sénégal", currency: "XOF", lang: "FR", family: "francophone" },
  { code: "ML", name: "Mali", currency: "XOF", lang: "FR", family: "francophone" },
  { code: "BF", name: "Burkina Faso", currency: "XOF", lang: "FR", family: "francophone" },
  { code: "BJ", name: "Bénin", currency: "XOF", lang: "FR", family: "francophone" },
  { code: "NE", name: "Niger", currency: "XOF", lang: "FR", family: "francophone" },
  { code: "GN", name: "Guinée", currency: "GNF", lang: "FR", family: "francophone" },
  { code: "TG", name: "Togo", currency: "XOF", lang: "FR", family: "francophone" },
  { code: "GH", name: "Ghana", currency: "GHS", lang: "EN", family: "anglophone" },
  { code: "NG", name: "Nigeria", currency: "NGN", lang: "EN", family: "nigeria" },
  { code: "GM", name: "Gambie", currency: "GMD", lang: "EN", family: "anglophone" },
  { code: "SL", name: "Sierra Leone", currency: "SLL", lang: "EN", family: "anglophone" },
  { code: "LR", name: "Liberia", currency: "LRD", lang: "EN", family: "anglophone" },
  { code: "CV", name: "Cap-Vert", currency: "CVE", lang: "FR", family: "francophone" },
  { code: "GW", name: "Guinée-Bissau", currency: "XOF", lang: "FR", family: "francophone" },
  { code: "MR", name: "Mauritanie", currency: "MRO", lang: "AR", family: "mauritania" },
] as const;

type CountryFamily = "francophone" | "anglophone" | "nigeria" | "mauritania";

const LEVELS_BY_FAMILY: Record<CountryFamily, Record<string, string>> = {
  francophone: {
    MATERNELLE: "PS, MS, GS",
    PRIMARY: "CP1, CP2, CE1, CE2, CM1, CM2",
    COLLEGE: "6EME, 5EME, 4EME, 3EME",
    LYCEE: "2NDE, 1ERE, TLE",
    TRAINING_CENTER: "G1, G2, BT",
    GROUPE_SCOLAIRE: "PS, MS, GS, CP1, CP2, CE1, CE2, CM1, CM2, 6EME, 5EME, 4EME, 3EME, 2NDE, 1ERE, TLE",
    UNIVERSITY: "",
    RELIGIOUS: "CP1, CP2, CE1, CE2, CM1, CM2, 6EME, 5EME, 4EME, 3EME",
    BILINGUAL: "CP1, CP2, CE1, CE2, CM1, CM2, 6EME, 5EME, 4EME, 3EME, 2NDE, 1ERE, TLE",
    OTHER: "",
  },
  anglophone: {
    MATERNELLE: "PS, MS, GS",
    PRIMARY: "P1, P2, P3, P4, P5, P6",
    COLLEGE: "JHS1, JHS2, JHS3",
    LYCEE: "SHS1, SHS2, SHS3",
    TRAINING_CENTER: "G1, G2, BT",
    GROUPE_SCOLAIRE: "P1, P2, P3, P4, P5, P6, JHS1, JHS2, JHS3, SHS1, SHS2, SHS3",
    UNIVERSITY: "",
    RELIGIOUS: "P1, P2, P3, P4, P5, P6",
    BILINGUAL: "P1, P2, P3, P4, P5, P6, JHS1, JHS2, JHS3, SHS1, SHS2, SHS3",
    OTHER: "",
  },
  nigeria: {
    MATERNELLE: "PS, MS, GS",
    PRIMARY: "P1, P2, P3, P4, P5, P6",
    COLLEGE: "JSS1, JSS2, JSS3",
    LYCEE: "SSS1, SSS2, SSS3",
    TRAINING_CENTER: "G1, G2, BT",
    GROUPE_SCOLAIRE: "P1, P2, P3, P4, P5, P6, JSS1, JSS2, JSS3, SSS1, SSS2, SSS3",
    UNIVERSITY: "",
    RELIGIOUS: "P1, P2, P3, P4, P5, P6",
    BILINGUAL: "P1, P2, P3, P4, P5, P6, JSS1, JSS2, JSS3, SSS1, SSS2, SSS3",
    OTHER: "",
  },
  mauritania: {
    MATERNELLE: "PS, MS, GS",
    PRIMARY: "AN1, AN2, AN3, AN4, AN5, AN6",
    COLLEGE: "7EME, 8EME, 9EME",
    LYCEE: "2NDE, 1ERE, TLE",
    TRAINING_CENTER: "G1, G2, BT",
    GROUPE_SCOLAIRE: "AN1, AN2, AN3, AN4, AN5, AN6, 7EME, 8EME, 9EME, 2NDE, 1ERE, TLE",
    UNIVERSITY: "",
    RELIGIOUS: "AN1, AN2, AN3, AN4, AN5, AN6",
    BILINGUAL: "AN1, AN2, AN3, AN4, AN5, AN6, 7EME, 8EME, 9EME, 2NDE, 1ERE, TLE",
    OTHER: "",
  },
};

function getSuggestedLevels(countryCode: string, kind: string): string {
  const country = COUNTRIES.find((c) => c.code === countryCode);
  if (!country) return "";
  return LEVELS_BY_FAMILY[country.family as CountryFamily]?.[kind] ?? "";
}

function getPortalUrl(slug: string) {
  if (typeof window === "undefined") return `/${slug}/login`;
  return `${window.location.origin}/${slug}/login`;
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function copyText(value: string) {
  navigator.clipboard?.writeText(value).catch(() => undefined);
}

async function fetchOfficialPlans() {
  const first = await superAdminApi.plans();
  if (first.data?.plans?.length) return first.data.plans;

  // Safety net for fresh local databases: the backend normally auto-seeds
  // official plans, but this keeps the UI usable if the first request is stale.
  await superAdminApi.syncDefaultPlans();
  const second = await superAdminApi.plans();
  return second.data?.plans || [];
}

function contractFilename(institution: Institution) {
  return `fiche-contrat-installation-${institution.slug}.pdf`;
}

function FormSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-soraBlue/15 flex items-center justify-center text-soraBlue">
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

interface RowMenuProps {
  institution: Institution;
  onView: (institution: Institution) => void;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onEditPlan: (institution: Institution) => void;
}

function RowMenu({ institution, onView, onStatusChange, onDelete, onEditPlan }: RowMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-44 bg-soraCard border border-white/10 rounded-xl shadow-2xl overflow-hidden z-20">
            <div className="p-1">
              <button
                onClick={() => {
                  onView(institution);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/8 hover:text-white transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                Voir les détails
              </button>
              <button
                onClick={() => {
                  window.open(`/${institution.slug}/login`, "_blank", "noopener,noreferrer");
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/8 hover:text-white transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Ouvrir portail
              </button>
              <button
                onClick={() => {
                  downloadProtectedFile(
                    `/api/super-admin/institutions/${institution.id}/installation-contract`,
                    contractFilename(institution)
                  );
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/8 hover:text-white transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                Fiche contrat PDF
              </button>
              <button
                onClick={() => {
                  const newStatus = institution.status === "active" ? "suspended" : "active";
                  onStatusChange(institution.id, newStatus);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/8 hover:text-white transition-colors"
              >
                <PauseCircle className="w-3.5 h-3.5" />
                {institution.status === "active" ? "Suspendre" : "Activer"}
              </button>
              <button
                onClick={() => {
                  onEditPlan(institution);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-soraBlue hover:bg-soraBlue/10 hover:text-blue-300 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Modifier le plan
              </button>
              <div className="h-px bg-white/8 my-1" />
              <button
                onClick={() => {
                  onDelete(institution.id);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function EditPlanModal({ institution, onClose, onUpdated }: {
  institution: Institution | null;
  onClose: () => void;
  onUpdated: (inst: Institution) => void;
}) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState("");
  const [billingCycle, setBillingCycle] = useState("ANNUAL");
  const [status, setStatus] = useState("ACTIVE");
  const [schoolYears, setSchoolYears] = useState("1");
  const [generateInvoice, setGenerateInvoice] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputCls = "w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-soraBlue/50 transition-colors text-sm";
  const labelCls = "block text-xs font-medium text-gray-400 mb-1.5";

  useEffect(() => {
    if (!institution) return;
    fetchOfficialPlans().then((officialPlans) => {
      setPlans(officialPlans);
      if (!institution.plan?.id && officialPlans[0]) setPlanId(officialPlans[0].id);
    });
    setPlanId(institution.plan?.id || "");
    setStatus(institution.status === "active" ? "ACTIVE" : institution.status === "trial" ? "TRIAL" : "SUSPENDED");
  }, [institution]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institution) return;
    setLoading(true); setError(null);
    const { error: err } = await superAdminApi.updateInstitutionSubscription(institution.id, {
      planId, billingCycle, status,
      schoolYears: Number(schoolYears),
      generateInvoice
    });
    setLoading(false);
    if (err) { setError(err); return; }
    onUpdated({ ...institution, status: status.toLowerCase() as Institution["status"] });
    onClose();
  };

  const selectedPlan = plans.find(p => p.id === planId);

  return (
    <Modal isOpen={!!institution} onClose={onClose} title={`Modifier le plan — ${institution?.name}`} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Nouveau plan *</label>
          <select required value={planId} onChange={e => setPlanId(e.target.value)} className={inputCls}>
            <option value="" className="bg-soraCard">— Choisir un plan —</option>
            {plans.map(p => (
              <option key={p.id} value={p.id} className="bg-soraCard">
                {p.name} — {((p.installationFee ?? 0) + p.annualPrice).toLocaleString()} FCFA/1ère année
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Cycle de facturation</label>
          <select value={billingCycle} onChange={e => setBillingCycle(e.target.value)} className={inputCls}>
            <option value="ANNUAL" className="bg-soraCard">Abonnement annuel</option>
            <option value="SCHOOL_YEAR" className="bg-soraCard">Année scolaire</option>
            <option value="MULTI_YEAR" className="bg-soraCard">Multi-années scolaires</option>
          </select>
        </div>
        {(billingCycle === "SCHOOL_YEAR" || billingCycle === "MULTI_YEAR") && (
          <div>
            <label className={labelCls}>Nombre d&apos;années scolaires</label>
            <input type="number" min="1" max="10" value={schoolYears} onChange={e => setSchoolYears(e.target.value)} className={inputCls} />
          </div>
        )}
        <div>
          <label className={labelCls}>Statut</label>
          <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
            <option value="ACTIVE" className="bg-soraCard">Actif</option>
            <option value="TRIAL" className="bg-soraCard">Essai gratuit</option>
            <option value="PENDING_PAYMENT" className="bg-soraCard">En attente de paiement</option>
            <option value="SUSPENDED" className="bg-soraCard">Suspendu</option>
          </select>
        </div>
        {selectedPlan && (
          <div className="rounded-xl border border-soraBlue/20 bg-soraBlue/5 px-4 py-3 text-sm">
            <p className="text-soraBlue font-semibold">{selectedPlan.name} — {selectedPlan.tier}</p>
            <p className="text-gray-400 mt-1">
              Abonnement annuel : {selectedPlan.annualPrice.toLocaleString()} FCFA/an
              {" · "}<span className="text-emerald-400">1ère année : {((selectedPlan.installationFee ?? 0) + selectedPlan.annualPrice).toLocaleString()} FCFA</span>
            </p>
          </div>
        )}
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={generateInvoice} onChange={e => setGenerateInvoice(e.target.checked)}
            className="w-4 h-4 rounded accent-soraBlue" />
          <span className="text-sm text-gray-300">Générer une nouvelle facture SaaS</span>
        </label>
        {error && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose} className="flex-1">Annuler</Button>
          <Button type="submit" loading={loading} className="flex-1">Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}

function NewInstitutionModal({ isOpen, onClose, onCreated }: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (inst: Institution) => void;
}) {
  const emptyForm = {
    name: "", slug: "", kind: "LYCEE",
    country: "CI", city: "", district: "", address: "",
    phone: "", whatsapp: "", email: "", website: "",
    logoUrl: "", motto: "", activeAcademicYearName: "2025-2026",
    currency: "XOF", languages: "FR", levels: "2NDE, 1ERE, TLE",
    primaryColor: "#064E3B", secondaryColor: "#F7F1DE", accentColor: "#C89B3C",
    directorName: "", directorPhone: "", directorEmail: "",
    planId: "", billingCycle: "ANNUAL", status: "TRIAL",
    estimatedStudents: "", estimatedTeachers: "", schoolYears: "1",
  };
  const [formData, setFormData] = useState(emptyForm);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    fetchOfficialPlans().then((officialPlans) => {
      if (!active) return;
      setPlans(officialPlans);
      const basic = officialPlans.find((plan) => plan.code === "BASIC") ?? officialPlans[0];
      if (basic) setFormData((prev) => ({ ...prev, planId: prev.planId || basic.id }));
    });
    return () => { active = false; };
  }, [isOpen]);

  const set = (field: string, value: string) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleCountryChange = (code: string) => {
    const country = COUNTRIES.find((c) => c.code === code);
    if (!country) return;
    const suggestedLevels = getSuggestedLevels(code, formData.kind);
    setFormData(prev => ({
      ...prev,
      country: code,
      currency: country.currency,
      languages: country.lang,
      ...(suggestedLevels ? { levels: suggestedLevels } : {}),
    }));
  };

  const handleKindChange = (kind: string) => {
    const suggestedLevels = getSuggestedLevels(formData.country, kind);
    setFormData(prev => ({
      ...prev,
      kind,
      ...(suggestedLevels ? { levels: suggestedLevels } : {}),
    }));
  };

  const selectedPlan = plans.find((plan) => plan.id === formData.planId);
  const isMultiSchool = selectedPlan?.canCreateBranches === true;

  const generateSlug = (name: string) =>
    name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const inputCls = "w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder:text-gray-600 focus:border-soraBlue/50 focus:bg-white/[0.06] transition-colors text-sm";
  const labelCls = "block text-xs font-medium text-gray-400 mb-1.5";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    if (!selectedPlan) {
      setLoading(false);
      setError("Veuillez choisir un plan d'abonnement");
      return;
    }
    const payload = {
      name: formData.name, slug: formData.slug || undefined,
      kind: formData.kind, city: formData.city || undefined,
      country: COUNTRIES.find((c) => c.code === formData.country)?.name || formData.country,
      district: formData.district || undefined,
      address: formData.address || undefined,
      phone: formData.phone || undefined, email: formData.email || undefined,
      whatsapp: formData.whatsapp || undefined,
      website: formData.website || undefined,
      logoUrl: formData.logoUrl || undefined,
      motto: formData.motto || undefined,
      activeAcademicYearName: formData.activeAcademicYearName || undefined,
      currency: formData.currency || undefined,
      languages: splitList(formData.languages),
      levels: splitList(formData.levels),
      primaryColor: formData.primaryColor,
      secondaryColor: formData.secondaryColor,
      accentColor: formData.accentColor,
      directorName: isMultiSchool ? undefined : formData.directorName,
      directorPhone: isMultiSchool ? undefined : formData.directorPhone,
      directorEmail: isMultiSchool ? undefined : formData.directorEmail || undefined,
      centralAdminName: isMultiSchool ? formData.directorName : undefined,
      centralAdminPhone: isMultiSchool ? formData.directorPhone : undefined,
      centralAdminEmail: isMultiSchool ? formData.directorEmail || undefined : undefined,
      planId: formData.planId,
      billingCycle: formData.billingCycle as "MONTHLY" | "ANNUAL" | "SCHOOL_YEAR" | "MULTI_YEAR",
      status: formData.status as "TRIAL" | "ACTIVE",
      schoolYears: formData.schoolYears ? Number(formData.schoolYears) : undefined,
      estimatedStudents: formData.estimatedStudents ? Number(formData.estimatedStudents) : undefined,
      estimatedTeachers: formData.estimatedTeachers ? Number(formData.estimatedTeachers) : undefined,
    };
    const { data, error: err } = await superAdminApi.createInstitution(payload);
    setLoading(false);
    if (err || !data) { setError(err || "Erreur lors de la création"); return; }
    onCreated(data.institution);
    onClose();
    setFormData(emptyForm);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Créer un client SaaS" size="xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormSection
          icon={ShieldCheck}
          title="Plan et structure"
          description="Basic = école unique (1 établissement). Premium = groupe scolaire multi-établissements (Administration Centrale)."
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className={labelCls}>Plan *</label>
              <select required value={formData.planId} onChange={(e) => set("planId", e.target.value)} className={inputCls}>
                <option value="" className="bg-soraCard">— Choisir un plan —</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id} className="bg-soraCard">
                    {plan.name} — {((plan.installationFee ?? 0) + plan.annualPrice).toLocaleString()} FCFA/1ère année
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Statut initial</label>
              <select value={formData.status} onChange={(e) => set("status", e.target.value)} className={inputCls}>
                <option value="TRIAL" className="bg-soraCard">Essai gratuit</option>
                <option value="ACTIVE" className="bg-soraCard">Actif immédiatement</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Facturation</label>
              <select value={formData.billingCycle} onChange={(e) => set("billingCycle", e.target.value)} className={inputCls}>
                <option value="ANNUAL" className="bg-soraCard">Abonnement annuel</option>
                <option value="SCHOOL_YEAR" className="bg-soraCard">Année scolaire</option>
                <option value="MULTI_YEAR" className="bg-soraCard">Multi-années scolaires</option>
              </select>
            </div>
            {(formData.billingCycle === "SCHOOL_YEAR" || formData.billingCycle === "MULTI_YEAR") && (
              <div>
                <label className={labelCls}>Nombre d&apos;années scolaires</label>
                <input
                  type="number" min="1" max="10"
                  value={formData.schoolYears}
                  onChange={(e) => set("schoolYears", e.target.value)}
                  className={inputCls}
                />
              </div>
            )}
            <div className="md:col-span-2 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <p className={cn("text-sm font-semibold", isMultiSchool ? "text-purple-300" : "text-emerald-400")}>
                {isMultiSchool ? "Mode Premium : groupe scolaire multi-établissements" : "Mode Basic : école unique"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {isMultiSchool
                  ? "Crée un groupe scolaire avec Administration Centrale. Les écoles/campus seront ajoutés dans l'espace groupe."
                  : "Crée directement une école avec son compte Direction."}
              </p>
              {selectedPlan && (
                <p className="text-xs text-gray-400 mt-1.5">
                  Frais d'installation : {(selectedPlan.installationFee ?? 0).toLocaleString()} FCFA
                  {" · "}Abonnement annuel : {selectedPlan.annualPrice.toLocaleString()} FCFA
                  {" · "}<span className="text-emerald-400 font-medium">Total 1ère année : {((selectedPlan.installationFee ?? 0) + selectedPlan.annualPrice).toLocaleString()} FCFA</span>
                </p>
              )}
            </div>
          </div>
        </FormSection>

        <FormSection icon={Building2} title={isMultiSchool ? "Identité du groupe" : "Identité de l'école"}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className={labelCls}>{isMultiSchool ? "Nom Administration Centrale / Groupe *" : "Nom de l'école *"}</label>
              <input required type="text" value={formData.name} placeholder={isMultiSchool ? "Groupe Scolaire X" : "Lycée des Roses"}
                onChange={(e) => { set("name", e.target.value); set("slug", generateSlug(e.target.value)); }}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Slug d'accès *</label>
              <input required type="text" value={formData.slug} placeholder="groupe-scolaire-x"
                onChange={(e) => set("slug", e.target.value)} className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className={labelCls}>Type *</label>
              <select value={formData.kind} onChange={(e) => handleKindChange(e.target.value)} className={inputCls}>
                {KIND_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value} className="bg-soraCard">{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Devise / slogan</label>
              <input type="text" value={formData.motto} placeholder="Discipline - Excellence - Réussite"
                onChange={(e) => set("motto", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Année scolaire active</label>
              <input type="text" value={formData.activeAcademicYearName} placeholder="2025-2026"
                onChange={(e) => set("activeAcademicYearName", e.target.value)} className={inputCls} />
            </div>
          </div>
        </FormSection>

        <FormSection icon={MapPin} title="Localisation et contacts">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Pays</label>
              <select value={formData.country} onChange={(e) => handleCountryChange(e.target.value)} className={inputCls}>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code} className="bg-soraCard">{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Ville</label>
              <input value={formData.city} placeholder="Abidjan" onChange={(e) => set("city", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Commune / quartier</label>
              <input value={formData.district} placeholder="Cocody Riviera" onChange={(e) => set("district", e.target.value)} className={inputCls} />
            </div>
            <div className="md:col-span-3">
              <label className={labelCls}>Adresse complète</label>
              <input value={formData.address} placeholder="Rue, quartier, repère..." onChange={(e) => set("address", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Téléphone</label>
              <input value={formData.phone} placeholder="+225 07 00 00 00 00" onChange={(e) => set("phone", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>WhatsApp</label>
              <input value={formData.whatsapp} placeholder="+225 07 00 00 00 00" onChange={(e) => set("whatsapp", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={formData.email} placeholder="contact@ecole.ci" onChange={(e) => set("email", e.target.value)} className={inputCls} />
            </div>
            <div className="md:col-span-3">
              <label className={labelCls}>Site web</label>
              <input type="url" value={formData.website} placeholder="https://ecole.ci" onChange={(e) => set("website", e.target.value)} className={inputCls} />
            </div>
          </div>
        </FormSection>

        <FormSection icon={UserCog} title={isMultiSchool ? "Compte Administrateur Central" : "Compte Direction"}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>{isMultiSchool ? "Nom admin central *" : "Nom directeur *"}</label>
              <input required value={formData.directorName} placeholder={isMultiSchool ? "Groupe Scolaire X" : "Koné Aminata"}
                onChange={(e) => set("directorName", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{isMultiSchool ? "Téléphone admin central *" : "Téléphone directeur *"}</label>
              <input required value={formData.directorPhone} placeholder="+225 07 59 77 99 13"
                onChange={(e) => set("directorPhone", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={formData.directorEmail} placeholder={isMultiSchool ? "groupe@ecole.ci" : "directeur@ecole.ci"}
                onChange={(e) => set("directorEmail", e.target.value)} className={inputCls} />
            </div>
          </div>
        </FormSection>

        <FormSection icon={CalendarDays} title="Capacité et niveaux">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Apprenants estimés</label>
              <input type="number" min="0" value={formData.estimatedStudents} placeholder="500"
                onChange={(e) => set("estimatedStudents", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Enseignants estimés</label>
              <input type="number" min="0" value={formData.estimatedTeachers} placeholder="30"
                onChange={(e) => set("estimatedTeachers", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Langues</label>
              <input value={formData.languages} placeholder="FR, EN, AR" onChange={(e) => set("languages", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Monnaie</label>
              <input value={formData.currency} placeholder="XOF" onChange={(e) => set("currency", e.target.value.toUpperCase())} className={inputCls} />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Niveaux proposés</label>
              <textarea rows={2} value={formData.levels} onChange={(e) => set("levels", e.target.value)}
                className={`${inputCls} resize-none`} />
            </div>
          </div>
        </FormSection>

        <FormSection icon={Palette} title="Image de marque">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-4">
              <label className={labelCls}>Logo URL</label>
              <input type="url" value={formData.logoUrl} placeholder="https://..." onChange={(e) => set("logoUrl", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Couleur principale</label>
              <input type="color" value={formData.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} className="w-full h-11 bg-white/[0.04] border border-white/10 rounded-xl p-1" />
            </div>
            <div>
              <label className={labelCls}>Secondaire</label>
              <input type="color" value={formData.secondaryColor} onChange={(e) => set("secondaryColor", e.target.value)} className="w-full h-11 bg-white/[0.04] border border-white/10 rounded-xl p-1" />
            </div>
            <div>
              <label className={labelCls}>Accent</label>
              <input type="color" value={formData.accentColor} onChange={(e) => set("accentColor", e.target.value)} className="w-full h-11 bg-white/[0.04] border border-white/10 rounded-xl p-1" />
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <p className="text-xs text-gray-500">Aperçu</p>
              <div className="mt-2 flex gap-1">
                {[formData.primaryColor, formData.secondaryColor, formData.accentColor].map((color) => (
                  <span key={color} className="h-5 flex-1 rounded-md" style={{ backgroundColor: color }} />
                ))}
              </div>
            </div>
          </div>
        </FormSection>

        {error && (
          <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">{error}</div>
        )}
        <div className="sticky -bottom-6 -mx-6 px-6 py-4 bg-soraCard/95 backdrop-blur-xl border-t border-white/8 flex gap-3">
          <Button variant="secondary" type="button" onClick={onClose} className="flex-1">Annuler</Button>
          <Button type="submit" loading={loading} className="flex-1">
            {isMultiSchool ? "Créer l'administration centrale" : "Créer l'école"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function InstitutionDetailsModal({
  institution,
  onClose,
}: {
  institution: Institution | null;
  onClose: () => void;
}) {
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!institution) return;
    setLoading(true);
    superAdminApi.establishments(institution.id).then(({ data }) => {
      setEstablishments(data?.establishments || []);
      setLoading(false);
    });
  }, [institution]);

  if (!institution) return null;

  const isMultiSchool = institution.structure === "CENTRAL_ADMINISTRATION" || institution.plan?.canCreateBranches === true;
  const portalUrl = getPortalUrl(institution.slug);
  const accessName = isMultiSchool ? institution.centralAdminName : institution.directorName;
  const accessPhone = isMultiSchool ? institution.centralAdminPhone : institution.directorPhone;
  const accessEmail = isMultiSchool ? institution.centralAdminEmail : institution.directorEmail;
  const downloadContract = async () => {
    await downloadProtectedFile(
      `/api/super-admin/institutions/${institution.id}/installation-contract`,
      contractFilename(institution)
    );
  };

  return (
    <Modal isOpen={!!institution} onClose={onClose} title="Détails et accès" size="xl">
      <div className="space-y-5">
        <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-soraBlue/15 to-transparent p-5">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/8 text-xs font-semibold text-gray-300 mb-3">
                {isMultiSchool ? "Administration Centrale Premium" : "École unique Basic"}
              </div>
              <h3 className="text-xl font-bold text-white font-heading">{institution.name}</h3>
              <p className="text-sm text-gray-400 mt-1">/{institution.slug} · {institution.type}</p>
              <p className="text-xs text-gray-500 mt-2">
                {isMultiSchool
                  ? "Le groupe se connecte ici, puis crée ses écoles/campus et nomme chaque directeur."
                  : "La direction se connecte ici pour gérer son école unique."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" icon={<ExternalLink className="w-4 h-4" />} onClick={() => window.open(portalUrl, "_blank", "noopener,noreferrer")}>
                Ouvrir portail
              </Button>
              <Button size="sm" variant="secondary" icon={<FileText className="w-4 h-4" />} onClick={downloadContract}>
                Fiche contrat PDF
              </Button>
              <Button size="sm" variant="secondary" icon={<Copy className="w-4 h-4" />} onClick={() => copyText(portalUrl)}>
                Copier lien
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
            <p className="text-xs font-semibold text-soraGold uppercase tracking-widest mb-3">Accès principal</p>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Lien</span>
                <button onClick={() => copyText(portalUrl)} className="text-soraBlue hover:text-blue-300 font-mono text-xs truncate">
                  {portalUrl}
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">{isMultiSchool ? "Admin central" : "Directeur"}</span>
                <span className="text-white text-right">{accessName || "Non renseigné"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Téléphone login</span>
                <button onClick={() => accessPhone && copyText(accessPhone)} className="text-white font-mono text-right">
                  {accessPhone || "Non renseigné"}
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-500">Email</span>
                <span className="text-white text-right">{accessEmail || "—"}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-3">Résumé SaaS</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500">Plan</p>
                <p className="text-white font-semibold">{institution.plan?.name || "—"}</p>
              </div>
              <div>
                <p className="text-gray-500">Statut</p>
                <StatusBadge status={institution.status} />
              </div>
              <div>
                <p className="text-gray-500">Expiration</p>
                <p className="text-white">{institution.expiresAt ? formatDate(institution.expiresAt) : "—"}</p>
              </div>
              <div>
                <p className="text-gray-500">Ville</p>
                <p className="text-white">{institution.city || "—"}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest">Établissements rattachés</p>
              <p className="text-xs text-gray-500 mt-1">
                Les directeurs utilisent le même portail `/{institution.slug}/login`; leur numéro les limite automatiquement à leur établissement.
              </p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-white/8 text-gray-400">{establishments.length}</span>
          </div>
          {loading ? (
            <div className="text-sm text-gray-500 py-6">Chargement des établissements...</div>
          ) : establishments.length === 0 ? (
            <div className="text-sm text-gray-500 py-6">Aucun établissement créé pour le moment.</div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {establishments.map((establishment) => (
                <div key={establishment.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{establishment.name}</p>
                    <p className="text-xs text-gray-500">
                      {[establishment.district, establishment.city].filter(Boolean).join(" · ") || "Adresse non renseignée"}
                    </p>
                  </div>
                  <div className="text-xs text-right">
                    <p className="text-gray-500">Directeur</p>
                    <p className="text-soraGold">{establishment.directorName || "Non nommé"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function InstitutionsPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [showNewModal, setShowNewModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Institution | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<Institution | null>(null);
  const [editPlanTarget, setEditPlanTarget] = useState<Institution | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data } = await superAdminApi.institutions();
      setInstitutions(data?.institutions || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    return institutions.filter((inst) => {
      const matchSearch =
        search === "" ||
        inst.name.toLowerCase().includes(search.toLowerCase()) ||
        inst.slug.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || inst.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [institutions, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleStatusChange = async (id: string, status: string) => {
    setActionLoading(id);
    const { error } = await superAdminApi.updateInstitutionStatus(id, status);
    setActionLoading(null);
    if (!error) {
      setInstitutions((prev) =>
        prev.map((inst) => inst.id === id ? { ...inst, status: status as Institution["status"] } : inst)
      );
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    const { error } = await superAdminApi.deleteInstitution(id);
    setActionLoading(null);
    setDeleteTarget(null);
    if (!error) {
      setInstitutions((prev) => prev.filter((inst) => inst.id !== id));
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px]">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold font-heading text-white">Écoles clientes</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {filtered.length} institution{filtered.length !== 1 ? "s" : ""} trouvée{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowNewModal(true)}>
          Nouvelle école
        </Button>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-3"
      >
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Rechercher par nom ou slug..."
            className="w-full bg-soraCard border border-white/8 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-white/20 transition-colors"
          />
        </div>

        {/* Status filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-gray-500" />
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
                statusFilter === f.value
                  ? "bg-soraBlue text-white shadow-glow-blue"
                  : "bg-white/[0.05] text-gray-400 hover:bg-white/10 hover:text-white"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-soraCard border border-white/8 rounded-2xl overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px]">
            <thead>
              <tr className="border-b border-white/8">
                {["Institution", "Slug", "Type", "Statut", "Plan", "Expiration", "Ajoutée le", ""].map((col) => (
                  <th
                    key={col}
                    className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} cols={8} />)
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <Building2 className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">Aucune institution trouvée</p>
                    <p className="text-gray-600 text-sm mt-1">Modifiez vos filtres ou créez une nouvelle école</p>
                  </td>
                </tr>
              ) : (
                paginated.map((inst) => (
                  <tr
                    key={inst.id}
                    className={cn(
                      "hover:bg-white/[0.02] transition-colors",
                      actionLoading === inst.id && "opacity-50"
                    )}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-soraBlue/15 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-soraBlue" />
                        </div>
                        <span className="text-sm font-medium text-white">{inst.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded-md">
                        {inst.slug}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-400">
                        {inst.structure === "CENTRAL_ADMINISTRATION" ? "Groupe / Admin Centrale" : inst.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={inst.status} />
                    </td>
                    <td className="px-6 py-4">
                      {inst.plan ? (
                        <TierBadge tier={inst.plan.tier} />
                      ) : (
                        <span className="text-gray-600 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {inst.expiresAt ? (
                        <span className={cn(
                          "text-sm",
                          new Date(inst.expiresAt) < new Date() ? "text-red-400" : "text-gray-400"
                        )}>
                          {formatDate(inst.expiresAt)}
                        </span>
                      ) : (
                        <span className="text-gray-600 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-400">{formatDate(inst.createdAt)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <RowMenu
                        institution={inst}
                        onView={setDetailsTarget}
                        onStatusChange={handleStatusChange}
                        onDelete={(id) => setDeleteTarget(institutions.find((i) => i.id === id) || null)}
                        onEditPlan={setEditPlanTarget}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/8">
            <p className="text-sm text-gray-400">
              Page {page} sur {totalPages} · {filtered.length} résultats
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/8 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = totalPages <= 5 ? i + 1 :
                  page <= 3 ? i + 1 :
                  page >= totalPages - 2 ? totalPages - 4 + i :
                  page - 2 + i;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={cn(
                      "w-8 h-8 rounded-lg text-sm font-medium transition-colors",
                      pageNum === page
                        ? "bg-soraBlue text-white"
                        : "text-gray-400 hover:text-white hover:bg-white/8"
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/8 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* New institution modal */}
      <NewInstitutionModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreated={(inst) => {
          setInstitutions((prev) => [inst, ...prev]);
          setDetailsTarget(inst);
        }}
      />

      <InstitutionDetailsModal
        institution={detailsTarget}
        onClose={() => setDetailsTarget(null)}
      />

      <EditPlanModal
        institution={editPlanTarget}
        onClose={() => setEditPlanTarget(null)}
        onUpdated={(updated) => {
          setInstitutions((prev) => prev.map((i) => i.id === updated.id ? { ...i, ...updated } : i));
          setEditPlanTarget(null);
        }}
      />

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Confirmer la suppression"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-300 text-sm">
            Êtes-vous sûr de vouloir supprimer{" "}
            <span className="text-white font-medium">{deleteTarget?.name}</span> ?
            Cette action est irréversible.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} className="flex-1">
              Annuler
            </Button>
            <Button
              variant="danger"
              loading={actionLoading === deleteTarget?.id}
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
              className="flex-1"
            >
              Supprimer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
