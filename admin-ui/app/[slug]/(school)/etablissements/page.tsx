"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Plus,
  Users,
  GraduationCap,
  BookOpen,
  DollarSign,
  UserCog,
  Phone,
  Mail,
  MapPin,
  X,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  BarChart3,
} from "lucide-react";
import { schoolApi, type CentralSchool, type CreateCentralSchoolInput, type AssignDirectorInput } from "@/lib/school-api";
import { cn, formatCurrency } from "@/lib/utils";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

function StatPill({ icon: Icon, value, label, color }: { icon: React.ElementType; value: string | number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center shrink-0", color)}>
        <Icon className="w-3 h-3" />
      </div>
      <div>
        <p className="text-xs font-bold text-white leading-none">{value}</p>
        <p className="text-[10px] text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function SchoolCard({ school, onAssignDirector }: { school: CentralSchool; onAssignDirector: (s: CentralSchool) => void }) {
  const count = school._count;
  const students = count?.students ?? school.students ?? 0;
  const teachers = count?.teachers ?? school.teachers ?? 0;
  const classes = count?.classrooms ?? school.classes ?? 0;
  const revenue = school.revenue ?? 0;

  return (
    <motion.div variants={item}>
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 hover:bg-white/[0.05] transition-colors group">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-none">{school.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5 font-mono">{school.slug}</p>
            </div>
          </div>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium uppercase tracking-wide">
            {school.kind ?? "École"}
          </span>
        </div>

        {/* Location */}
        {(school.city || school.district) && (
          <div className="flex items-center gap-1.5 mb-4 text-xs text-gray-400">
            <MapPin className="w-3 h-3 text-gray-600" />
            {[school.district, school.city].filter(Boolean).join(", ")}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <StatPill icon={GraduationCap} value={students} label="élèves" color="bg-blue-500/10 text-blue-400" />
          <StatPill icon={BookOpen} value={teachers} label="enseignants" color="bg-purple-500/10 text-purple-400" />
          <StatPill icon={BarChart3} value={classes} label="classes" color="bg-amber-500/10 text-amber-400" />
          <StatPill icon={DollarSign} value={formatCurrency(revenue)} label="encaissé" color="bg-emerald-500/10 text-emerald-400" />
        </div>

        {/* Director */}
        <div className="border-t border-white/[0.06] pt-3">
          {school.activeDirector ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-[10px] font-bold text-white">
                  {school.activeDirector.firstName?.[0]}{school.activeDirector.lastName?.[0]}
                </div>
                <div>
                  <p className="text-xs font-medium text-white">{school.activeDirector.firstName} {school.activeDirector.lastName}</p>
                  <p className="text-[10px] text-gray-500">Directeur</p>
                </div>
              </div>
              <button
                onClick={() => onAssignDirector(school)}
                className="text-[10px] text-gray-500 hover:text-emerald-400 transition-colors opacity-0 group-hover:opacity-100"
              >
                Changer
              </button>
            </div>
          ) : (
            <button
              onClick={() => onAssignDirector(school)}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/[0.04] text-xs text-amber-400 hover:bg-amber-500/10 transition-colors"
            >
              <UserCog className="w-3.5 h-3.5" />
              Nommer un directeur
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function CreateSchoolModal({ onClose, onCreated }: { onClose: () => void; onCreated: (s: CentralSchool) => void }) {
  const [form, setForm] = useState<CreateCentralSchoolInput>({ name: "", directorName: "", directorPhone: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof CreateCentralSchoolInput, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim()) { setError("Le nom de l'école est requis"); return; }
    setLoading(true);
    setError("");
    const { data, error: err } = await schoolApi.createCentralSchool(form);
    setLoading(false);
    if (err || !data) { setError(err ?? "Erreur de création"); return; }
    onCreated(data.school);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full max-w-md bg-[#111827] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
          <h2 className="text-base font-bold text-white">Nouvelle école</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/[0.06] flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400">Nom de l'école *</label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex: Lycée Excellence Abidjan"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400">Ville</label>
              <input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} placeholder="Abidjan" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400">Commune</label>
              <input value={form.district ?? ""} onChange={(e) => set("district", e.target.value)} placeholder="Cocody" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400">Téléphone</label>
            <input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="+225 07 00 00 00 00" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
          </div>

          <div className="border-t border-white/[0.06] pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Directeur (optionnel)</p>
            <div className="space-y-3">
              <input value={form.directorName ?? ""} onChange={(e) => set("directorName", e.target.value)} placeholder="Nom complet du directeur" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
              <div className="grid grid-cols-2 gap-3">
                <input value={form.directorPhone ?? ""} onChange={(e) => set("directorPhone", e.target.value)} placeholder="Téléphone" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
                <input value={form.directorEmail ?? ""} onChange={(e) => set("directorEmail", e.target.value)} placeholder="Email" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-sm text-gray-400 hover:bg-white/[0.04] transition-colors">
            Annuler
          </button>
          <button
            onClick={submit} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-semibold text-white transition-colors"
          >
            {loading ? "Création…" : "Créer l'école"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AssignDirectorModal({ school, onClose, onAssigned }: { school: CentralSchool; onClose: () => void; onAssigned: () => void }) {
  const [form, setForm] = useState<AssignDirectorInput>({ name: "", phone: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const set = (k: keyof AssignDirectorInput, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim() || !form.phone.trim()) { setError("Nom et téléphone requis"); return; }
    setLoading(true);
    setError("");
    const { error: err } = await schoolApi.assignSchoolDirector(school.id, form);
    setLoading(false);
    if (err) { setError(err); return; }
    setSuccess(true);
    setTimeout(onAssigned, 800);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full max-w-sm bg-[#111827] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
          <div>
            <h2 className="text-base font-bold text-white">Nommer un directeur</h2>
            <p className="text-xs text-gray-500 mt-0.5">{school.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/[0.06] flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center py-10 px-6 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-white">Directeur nommé avec succès</p>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400">Nom complet *</label>
                <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Jean Kouassi" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400">Téléphone *</label>
                <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+225 07 00 00 00 00" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400">Email</label>
                <input value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="directeur@ecole.ci" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400">Note interne</label>
                <input value={form.note ?? ""} onChange={(e) => set("note", e.target.value)} placeholder="Ex: Nomination approuvée en conseil" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50" />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-sm text-gray-400 hover:bg-white/[0.04] transition-colors">
                Annuler
              </button>
              <button
                onClick={submit} disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-semibold text-white transition-colors"
              >
                {loading ? "Nomination…" : "Nommer"}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function EtablissementsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [schools, setSchools] = useState<CentralSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<CentralSchool | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await schoolApi.centralSchools();
    setSchools(data?.schools ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const totalStudents = schools.reduce((s, sc) => s + (sc._count?.students ?? sc.students ?? 0), 0);
  const totalTeachers = schools.reduce((s, sc) => s + (sc._count?.teachers ?? sc.teachers ?? 0), 0);
  const totalRevenue  = schools.reduce((s, sc) => s + (sc.revenue ?? 0), 0);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-white font-heading">Mes établissements</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gérez vos écoles rattachées à votre administration centrale</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)]"
        >
          <Plus className="w-4 h-4" />
          Nouvelle école
        </motion.button>
      </motion.div>

      {/* Global stats */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Établissements actifs", value: schools.length, icon: Building2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Total apprenants", value: totalStudents, icon: GraduationCap, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Revenus cumulés", value: formatCurrency(totalRevenue), icon: DollarSign, color: "text-amber-400", bg: "bg-amber-500/10" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", stat.bg)}>
                <stat.icon className={cn("w-4 h-4", stat.color)} />
              </div>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
            <p className={cn("text-xl font-bold font-heading", stat.color)}>{stat.value}</p>
          </div>
        ))}
      </motion.div>

      {/* School cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-2xl bg-white/10" />
                <div className="flex-1">
                  <div className="h-3.5 bg-white/10 rounded w-32 mb-1.5" />
                  <div className="h-2.5 bg-white/10 rounded w-20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[1,2,3,4].map((j) => <div key={j} className="h-8 bg-white/10 rounded-xl" />)}
              </div>
              <div className="h-8 bg-white/10 rounded-xl" />
            </div>
          ))}
        </div>
      ) : schools.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
            <Building2 className="w-8 h-8 text-emerald-400/60" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">Aucun établissement</h3>
          <p className="text-sm text-gray-500 max-w-xs mb-5">
            Créez votre première école pour commencer à gérer vos établissements.
          </p>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all"
          >
            <Plus className="w-4 h-4" />
            Créer ma première école
          </button>
        </motion.div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {schools.map((school) => (
            <SchoolCard key={school.id} school={school} onAssignDirector={setAssignTarget} />
          ))}
        </motion.div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {createOpen && (
          <CreateSchoolModal
            onClose={() => setCreateOpen(false)}
            onCreated={(s) => {
              setSchools((prev) => [...prev, s]);
              setCreateOpen(false);
            }}
          />
        )}
        {assignTarget && (
          <AssignDirectorModal
            school={assignTarget}
            onClose={() => setAssignTarget(null)}
            onAssigned={() => { setAssignTarget(null); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
