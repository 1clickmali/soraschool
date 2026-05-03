"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Shield, Plus, Search, AlertTriangle } from "lucide-react";
import { schoolApi, schoolApiRequest, type DisciplineRecord, type Student } from "@/lib/school-api";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const row = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3 } },
};

interface Assignment {
  classroom?: { id: string; name: string };
}

const KIND_OPTIONS = [
  { value: "OBSERVATION", label: "Observation", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { value: "AVERTISSEMENT", label: "Avertissement", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { value: "EXCLUSION_TEMPORAIRE", label: "Exclusion temporaire", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  { value: "EXCLUSION_DEFINITIVE", label: "Exclusion définitive", color: "bg-red-500/10 text-red-400 border-red-500/20" },
  // Legacy types from API
  { value: "WARNING", label: "Avertissement", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { value: "SUSPENSION", label: "Suspension", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  { value: "EXPULSION", label: "Expulsion", color: "bg-red-500/10 text-red-400 border-red-500/20" },
  { value: "OBSERVATION_LEGACY", label: "Observation", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { value: "DETENTION", label: "Retenue", color: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
];

function kindBadge(kind: string) {
  const opt = KIND_OPTIONS.find((k) => k.value === kind || k.label.toLowerCase() === kind.toLowerCase());
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", opt?.color || "bg-gray-500/10 text-gray-400 border-gray-500/20")}>
      {opt?.label || kind}
    </span>
  );
}

function formatDate(d: string) {
  return new Intl.DateTimeFormat("fr-CI", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));
}

export default function DisciplinePage() {
  const [records, setRecords] = useState<DisciplineRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [form, setForm] = useState({
    studentId: "",
    kind: "OBSERVATION",
    description: "",
    sanctions: "",
  });

  useEffect(() => {
    const load = async () => {
      // Get teacher's classrooms
      const assignRes = await schoolApiRequest<{ assignments?: Assignment[] } | Assignment[]>("/api/academics/assignments");
      let assignments: Assignment[] = [];
      if (Array.isArray(assignRes.data)) assignments = assignRes.data;
      else if (assignRes.data && "assignments" in assignRes.data) assignments = assignRes.data.assignments || [];

      const classMap: Record<string, { id: string; name: string }> = {};
      for (const a of assignments) {
        if (a.classroom) classMap[a.classroom.id] = a.classroom;
      }

      // Fetch discipline records and students in parallel
      const [discRes, ...studentResults] = await Promise.all([
        schoolApi.discipline(),
        ...Object.keys(classMap).map((cid) =>
          schoolApiRequest<{ students?: Student[] } | Student[]>(`/api/students?classroomId=${cid}`)
        ),
      ]);

      if (discRes.data?.records) setRecords(discRes.data.records);

      const allStudents: Student[] = [];
      for (const res of studentResults) {
        let studs: Student[] = [];
        if (Array.isArray(res.data)) studs = res.data;
        else if (res.data && "students" in res.data) studs = (res.data as { students?: Student[] }).students || [];
        for (const s of studs) {
          if (!allStudents.find((x) => x.id === s.id)) allStudents.push(s);
        }
      }
      setStudents(allStudents);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter(
      (r) =>
        r.student?.firstName?.toLowerCase().includes(q) ||
        r.student?.lastName?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
    );
  }, [records, search]);

  const handleSave = async () => {
    if (!form.studentId || !form.description) return;
    setSaving(true);
    setSaveError(null);
    const { data, error } = await schoolApi.createDiscipline({
      studentId: form.studentId,
      type: form.kind,
      kind: form.kind,
      description: form.description,
      sanctions: form.sanctions || undefined,
    });
    setSaving(false);
    if (error) {
      setSaveError(error);
    } else if (data?.record) {
      setRecords((prev) => [data.record, ...prev]);
      setForm({ studentId: "", kind: "OBSERVATION", description: "", sanctions: "" });
      setModalOpen(false);
    }
  };

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-start justify-between mb-6"
      >
        <div>
          <h1 className="text-2xl font-bold font-heading text-white">Discipline</h1>
          <p className="text-gray-400 text-sm mt-1">Signalements disciplinaires de vos élèves</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)]"
        >
          <Plus className="w-4 h-4" />
          Nouveau signalement
        </button>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative max-w-xs mb-6"
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500/50 transition-all"
        />
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden"
      >
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-white/[0.04] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <Shield className="w-12 h-12 mb-2 opacity-20" />
            <p className="text-sm font-medium text-gray-400">
              {search ? "Aucun résultat" : "Aucun signalement enregistré"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Élève</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Type</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide hidden md:table-cell">Description</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide hidden lg:table-cell">Date</th>
                </tr>
              </thead>
              <motion.tbody
                variants={container}
                initial="hidden"
                animate="show"
                className="divide-y divide-white/[0.04]"
              >
                {filtered.map((r) => (
                  <motion.tr key={r.id} variants={row} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center text-xs font-bold text-red-400 flex-shrink-0">
                          {r.student
                            ? (r.student.firstName[0] + r.student.lastName[0]).toUpperCase()
                            : "?"}
                        </div>
                        <span className="font-medium text-white">
                          {r.student ? `${r.student.firstName} ${r.student.lastName}` : "Élève inconnu"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">{kindBadge(r.kind || r.type)}</td>
                    <td className="px-5 py-3 text-gray-400 hidden md:table-cell">
                      <span className="line-clamp-1">{r.description}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs hidden lg:table-cell">
                      {formatDate(r.date || r.createdAt)}
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Create discipline modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nouveau signalement" size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 font-medium mb-1.5 uppercase tracking-wide">Élève</label>
            <select
              value={form.studentId}
              onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-violet-500/50 transition-all appearance-none"
            >
              <option value="" className="bg-soraDark">Sélectionner un élève…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id} className="bg-soraDark">
                  {s.firstName} {s.lastName} {s.classroom?.name ? `— ${s.classroom.name}` : ""}
                </option>
              ))}
            </select>
            {students.length === 0 && (
              <p className="text-xs text-gray-600 mt-1">Aucun élève trouvé (vérifiez vos affectations)</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-500 font-medium mb-1.5 uppercase tracking-wide">Type de signalement</label>
            <div className="grid grid-cols-2 gap-2">
              {KIND_OPTIONS.slice(0, 4).map((k) => (
                <button
                  key={k.value}
                  onClick={() => setForm((f) => ({ ...f, kind: k.value }))}
                  className={cn(
                    "px-3 py-2.5 rounded-xl text-xs font-medium border transition-all text-left",
                    form.kind === k.value ? k.color : "bg-white/[0.04] text-gray-400 border-white/10 hover:bg-white/[0.07]"
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 font-medium mb-1.5 uppercase tracking-wide">Description</label>
            <textarea
              rows={3}
              placeholder="Décrivez le comportement ou l&apos;incident…"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-violet-500/50 transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 font-medium mb-1.5 uppercase tracking-wide">Sanctions proposées</label>
            <input
              type="text"
              placeholder="Ex: Convocation des parents, retenue…"
              value={form.sanctions}
              onChange={(e) => setForm((f) => ({ ...f, sanctions: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-violet-500/50 transition-all"
            />
          </div>

          {saveError && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {saveError}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.09] text-gray-300 text-sm font-medium transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.studentId || !form.description}
              className="flex-1 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold transition-all"
            >
              {saving ? "Enregistrement…" : "Créer le signalement"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
