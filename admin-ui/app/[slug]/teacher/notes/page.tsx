"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Star, Users, TrendingUp, ChevronRight, Loader2 } from "lucide-react";
import { schoolApi, schoolApiRequest, type Student } from "@/lib/school-api";
import { cn } from "@/lib/utils";

interface Assignment {
  classroom?: { id: string; name: string };
  subject?: { id: string; name: string };
}

interface Period {
  id: string;
  name: string;
}

interface GradeRow {
  studentId: string;
  firstName: string;
  lastName: string;
  value: string; // string for input handling
  appreciation: string;
  comment: string;
  saved: boolean;
}

const APPRECIATIONS = [
  { value: "", label: "— Appréciation —" },
  { value: "Excellent", label: "Excellent" },
  { value: "Très bien", label: "Très bien" },
  { value: "Bien", label: "Bien" },
  { value: "Assez bien", label: "Assez bien" },
  { value: "Passable", label: "Passable" },
  { value: "Insuffisant", label: "Insuffisant" },
];

function gradeColor(val: number | null) {
  if (val === null) return "text-gray-400";
  if (val >= 16) return "text-emerald-400";
  if (val >= 12) return "text-blue-400";
  if (val >= 10) return "text-amber-400";
  return "text-red-400";
}

export default function NotesPage() {
  const searchParams = useSearchParams();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);

  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState(searchParams.get("classroomId") || "");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");

  const [rows, setRows] = useState<GradeRow[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveTotal, setSaveTotal] = useState(0);
  const [saved, setSaved] = useState(false);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      schoolApiRequest<{ assignments?: Assignment[] } | Assignment[]>("/api/academics/assignments"),
      schoolApiRequest<{ periods?: Period[] } | Period[]>("/api/grades/periods"),
    ]).then(([assignRes, periodsRes]) => {
      let assigns: Assignment[] = [];
      if (Array.isArray(assignRes.data)) assigns = assignRes.data;
      else if (assignRes.data && "assignments" in assignRes.data) assigns = assignRes.data.assignments || [];
      setAssignments(assigns);

      let perList: Period[] = [];
      if (Array.isArray(periodsRes.data)) perList = periodsRes.data;
      else if (periodsRes.data && "periods" in periodsRes.data) perList = periodsRes.data.periods || [];
      setPeriods(perList);
      if (perList.length > 0) setSelectedPeriodId(perList[0].id);
    });
  }, []);

  // Subjects for selected class
  const availableSubjects = useMemo(() => {
    const map: Record<string, { id: string; name: string }> = {};
    for (const a of assignments) {
      if (a.subject && (!selectedClassId || a.classroom?.id === selectedClassId)) {
        map[a.subject.id] = a.subject;
      }
    }
    return Object.values(map);
  }, [assignments, selectedClassId]);

  // Classes for selected subject
  const availableClasses = useMemo(() => {
    const map: Record<string, { id: string; name: string }> = {};
    for (const a of assignments) {
      if (a.classroom && (!selectedSubjectId || a.subject?.id === selectedSubjectId)) {
        map[a.classroom.id] = a.classroom;
      }
    }
    return Object.values(map);
  }, [assignments, selectedSubjectId]);

  const loadStudents = useCallback(async () => {
    if (!selectedClassId) return;
    setLoadingStudents(true);
    setRows([]);
    setSaved(false);
    const res = await schoolApiRequest<{ students?: Student[] } | Student[]>(
      `/api/students?classroomId=${selectedClassId}`
    );
    let students: Student[] = [];
    if (Array.isArray(res.data)) students = res.data;
    else if (res.data && "students" in res.data) students = res.data.students || [];

    setRows(
      students.map((s) => ({
        studentId: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        value: "",
        appreciation: "",
        comment: "",
        saved: false,
      }))
    );
    setLoadingStudents(false);
  }, [selectedClassId]);

  const avg = useMemo(() => {
    const withGrades = rows.filter((r) => r.value !== "" && !isNaN(parseFloat(r.value)));
    if (!withGrades.length) return null;
    return withGrades.reduce((sum, r) => sum + parseFloat(r.value), 0) / withGrades.length;
  }, [rows]);

  const handleSaveAll = async () => {
    const toSave = rows.filter((r) => r.value !== "" && !isNaN(parseFloat(r.value)));
    if (!toSave.length || !selectedSubjectId || !selectedClassId) return;

    setSaving(true);
    setSaveProgress(0);
    setSaveTotal(toSave.length);
    setSaveErrors([]);

    const errors: string[] = [];
    for (let i = 0; i < toSave.length; i++) {
      const r = toSave[i];
      const { error } = await schoolApi.createGrade({
        studentId: r.studentId,
        subjectId: selectedSubjectId,
        periodId: selectedPeriodId || undefined,
        value: parseFloat(r.value),
        appreciation: r.appreciation || undefined,
        comment: r.comment || undefined,
      });
      if (error) errors.push(`${r.firstName} ${r.lastName}: ${error}`);
      setSaveProgress(i + 1);
    }

    setSaving(false);
    setSaveErrors(errors);
    if (!errors.length) setSaved(true);
  };

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold font-heading text-white">Évaluations</h1>
        <p className="text-gray-400 text-sm mt-1">Saisissez les notes de vos élèves</p>
      </motion.div>

      {/* Selectors */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6"
      >
        <div>
          <label className="block text-xs text-gray-500 font-medium mb-1.5 uppercase tracking-wide">Matière</label>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-violet-500/50 transition-all appearance-none"
          >
            <option value="" className="bg-soraDark">Sélectionner…</option>
            {availableSubjects.map((s) => (
              <option key={s.id} value={s.id} className="bg-soraDark">{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 font-medium mb-1.5 uppercase tracking-wide">Classe</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-violet-500/50 transition-all appearance-none"
          >
            <option value="" className="bg-soraDark">Sélectionner…</option>
            {availableClasses.map((c) => (
              <option key={c.id} value={c.id} className="bg-soraDark">{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 font-medium mb-1.5 uppercase tracking-wide">Période</label>
          <select
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-violet-500/50 transition-all appearance-none"
          >
            <option value="" className="bg-soraDark">Sélectionner…</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id} className="bg-soraDark">{p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={loadStudents}
            disabled={!selectedClassId || loadingStudents}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold transition-all"
          >
            {loadingStudents ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            Charger les élèves
          </button>
        </div>
      </motion.div>

      {/* Class average */}
      {rows.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex items-center gap-4 mb-5"
        >
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <TrendingUp className="w-4 h-4 text-violet-400" />
            <span className="text-xs text-gray-400">Moyenne de classe :</span>
            <span className={cn("text-lg font-bold font-heading", gradeColor(avg))}>
              {avg !== null ? avg.toFixed(2) : "—"}/20
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">{rows.filter((r) => r.value !== "").length}/{rows.length} saisies</span>
          </div>
        </motion.div>
      )}

      {/* Grades table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden mb-6"
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b border-white/[0.06]">
          <Star className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-white">Grille de notes</h2>
          {rows.length > 0 && <span className="text-xs text-gray-500 ml-auto">{rows.length} élèves</span>}
        </div>

        {!selectedClassId ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <Star className="w-12 h-12 mb-2 opacity-20" />
            <p className="text-sm">Sélectionnez une classe et cliquez sur &quot;Charger les élèves&quot;</p>
          </div>
        ) : loadingStudents ? (
          <div className="p-5 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-white/[0.04] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <Users className="w-12 h-12 mb-2 opacity-20" />
            <p className="text-sm">Aucun élève dans cette classe</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Élève</th>
                  <th className="text-center px-3 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide">Note /20</th>
                  <th className="text-left px-3 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide hidden md:table-cell">Appréciation</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-500 font-medium uppercase tracking-wide hidden lg:table-cell">Commentaire</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {rows.map((row) => {
                  const numVal = row.value !== "" ? parseFloat(row.value) : null;
                  return (
                    <tr key={row.studentId} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                            {(row.firstName[0] + row.lastName[0]).toUpperCase()}
                          </div>
                          <span className="font-medium text-white">{row.firstName} {row.lastName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <input
                            type="number"
                            min={0}
                            max={20}
                            step={0.5}
                            value={row.value}
                            onChange={(e) => setRows((prev) => prev.map((r) => r.studentId === row.studentId ? { ...r, value: e.target.value } : r))}
                            placeholder="—"
                            className={cn(
                              "w-16 text-center px-2 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-sm font-bold focus:outline-none focus:border-violet-500/50 transition-all",
                              numVal !== null ? gradeColor(numVal) : "text-gray-400"
                            )}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        <select
                          value={row.appreciation}
                          onChange={(e) => setRows((prev) => prev.map((r) => r.studentId === row.studentId ? { ...r, appreciation: e.target.value } : r))}
                          className="w-full px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07] text-xs text-gray-300 focus:outline-none focus:border-violet-500/40 transition-all appearance-none"
                        >
                          {APPRECIATIONS.map((a) => (
                            <option key={a.value} value={a.value} className="bg-soraDark">{a.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-3 hidden lg:table-cell">
                        <input
                          type="text"
                          placeholder="Commentaire…"
                          value={row.comment}
                          onChange={(e) => setRows((prev) => prev.map((r) => r.studentId === row.studentId ? { ...r, comment: e.target.value } : r))}
                          className="w-full px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07] text-xs text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-violet-500/40 transition-all"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Save */}
      {rows.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex items-center gap-4 flex-wrap"
        >
          <button
            onClick={handleSaveAll}
            disabled={saving || !selectedSubjectId || rows.filter((r) => r.value !== "").length === 0}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)]"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {saveProgress}/{saveTotal} notes…
              </>
            ) : (
              <>
                <Star className="w-4 h-4" />
                Enregistrer toutes les notes ({rows.filter((r) => r.value !== "").length})
              </>
            )}
          </button>

          {!selectedSubjectId && rows.length > 0 && (
            <span className="text-xs text-amber-400">Sélectionnez une matière avant d&apos;enregistrer</span>
          )}
          {saved && <span className="text-sm text-emerald-400 font-medium">✓ Toutes les notes enregistrées</span>}
          {saveErrors.length > 0 && (
            <div className="text-xs text-red-400 space-y-1">
              {saveErrors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
