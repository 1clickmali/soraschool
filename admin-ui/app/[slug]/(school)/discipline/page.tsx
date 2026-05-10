"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Plus,
  X,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  AlertTriangle,
  Search,
} from "lucide-react";
import { schoolApi, type DisciplineRecord, type Student, type Classroom, type CreateDisciplineInput } from "@/lib/school-api";
import { SecureImage } from "@/components/ui/secure-image";
import { cn, formatDate } from "@/lib/utils";

const DISCIPLINE_TYPES: Record<string, { label: string; color: string }> = {
  SANCTION: { label: "Sanction", color: "bg-orange-500/15 text-orange-400 border-orange-500/25" },
  GOOD_POINT: { label: "Bon comportement", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
  BAD_POINT: { label: "Mauvais comportement", color: "bg-red-500/15 text-red-400 border-red-500/25" },
  WARNING: { label: "Avertissement", color: "bg-amber-500/15 text-amber-400 border-amber-500/25" },
  PARENT_SUMMONS: { label: "Convocation parent", color: "bg-purple-500/15 text-purple-400 border-purple-500/25" },
  SUSPENSION: { label: "Suspension", color: "bg-orange-500/15 text-orange-400 border-orange-500/25" },
  EXPULSION: { label: "Expulsion", color: "bg-red-500/15 text-red-400 border-red-500/25" },
  OBSERVATION: { label: "Observation", color: "bg-blue-500/15 text-blue-400 border-blue-500/25" },
  DETENTION: { label: "Retenue", color: "bg-purple-500/15 text-purple-400 border-purple-500/25" },
};

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-md bg-soraCard border border-white/10 rounded-2xl shadow-2xl my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
                <h2 className="text-base font-semibold font-heading text-white">{title}</h2>
                <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

const inputCls = cn(
  "w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white",
  "placeholder:text-gray-600 focus:border-emerald-500/50 focus:bg-emerald-500/[0.03] transition-all duration-200"
);
const selectCls = cn(inputCls, "[&>option]:bg-soraCard");

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function DisciplinePage() {
  const [records, setRecords] = useState<DisciplineRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [form, setForm] = useState<CreateDisciplineInput>({
    studentId: "",
    type: "WARNING",
    kind: "WARNING",
    description: "",
    sanctions: "",
    date: new Date().toISOString().split("T")[0],
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [discRes, studsRes] = await Promise.all([
      schoolApi.discipline(search, classFilter || undefined, kindFilter || undefined),
      schoolApi.students("", classFilter || undefined),
    ]);
    if (discRes.data?.records) setRecords(discRes.data.records);
    if (studsRes.data?.students) setStudents(studsRes.data.students);
    setLoading(false);
  }, [search, classFilter, kindFilter]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    schoolApi.classes().then(({ data }) => {
      if (data?.classes) setClasses(data.classes);
    });
  }, []);

  const resetForm = () => {
    setForm({
      studentId: "",
      type: "WARNING",
      kind: "WARNING",
      description: "",
      sanctions: "",
      date: new Date().toISOString().split("T")[0],
    });
    setFormError(null);
    setFormSuccess(null);
  };

  const handleAdd = async () => {
    if (!form.studentId) { setFormError("Sélectionnez un élève"); return; }
    if (!form.description.trim()) { setFormError("La description est requise"); return; }
    setFormError(null);
    setSaving(true);
    const { error } = await schoolApi.createDiscipline(form);
    setSaving(false);
    if (error) { setFormError(error); return; }
    setFormSuccess("Signalement créé !");
    setTimeout(() => { setModalOpen(false); resetForm(); loadData(); }, 900);
  };

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading text-white">Vie scolaire</h1>
          <p className="text-gray-400 text-sm mt-1">Registre des incidents et sanctions</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => { resetForm(); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)]"
        >
          <Plus className="w-4 h-4" />
          Nouveau signalement
        </motion.button>
      </motion.div>

      {/* Summary */}
      {!loading && records.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-wrap gap-3 mb-5">
          {Object.entries(DISCIPLINE_TYPES).map(([type, cfg]) => {
            const count = records.filter((r) => (r.kind || r.type) === type).length;
            if (count === 0) return null;
            return (
              <div key={type} className={cn("flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border", cfg.color)}>
                <span className="font-bold">{count}</span>
                <span>{cfg.label}</span>
              </div>
            );
          })}
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="flex flex-col lg:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher élève, matricule, description..."
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-emerald-500/50 transition-all"
          />
        </div>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white [&>option]:bg-soraCard focus:border-emerald-500/50 transition-all min-w-[180px]">
          <option value="">Toutes les classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} className="bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white [&>option]:bg-soraCard focus:border-emerald-500/50 transition-all min-w-[190px]">
          <option value="">Tous les types</option>
          {Object.entries(DISCIPLINE_TYPES).map(([val, cfg]) => <option key={val} value={val}>{cfg.label}</option>)}
        </select>
      </motion.div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-4 animate-pulse">
                <div className="w-9 h-9 rounded-full bg-white/10 flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-3 bg-white/10 rounded w-32 mb-2" />
                  <div className="h-2 bg-white/[0.07] rounded w-48 mb-1.5" />
                  <div className="h-2 bg-white/[0.07] rounded w-24" />
                </div>
                <div className="h-5 bg-white/10 rounded-full w-20" />
              </div>
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <Shield className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">Aucun signalement enregistré</p>
            <p className="text-xs mt-1">Bonne nouvelle, ou filtre trop précis.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3.5 border-b border-white/[0.06]">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Détails</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:block">Date</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:block">Sanction</span>
            </div>
            {records.map((rec, idx) => {
              const recType = rec.kind || rec.type;
              const typeConfig = DISCIPLINE_TYPES[recType] || { label: recType, color: "bg-gray-500/15 text-gray-400 border-gray-500/25" };
              const studentName = rec.student
                ? `${rec.student.firstName} ${rec.student.lastName}`
                : "Élève inconnu";
              return (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-start px-5 py-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <SecureImage
                        src={rec.student?.photoUrl || rec.student?.photo}
                        alt={studentName}
                        className="w-7 h-7 rounded-full object-cover ring-2 ring-red-500/20 flex-shrink-0"
                        fallback={(
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                            {studentName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      />
                      <p className="text-sm font-medium text-white">{studentName}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">{rec.description}</p>
                  </div>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium whitespace-nowrap self-start mt-1", typeConfig.color)}>
                    {typeConfig.label}
                  </span>
                  <span className="text-xs text-gray-500 whitespace-nowrap self-start mt-1 hidden md:block">
                    {formatDate(rec.date || rec.createdAt)}
                  </span>
                  <span className="text-xs text-gray-400 self-start mt-1 hidden lg:block max-w-[140px] truncate" title={rec.sanctions || "—"}>
                    {rec.sanctions || "—"}
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* New discipline modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouveau signalement">
        <div className="space-y-4">
          <FormField label="Élève" required>
            <select className={selectCls} value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
              <option value="">Sélectionner un élève</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Type d'incident" required>
              <select className={selectCls} value={form.kind || form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CreateDisciplineInput["type"], kind: e.target.value })}>
                {Object.entries(DISCIPLINE_TYPES).map(([val, cfg]) => (
                  <option key={val} value={val}>{cfg.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Date">
              <input type="date" className={inputCls} value={form.date || ""} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </FormField>
          </div>

          <FormField label="Description" required>
            <textarea
              className={cn(inputCls, "resize-none h-24")}
              placeholder="Décrivez l'incident..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </FormField>

          <FormField label="Sanctions prises">
            <input
              className={inputCls}
              placeholder="Ex: Convocation des parents, 3 jours de suspension..."
              value={form.sanctions || ""}
              onChange={(e) => setForm({ ...form, sanctions: e.target.value })}
            />
          </FormField>

          {/* Severity indicator */}
          {(form.kind || form.type) && (
            <div className={cn("flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs", DISCIPLINE_TYPES[form.kind || form.type]?.color)}>
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              Niveau : {DISCIPLINE_TYPES[form.kind || form.type]?.label}
            </div>
          )}

          <AnimatePresence>
            {formError && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{formError}
              </motion.div>
            )}
            {formSuccess && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />{formSuccess}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm hover:bg-white/[0.04] hover:text-white transition-all">Annuler</button>
            <button onClick={handleAdd} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all disabled:opacity-60">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Enregistrer"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
