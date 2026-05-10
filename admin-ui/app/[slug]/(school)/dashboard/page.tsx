"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  GraduationCap,
  BookOpen,
  LayoutGrid,
  DollarSign,
  AlertCircle,
  UserPlus,
  CreditCard,
  ClipboardCheck,
  TrendingUp,
  Users,
  Building2,
  Plus,
  UserCog,
  MapPin,
  ArrowUpRight,
  Clock,
  FileText,
  ShieldCheck,
  WalletCards,
  BarChart3,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { schoolApi, type CentralSchool, type CreateCentralSchoolInput, type SchoolDashboardData, type Student } from "@/lib/school-api";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  sub,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  sub?: string;
  href?: string;
}) {
  const content = (
    <motion.div variants={item}>
      <div className="sora-premium-card group rounded-2xl p-5 transition-all hover:-translate-y-0.5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-white font-heading mt-1.5">{value}</p>
            {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
          </div>
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color)}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
        {href && (
          <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-emerald-700">
            Ouvrir le module <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
        )}
      </div>
    </motion.div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function SkeletonCard() {
  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 animate-pulse">
      <div className="h-3 bg-white/10 rounded w-24 mb-3" />
      <div className="h-7 bg-white/10 rounded w-16" />
    </div>
  );
}

function RevenueBar({ data }: { data: { month: string; amount: number }[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.amount), 1);
  return (
    <div className="flex items-end gap-1.5 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${(d.amount / max) * 80}px` }}
            transition={{ duration: 0.6, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
            className="w-full rounded-t-md bg-gradient-to-t from-emerald-700 to-emerald-500 min-h-[4px]"
          />
          <span className="text-[9px] text-gray-600">{d.month}</span>
        </div>
      ))}
    </div>
  );
}

function studentStatusBadge(status: string) {
  const map: Record<string, string> = {
    ACTIVE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    ENROLLED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    INACTIVE: "bg-gray-500/15 text-gray-400 border-gray-500/25",
    PENDING: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    SUSPENDED: "bg-red-500/15 text-red-400 border-red-500/25",
    GRADUATED: "bg-blue-500/15 text-blue-400 border-blue-500/25",
    TRANSFERRED: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  };
  const labels: Record<string, string> = {
    ACTIVE: "Actif",
    ENROLLED: "Inscrit",
    INACTIVE: "Inactif",
    PENDING: "En attente",
    SUSPENDED: "Suspendu",
    GRADUATED: "Diplômé",
    TRANSFERRED: "Transféré",
  };
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", map[status] || "bg-gray-500/15 text-gray-400 border-gray-500/25")}>
      {labels[status] || status}
    </span>
  );
}

function emptyRevenue() {
  const months = ["Nov", "Déc", "Jan", "Fév", "Mar", "Avr"];
  return months.map((month) => ({ month, amount: 0 }));
}

function safeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function shortNumber(value: number) {
  return new Intl.NumberFormat("fr-CI", { notation: value >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

const KIND_OPTIONS = [
  ["PRIMARY", "Primaire"],
  ["COLLEGE", "Collège"],
  ["LYCEE", "Lycée"],
  ["UNIVERSITY", "Université"],
  ["TRAINING_CENTER", "Centre de formation"],
  ["RELIGIOUS", "Institut religieux"],
  ["OTHER", "Autre"],
] as const;

function CentralAdminWorkspace({
  dashData,
  loading,
}: {
  dashData: SchoolDashboardData | null;
  loading: boolean;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [schools, setSchools] = useState<CentralSchool[]>(dashData?.schools || []);
  const [form, setForm] = useState<CreateCentralSchoolInput>({
    name: "",
    kind: "LYCEE",
    city: "",
    district: "",
    address: "",
    phone: "",
    email: "",
    directorName: "",
    directorPhone: "",
    directorEmail: "",
    activeAcademicYearName: dashData?.institution?.activeAcademicYearName,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setSchools(dashData?.schools || []);
  }, [dashData?.schools]);

  const setField = (field: keyof CreateCentralSchoolInput, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const createSchool = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const payload = Object.fromEntries(
      Object.entries(form).filter(([, value]) => String(value ?? "").trim().length > 0)
    ) as CreateCentralSchoolInput;
    const { data, error } = await schoolApi.createCentralSchool(payload);
    setSaving(false);
    if (error || !data?.school) {
      setMessage(error || "Impossible de créer l'école");
      return;
    }
    setSchools((prev) => [data.school, ...prev]);
    setMessage("École créée et rattachée au groupe.");
    setForm({
      name: "",
      kind: "LYCEE",
      city: "",
      district: "",
      address: "",
      phone: "",
      email: "",
      directorName: "",
      directorPhone: "",
      directorEmail: "",
      activeAcademicYearName: dashData?.institution?.activeAcademicYearName,
    });
    setShowCreate(false);
  };

  const stats = [
    { icon: Building2, label: "Écoles / campus", value: dashData?.totalSchools ?? "—", color: "bg-amber-500/15 text-amber-300" },
    { icon: GraduationCap, label: "Apprenants consolidés", value: dashData?.totalStudents ?? "—", color: "bg-emerald-500/15 text-emerald-400" },
    { icon: BookOpen, label: "Enseignants", value: dashData?.totalTeachers ?? "—", color: "bg-blue-500/15 text-blue-400" },
    { icon: LayoutGrid, label: "Classes", value: dashData?.totalClasses ?? "—", color: "bg-purple-500/15 text-purple-400" },
    { icon: DollarSign, label: "Revenus consolidés", value: dashData?.paidInvoices ? formatCurrency(dashData.paidInvoices) : "—", color: "bg-emerald-600/15 text-emerald-300" },
    { icon: AlertCircle, label: "Impayés", value: dashData?.pendingInvoices ?? "—", color: "bg-red-500/15 text-red-400" },
  ];
  const revenueData = dashData?.monthlyPayments?.length ? dashData.monthlyPayments : emptyRevenue();
  const inputCls = "w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-amber-400/50 transition-colors";

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold mb-3">
          <Building2 className="w-3.5 h-3.5" />
          Espace groupe Premium
        </div>
        <h1 className="text-2xl font-bold font-heading text-white">Tableau Administration Centrale</h1>
        <p className="text-gray-400 text-sm mt-1">Vue consolidée de toutes les écoles, campus et annexes du groupe.</p>
      </motion.div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {stats.map((s) => <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} color={s.color} />)}
        </motion.div>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={() => setShowCreate((value) => !value)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-soraDark text-sm font-bold transition-all hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4" />
          Créer une école
        </button>
        <button
          type="button"
          onClick={() => document.getElementById("schools")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 text-gray-300 text-sm font-medium transition-all"
        >
          <UserCog className="w-4 h-4" />
          Nommer directeur
        </button>
      </div>

      {showCreate && (
        <motion.form
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={createSchool}
          className="mb-6 bg-white/[0.03] border border-amber-500/15 rounded-2xl p-5"
        >
          <h2 className="text-sm font-semibold text-white mb-4">Nouvelle école / annexe / campus</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input required value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Nom de l'école" className={inputCls} />
            <select value={form.kind} onChange={(e) => setField("kind", e.target.value)} className={inputCls}>
              {KIND_OPTIONS.map(([value, label]) => <option key={value} value={value} className="bg-soraCard">{label}</option>)}
            </select>
            <input value={form.activeAcademicYearName || ""} onChange={(e) => setField("activeAcademicYearName", e.target.value)} placeholder="Année scolaire" className={inputCls} />
            <input value={form.city || ""} onChange={(e) => setField("city", e.target.value)} placeholder="Ville" className={inputCls} />
            <input value={form.district || ""} onChange={(e) => setField("district", e.target.value)} placeholder="Commune / quartier" className={inputCls} />
            <input value={form.address || ""} onChange={(e) => setField("address", e.target.value)} placeholder="Adresse" className={inputCls} />
            <input value={form.phone || ""} onChange={(e) => setField("phone", e.target.value)} placeholder="Téléphone école" className={inputCls} />
            <input value={form.email || ""} onChange={(e) => setField("email", e.target.value)} placeholder="Email école" className={inputCls} />
            <input value={form.directorName || ""} onChange={(e) => setField("directorName", e.target.value)} placeholder="Nom directeur" className={inputCls} />
            <input value={form.directorPhone || ""} onChange={(e) => setField("directorPhone", e.target.value)} placeholder="Téléphone directeur" className={inputCls} />
            <input value={form.directorEmail || ""} onChange={(e) => setField("directorEmail", e.target.value)} placeholder="Email directeur" className={inputCls} />
          </div>
          {message && <p className={cn("text-sm mt-3", message.includes("Impossible") ? "text-red-400" : "text-emerald-400")}>{message}</p>}
          <button disabled={saving} className="mt-4 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold">
            {saving ? "Création..." : "Créer et rattacher au groupe"}
          </button>
        </motion.form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div id="schools" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2 bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-white">Écoles du groupe</h2>
            <p className="text-xs text-gray-500 mt-1">Chaque directeur est limité à son établissement.</p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {schools.length === 0 ? (
              <div className="py-12 text-center text-gray-500">Aucune école créée pour ce groupe.</div>
            ) : schools.map((school) => (
              <div key={school.id} className="px-5 py-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <p className="text-white font-semibold">{school.name}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" />
                      {[school.district, school.city].filter(Boolean).join(" · ") || "Lieu non renseigné"}
                    </p>
                    <p className="text-xs text-amber-300 mt-1">
                      Directeur : {school.activeDirector ? `${school.activeDirector.firstName || ""} ${school.activeDirector.lastName || ""}`.trim() : school.directorName || "Non nommé"}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center min-w-[260px]">
                    <div><p className="text-white font-bold">{school.students ?? school._count?.students ?? 0}</p><p className="text-[10px] text-gray-500">Apprenants</p></div>
                    <div><p className="text-white font-bold">{school.teachers ?? school._count?.teachers ?? 0}</p><p className="text-[10px] text-gray-500">Profs</p></div>
                    <div><p className="text-white font-bold">{formatCurrency(school.revenue ?? 0)}</p><p className="text-[10px] text-gray-500">Revenus</p></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-amber-300" />
            <h2 className="text-sm font-semibold text-white">Revenus consolidés</h2>
          </div>
          <RevenueBar data={revenueData} />
          <div className="mt-4 space-y-2">
            {(dashData?.revenueBySchool || []).slice(0, 5).map((item) => (
              <div key={item.school} className="flex items-center justify-between text-xs">
                <span className="text-gray-400 truncate">{item.school}</span>
                <span className="text-white font-semibold">{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function SchoolDashboardPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [dashData, setDashData] = useState<SchoolDashboardData | null>(null);
  const [recentStudents, setRecentStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [dashRes, studRes] = await Promise.all([
        schoolApi.dashboard(),
        schoolApi.students(),
      ]);
      if (dashRes.data) setDashData(dashRes.data);
      if (studRes.data?.students) {
        setRecentStudents(studRes.data.students.slice(0, 5));
      }
      setLoading(false);
    };
    load();
  }, []);

  const stats = [
    {
      icon: GraduationCap,
      label: "Apprenants inscrits",
      value: dashData?.totalStudents ?? "—",
      color: "bg-emerald-500/15 text-emerald-400",
      href: `/${slug}/students`,
    },
    {
      icon: BookOpen,
      label: "Enseignants",
      value: dashData?.totalTeachers ?? "—",
      color: "bg-blue-500/15 text-blue-400",
      href: `/${slug}/teachers`,
    },
    {
      icon: LayoutGrid,
      label: "Classes",
      value: dashData?.totalClasses ?? "—",
      color: "bg-purple-500/15 text-purple-400",
      href: `/${slug}/classes`,
    },
    {
      icon: DollarSign,
      label: "Frais encaissés",
      value: dashData?.paidInvoices ? formatCurrency(dashData.paidInvoices) : "—",
      color: "bg-emerald-600/15 text-emerald-300",
      sub: "Factures réglées",
      href: `/${slug}/payments`,
    },
    {
      icon: AlertCircle,
      label: "Paiements en attente",
      value: dashData?.pendingInvoices ?? "—",
      color: "bg-amber-500/15 text-amber-400",
      href: `/${slug}/payments`,
    },
    {
      icon: Users,
      label: "Absences récentes",
      value: dashData?.recentAbsences ?? "—",
      color: "bg-red-500/15 text-red-400",
      sub: "7 derniers jours",
      href: `/${slug}/attendance`,
    },
  ];
  const revenueData = dashData?.monthlyPayments?.length ? dashData.monthlyPayments : emptyRevenue();
  const totalCollected = revenueData.reduce((sum, row) => sum + safeNumber(row.amount), 0);
  const learners = safeNumber(dashData?.totalStudents);
  const teachers = safeNumber(dashData?.totalTeachers);
  const classesCount = safeNumber(dashData?.totalClasses);
  const pendingInvoices = safeNumber(dashData?.pendingInvoices);
  const recentAbsences = safeNumber(dashData?.recentAbsences);
  const paidInvoices = safeNumber(dashData?.paidInvoices);
  const academicMix = [
    { name: "Apprenants", value: learners, color: "#10b981", href: `/${slug}/students` },
    { name: "Enseignants", value: teachers, color: "#0ea5e9", href: `/${slug}/teachers` },
    { name: "Classes", value: classesCount, color: "#8b5cf6", href: `/${slug}/classes` },
  ].filter((entry) => entry.value > 0);
  const riskData = [
    { name: "Factures à suivre", value: pendingInvoices, color: "#f59e0b", href: `/${slug}/payments` },
    { name: "Absences / retards", value: recentAbsences, color: "#ef4444", href: `/${slug}/attendance` },
    { name: "Messages support", value: safeNumber(dashData?.urgentMessages), color: "#6366f1", href: `/${slug}/messages` },
  ];
  const cockpitCards = [
    { title: "Admissions", desc: "Valider les dossiers et décisions de fin d’année", href: `/${slug}/inscriptions-validation`, icon: ClipboardCheck, tone: "from-emerald-500 to-teal-500" },
    { title: "Rapports", desc: "Exporter PDF, Excel, CSV et analyses direction", href: `/${slug}/rapports`, icon: FileText, tone: "from-blue-500 to-cyan-500" },
    { title: "Budget", desc: "Suivre demandes, validations et dépenses internes", href: `/${slug}/budget`, icon: WalletCards, tone: "from-amber-500 to-orange-500" },
    { title: "Pointage RH", desc: "Entrées, sorties, retards, absences et pénalités", href: `/${slug}/pointage-personnel`, icon: Clock, tone: "from-violet-500 to-indigo-500" },
    { title: "Personnel", desc: "Contrats, rôles, QR codes et permissions", href: `/${slug}/personnel`, icon: ShieldCheck, tone: "from-slate-700 to-slate-950" },
  ];

  if (dashData?.centralAdministration) {
    return <CentralAdminWorkspace dashData={dashData} loading={loading} />;
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="overflow-hidden rounded-[2rem] border border-emerald-900/10 bg-gradient-to-br from-white/90 via-emerald-50/70 to-sky-50/80 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.10)] dark:border-white/10 dark:from-slate-900/95 dark:via-slate-900/90 dark:to-emerald-950/55"
      >
        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr] lg:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5" />
              Cockpit Direction
            </div>
            <h1 className="max-w-3xl font-heading text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
              Pilotez l’école sans chercher les informations.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Finance, pédagogie, assiduité, inscriptions, personnel et rapports sont regroupés ici avec des accès directs.
              Chaque carte est cliquable pour ouvrir le module concerné.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href={`/${slug}/rapports`} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5">
                <BarChart3 className="h-4 w-4" /> Voir les rapports
              </Link>
              <Link href={`/${slug}/students`} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/75 px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:-translate-y-0.5 hover:border-emerald-300">
                <UserPlus className="h-4 w-4" /> Ajouter un apprenant
              </Link>
              <Link href={`/${slug}/payments`} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/75 px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:-translate-y-0.5 hover:border-emerald-300">
                <CreditCard className="h-4 w-4" /> Encaisser
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Link href={`/${slug}/payments`} className="rounded-3xl bg-slate-950 p-5 text-white shadow-xl shadow-slate-900/20 transition hover:-translate-y-1">
              <p className="text-xs font-semibold text-emerald-200">Encaissé</p>
              <p className="mt-2 text-2xl font-black">{formatCurrency(paidInvoices || totalCollected)}</p>
              <p className="mt-4 flex items-center gap-1 text-xs text-white/70">Finance <ArrowUpRight className="h-3 w-3" /></p>
            </Link>
            <Link href={`/${slug}/attendance`} className="rounded-3xl border border-red-100 bg-white/80 p-5 shadow-lg shadow-slate-900/5 transition hover:-translate-y-1">
              <p className="text-xs font-semibold text-red-600">Alertes 7 jours</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{recentAbsences}</p>
              <p className="mt-4 flex items-center gap-1 text-xs text-slate-500">Assiduité <ArrowUpRight className="h-3 w-3" /></p>
            </Link>
          </div>
        </div>
      </motion.div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {stats.map((s) => (
            <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} color={s.color} sub={s.sub} href={s.href} />
          ))}
        </motion.div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="sora-premium-card rounded-[1.75rem] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-heading text-lg font-bold text-slate-950">Revenus et encaissements</h2>
              <p className="text-xs text-slate-500">Tendance des paiements sur les 6 derniers mois.</p>
            </div>
            <Link href={`/${slug}/payments`} className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
              Finance <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="directorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.42} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,.08)" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} tickFormatter={(value) => shortNumber(Number(value))} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} contentStyle={{ borderRadius: 18, border: "1px solid rgba(15,23,42,.12)" }} />
                <Area type="monotone" dataKey="amount" stroke="#059669" strokeWidth={3} fill="url(#directorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-emerald-50 p-3"><p className="text-xs text-emerald-700">Total 6 mois</p><p className="font-bold text-slate-950">{formatCurrency(totalCollected)}</p></div>
            <div className="rounded-2xl bg-amber-50 p-3"><p className="text-xs text-amber-700">Factures ouvertes</p><p className="font-bold text-slate-950">{pendingInvoices}</p></div>
            <div className="rounded-2xl bg-sky-50 p-3"><p className="text-xs text-sky-700">Moy. mensuelle</p><p className="font-bold text-slate-950">{formatCurrency(Math.round(totalCollected / Math.max(revenueData.length, 1)))}</p></div>
          </div>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="sora-premium-card rounded-[1.75rem] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-heading text-lg font-bold text-slate-950">Structure école</h2>
                <p className="text-xs text-slate-500">Répartition des grands volumes.</p>
              </div>
              <Link href={`/${slug}/classes`} className="text-xs font-bold text-emerald-700">Ouvrir</Link>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={academicMix.length ? academicMix : [{ name: "Aucune donnée", value: 1, color: "#cbd5e1" }]} dataKey="value" innerRadius={58} outerRadius={88} paddingAngle={4}>
                    {(academicMix.length ? academicMix : [{ color: "#cbd5e1" }]).map((entry, index) => <Cell key={index} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(value) => shortNumber(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {academicMix.map((entry) => (
                <Link key={entry.name} href={entry.href} className="rounded-2xl border border-slate-200 bg-white/70 p-3 text-center transition hover:border-emerald-300">
                  <p className="text-lg font-black text-slate-950">{entry.value}</p>
                  <p className="text-[10px] text-slate-500">{entry.name}</p>
                </Link>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="sora-premium-card rounded-[1.75rem] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-heading text-lg font-bold text-slate-950">Points à surveiller</h2>
                <p className="text-xs text-slate-500">Cliquez pour traiter rapidement.</p>
              </div>
              <AlertCircle className="h-5 w-5 text-amber-500" />
            </div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,.08)" />
                  <XAxis dataKey="name" hide />
                  <YAxis hide />
                  <Tooltip />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                    {riskData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {riskData.map((entry) => (
                <Link key={entry.name} href={entry.href} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 text-sm transition hover:border-amber-300">
                  <span className="font-semibold text-slate-700">{entry.name}</span>
                  <span className="font-black text-slate-950">{entry.value}</span>
                </Link>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="sora-premium-card overflow-hidden rounded-[1.75rem]">
          <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-950">Apprenants récents</h2>
            </div>
            <Link href={`/${slug}/students`} className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">Voir tous <ArrowUpRight className="h-3 w-3" /></Link>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-2xl bg-slate-200/70" />)}
            </div>
          ) : recentStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <GraduationCap className="mb-2 h-10 w-10 opacity-30" />
              <p className="text-sm">Aucun apprenant enregistré</p>
              <Link href={`/${slug}/students`} className="mt-2 text-xs font-bold text-emerald-700">Ajouter le premier apprenant</Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-200/80">
              {recentStudents.map((studentRecord) => (
                <Link key={studentRecord.id} href={`/${slug}/students`} className="flex items-center gap-4 px-5 py-3 transition hover:bg-emerald-50/70">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold text-white">
                    {(studentRecord.firstName[0] + studentRecord.lastName[0]).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-950">{studentRecord.firstName} {studentRecord.lastName}</p>
                    <p className="truncate text-xs text-slate-500">{studentRecord.classroom?.name || "Classe non assignée"} · {studentRecord.matricule || "—"}</p>
                  </div>
                  <div className="hidden shrink-0 md:block">{studentStatusBadge(studentRecord.status)}</div>
                  <p className="hidden shrink-0 text-xs text-slate-400 md:block">{formatDate(studentRecord.createdAt)}</p>
                </Link>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="sora-premium-card rounded-[1.75rem] p-5">
          <div className="mb-4">
            <h2 className="font-heading text-lg font-bold text-slate-950">Modules Direction</h2>
            <p className="text-xs text-slate-500">Accès rapides aux décisions importantes.</p>
          </div>
          <div className="grid gap-3">
            {cockpitCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.title} href={card.href} className="group flex items-center gap-3 rounded-3xl border border-slate-200 bg-white/75 p-3 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg">
                  <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg", card.tone)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-950">{card.title}</p>
                    <p className="truncate text-xs text-slate-500">{card.desc}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-emerald-600" />
                </Link>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
