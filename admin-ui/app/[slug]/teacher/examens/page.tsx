"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Download, FileText, Loader2, RefreshCw, Star } from "lucide-react";
import {
  downloadProtectedFile,
  schoolApi,
  type Assignment,
  type Grade,
  type GradePeriod,
} from "@/lib/school-api";
import { cn } from "@/lib/utils";

const fieldClass = "w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white outline-none transition focus:border-violet-500/50 [&>option]:bg-soraDark";

function gradeValue(grade: Grade) {
  const score = grade.score ?? grade.value ?? 0;
  const max = grade.maxScore ?? 20;
  return max ? (score / max) * 20 : score;
}

function periodName(grade: Grade) {
  if (typeof grade.period === "string") return grade.period;
  return grade.period?.name || "Période";
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export default function TeacherExamsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [periods, setPeriods] = useState<GradePeriod[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([schoolApi.assignments(), schoolApi.gradePeriods()]).then(([assignmentRes, periodRes]) => {
      const nextAssignments = assignmentRes.data?.assignments || [];
      const nextPeriods = periodRes.data?.periods || [];
      setAssignments(nextAssignments);
      setPeriods(nextPeriods);
      setSelectedClassId(nextAssignments[0]?.classroom?.id || "");
      setSelectedSubjectId(nextAssignments[0]?.subject?.id || "");
      setSelectedPeriodId(nextPeriods[0]?.id || "");
    });
  }, []);

  const classes = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    assignments.forEach((assignment) => assignment.classroom && map.set(assignment.classroom.id, assignment.classroom));
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [assignments]);

  const subjects = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    assignments.forEach((assignment) => {
      if (!selectedClassId || assignment.classroom?.id === selectedClassId) {
        if (assignment.subject) map.set(assignment.subject.id, assignment.subject);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [assignments, selectedClassId]);

  const loadGrades = async () => {
    setLoading(true);
    setMessage(null);
    const { data, error } = await schoolApi.grades({
      classroomId: selectedClassId || undefined,
      subjectId: selectedSubjectId || undefined,
      periodId: selectedPeriodId || undefined,
    });
    if (error) setMessage(error);
    setGrades(data?.grades || []);
    setLoading(false);
  };

  useEffect(() => {
    if (selectedClassId || selectedSubjectId || selectedPeriodId) void loadGrades();
  }, [selectedClassId, selectedSubjectId, selectedPeriodId]);

  const average = grades.length ? grades.reduce((sum, grade) => sum + gradeValue(grade), 0) / grades.length : null;

  const exportCsv = () => {
    const lines = [
      ["Nom", "Prénom", "Matricule", "Classe", "Matière", "Période", "Note /20", "Appréciation"].map(csvCell).join(","),
      ...grades.map((grade) => [
        grade.student?.lastName,
        grade.student?.firstName,
        grade.student?.matricule,
        grade.student?.classroom?.name,
        grade.subject?.name,
        periodName(grade),
        gradeValue(grade).toFixed(2),
        grade.appreciation || grade.comment,
      ].map(csvCell).join(",")),
    ];
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "examens-notes.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const openReportCard = async (grade: Grade) => {
    const studentId = grade.student?.id || grade.studentId;
    const periodId = typeof grade.period === "object" ? grade.period?.id : grade.periodId;
    if (!studentId || !periodId) {
      setMessage("Impossible d’ouvrir le bulletin : élève ou période manquant.");
      return;
    }
    const error = await downloadProtectedFile(`/api/grades/report-cards/${studentId}/${periodId}/pdf`, `bulletin-${studentId}-${periodId}.pdf`, "open");
    if (error) setMessage(error);
  };

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white">Examens & bulletins</h1>
          <p className="mt-1 text-sm text-gray-400">Consultez les examens déjà corrigés, exportez les notes et ouvrez les bulletins.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadGrades} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.09]">
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </button>
          <button onClick={exportCsv} disabled={!grades.length} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50">
            <Download className="h-4 w-4" />
            Export notes
          </button>
        </div>
      </motion.div>

      {message && <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">{message}</div>}

      <div className="mb-6 grid gap-3 lg:grid-cols-4">
        <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className={fieldClass}>
          <option value="">Toutes mes classes</option>
          {classes.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.name}</option>)}
        </select>
        <select value={selectedSubjectId} onChange={(e) => setSelectedSubjectId(e.target.value)} className={fieldClass}>
          <option value="">Toutes mes matières</option>
          {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
        </select>
        <select value={selectedPeriodId} onChange={(e) => setSelectedPeriodId(e.target.value)} className={fieldClass}>
          <option value="">Toutes les périodes</option>
          {periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}
        </select>
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 px-4 py-2.5">
          <p className="text-xs text-violet-200/70">Moyenne visible</p>
          <p className="font-heading text-lg font-bold text-white">{average === null ? "—" : `${average.toFixed(2)}/20`}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.03]">
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-4">
          <BarChart3 className="h-4 w-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-white">Évaluations d’examens et devoirs corrigés</h2>
          <span className="ml-auto text-xs text-gray-500">{grades.length} note{grades.length > 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Chargement...
          </div>
        ) : grades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Star className="mb-3 h-12 w-12 opacity-20" />
            <p className="text-sm">Aucune note ne correspond aux filtres.</p>
            <p className="mt-1 text-xs">Corrigez un devoir/examen pour alimenter automatiquement cette page.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="px-5 py-3 text-left text-xs uppercase tracking-wide text-gray-500">Élève</th>
                  <th className="px-3 py-3 text-left text-xs uppercase tracking-wide text-gray-500">Matière</th>
                  <th className="px-3 py-3 text-left text-xs uppercase tracking-wide text-gray-500">Période</th>
                  <th className="px-3 py-3 text-center text-xs uppercase tracking-wide text-gray-500">Note</th>
                  <th className="px-5 py-3 text-right text-xs uppercase tracking-wide text-gray-500">Document</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {grades.map((grade) => {
                  const note = gradeValue(grade);
                  return (
                    <tr key={grade.id} className="hover:bg-white/[0.025]">
                      <td className="px-5 py-3">
                        <p className="font-medium text-white">{grade.student?.firstName} {grade.student?.lastName}</p>
                        <p className="text-xs text-gray-500">{grade.student?.classroom?.name || "Classe"} · {grade.student?.matricule || "Matricule"}</p>
                      </td>
                      <td className="px-3 py-3 text-gray-300">{grade.subject?.name || "Matière"}</td>
                      <td className="px-3 py-3 text-gray-400">{periodName(grade)}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={cn("rounded-lg px-2.5 py-1 font-bold", note >= 10 ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300")}>{note.toFixed(2)}/20</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => openReportCard(grade)} className="inline-flex items-center gap-2 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-gray-200 hover:bg-white/[0.1]">
                          <FileText className="h-4 w-4" />
                          Bulletin
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
