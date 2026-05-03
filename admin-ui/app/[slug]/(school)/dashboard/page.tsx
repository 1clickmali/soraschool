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
} from "lucide-react";
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
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  sub?: string;
}) {
  return (
    <motion.div variants={item}>
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 hover:bg-white/[0.05] transition-colors">
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
      </div>
    </motion.div>
  );
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
    { icon: GraduationCap, label: "Élèves consolidés", value: dashData?.totalStudents ?? "—", color: "bg-emerald-500/15 text-emerald-400" },
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
          Espace groupe Enterprise
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
        <a
          href="#schools"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 text-gray-300 text-sm font-medium transition-all"
        >
          <UserCog className="w-4 h-4" />
          Nommer directeur
        </a>
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
                    <div><p className="text-white font-bold">{school.students ?? school._count?.students ?? 0}</p><p className="text-[10px] text-gray-500">Élèves</p></div>
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
      label: "Élèves inscrits",
      value: dashData?.totalStudents ?? "—",
      color: "bg-emerald-500/15 text-emerald-400",
    },
    {
      icon: BookOpen,
      label: "Enseignants",
      value: dashData?.totalTeachers ?? "—",
      color: "bg-blue-500/15 text-blue-400",
    },
    {
      icon: LayoutGrid,
      label: "Classes",
      value: dashData?.totalClasses ?? "—",
      color: "bg-purple-500/15 text-purple-400",
    },
    {
      icon: DollarSign,
      label: "Frais encaissés",
      value: dashData?.paidInvoices ? formatCurrency(dashData.paidInvoices) : "—",
      color: "bg-emerald-600/15 text-emerald-300",
      sub: "Factures réglées",
    },
    {
      icon: AlertCircle,
      label: "Paiements en attente",
      value: dashData?.pendingInvoices ?? "—",
      color: "bg-amber-500/15 text-amber-400",
    },
    {
      icon: Users,
      label: "Absences récentes",
      value: dashData?.recentAbsences ?? "—",
      color: "bg-red-500/15 text-red-400",
      sub: "7 derniers jours",
    },
  ];
  const revenueData = dashData?.monthlyPayments?.length ? dashData.monthlyPayments : emptyRevenue();

  if (dashData?.centralAdministration) {
    return <CentralAdminWorkspace dashData={dashData} loading={loading} />;
  }

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold font-heading text-white">Tableau de bord</h1>
        <p className="text-gray-400 text-sm mt-1">Vue d&apos;ensemble de votre établissement</p>
      </motion.div>

      {/* Stats grid */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6"
        >
          {stats.map((s) => (
            <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} color={s.color} sub={s.sub} />
          ))}
        </motion.div>
      )}

      {/* Quick actions */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="mb-6"
      >
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Actions rapides</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/${slug}/students`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/25 text-emerald-400 text-sm font-medium transition-all hover:scale-[1.02]"
          >
            <UserPlus className="w-4 h-4" />
            Ajouter un élève
          </Link>
          <Link
            href={`/${slug}/payments`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 text-gray-300 text-sm font-medium transition-all hover:scale-[1.02]"
          >
            <CreditCard className="w-4 h-4" />
            Enregistrer paiement
          </Link>
          <Link
            href={`/${slug}/attendance`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 text-gray-300 text-sm font-medium transition-all hover:scale-[1.02]"
          >
            <ClipboardCheck className="w-4 h-4" />
            Faire l&apos;appel
          </Link>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent students */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="lg:col-span-2 bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-emerald-500" />
              <h2 className="text-sm font-semibold text-white">Élèves récents</h2>
            </div>
            <Link href={`/${slug}/students`} className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors">
              Voir tous
            </Link>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="h-3 bg-white/10 rounded w-32 mb-1.5" />
                    <div className="h-2 bg-white/[0.07] rounded w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <GraduationCap className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">Aucun élève enregistré</p>
              <Link href={`/${slug}/students`} className="text-xs text-emerald-500 hover:text-emerald-400 mt-2">
                Ajouter le premier élève
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {recentStudents.map((s) => (
                <div key={s.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    {(s.firstName[0] + s.lastName[0]).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {s.firstName} {s.lastName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {s.classroom?.name || "Classe non assignée"} · {s.matricule || "—"}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {studentStatusBadge(s.status)}
                  </div>
                  <p className="text-xs text-gray-600 flex-shrink-0 hidden md:block">
                    {formatDate(s.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Revenue chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <h2 className="text-sm font-semibold text-white">Paiements (6 mois)</h2>
          </div>
          <RevenueBar data={revenueData} />
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <p className="text-xs text-gray-500">Total encaissé</p>
            <p className="text-lg font-bold text-white font-heading">
              {formatCurrency(revenueData.reduce((s, d) => s + d.amount, 0))}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
