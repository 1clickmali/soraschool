"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  BookOpen,
  Search,
  FileText,
  Award,
  GraduationCap,
} from "lucide-react";
import {
  downloadProtectedFile,
  schoolApi,
  type AnnualDecisionValue,
  type Classroom,
  type CreateGradeInput,
  type GradePeriod,
  type Student,
  type Subject,
} from "@/lib/school-api";
import { SecureImage } from "@/components/ui/secure-image";
import { cn } from "@/lib/utils";

const PERIODS = ["1er Trimestre", "2ème Trimestre", "3ème Trimestre"];

interface GradeEntry {
  studentId: string;
  student: Student;
  value: string;
  comment: string;
}

export default function GradesPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [periods, setPeriods] = useState<GradePeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDecision, setSavingDecision] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const [subjectId, setSubjectId] = useState("");
  const [period, setPeriod] = useState(PERIODS[0]);
  const [reportPeriodId, setReportPeriodId] = useState("");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [entries, setEntries] = useState<GradeEntry[]>([]);
  const [decisionStudentId, setDecisionStudentId] = useState("");
  const [annualDecision, setAnnualDecision] = useState<AnnualDecisionValue>("PASSED");
  const [nextClassroomId, setNextClassroomId] = useState("");
  const [decisionComment, setDecisionComment] = useState("");
  const [applyDecision, setApplyDecision] = useState(false);

  useEffect(() => {
    Promise.all([
      schoolApi.subjects(),
      schoolApi.classes(),
      schoolApi.gradePeriods(),
    ]).then(([subsRes, classesRes, periodsRes]) => {
      const subs = subsRes.data?.subjects || [];
      const loadedPeriods = periodsRes.data?.periods || [];
      setSubjects(subs);
      if (classesRes.data?.classes) setClasses(classesRes.data.classes);
      setPeriods(loadedPeriods);
      if (subs.length > 0) setSubjectId(subs[0].id);
      if (loadedPeriods.length > 0) {
        setPeriod(loadedPeriods[0].name);
        setReportPeriodId(loadedPeriods[0].id);
      }
    });
  }, []);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    const { data } = await schoolApi.students(search, classFilter || undefined);
    setStudents(data?.students || []);
    setLoading(false);
  }, [search, classFilter]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const initEntries = useCallback(() => {
    setEntries(students.map((s) => ({
      studentId: s.id,
      student: s,
      value: "",
      comment: "",
    })));
  }, [students]);

  useEffect(() => {
    initEntries();
  }, [initEntries, subjectId, period]);

  useEffect(() => {
    if (!decisionStudentId && students.length > 0) setDecisionStudentId(students[0].id);
  }, [decisionStudentId, students]);

  const setGrade = (studentId: string, value: string) => {
    const num = parseFloat(value);
    if (value !== "" && (isNaN(num) || num < 0 || num > 20)) return;
    setEntries((prev) => prev.map((e) => e.studentId === studentId ? { ...e, value } : e));
  };

  const setComment = (studentId: string, comment: string) => {
    setEntries((prev) => prev.map((e) => e.studentId === studentId ? { ...e, comment } : e));
  };

  const handleSave = async () => {
    if (!subjectId) { setSaveError("Sélectionnez une matière"); return; }
    const toSave = entries.filter((e) => e.value !== "");
    if (toSave.length === 0) { setSaveError("Aucune note à enregistrer"); return; }
    setSaveError(null);
    setSaving(true);

    const selectedPeriod = periods.find((p) => p.name === period);
    let hasError = false;
    for (const entry of toSave) {
      const payload: CreateGradeInput = {
        studentId: entry.studentId,
        subjectId,
        value: parseFloat(entry.value),
        periodId: selectedPeriod?.id,
        period: selectedPeriod ? undefined : period,
        comment: entry.comment || undefined,
      };
      const { error } = await schoolApi.createGrade(payload);
      if (error) { hasError = true; break; }
    }
    setSaving(false);
    if (hasError) { setSaveError("Erreur lors de l'enregistrement."); return; }
    const refreshedPeriods = await schoolApi.gradePeriods();
    const loadedPeriods = refreshedPeriods.data?.periods || [];
    if (loadedPeriods.length > 0) {
      setPeriods(loadedPeriods);
      if (!reportPeriodId) setReportPeriodId(loadedPeriods[0].id);
    }
    setSaveSuccess(`${toSave.length} note${toSave.length > 1 ? "s" : ""} enregistrée${toSave.length > 1 ? "s" : ""} !`);
    setTimeout(() => setSaveSuccess(null), 3000);
  };

  const openReportCard = async (student: Student) => {
    if (!reportPeriodId) {
      setSaveError("Choisissez une période avec des notes pour générer le bulletin.");
      return;
    }
    const selected = periods.find((p) => p.id === reportPeriodId);
    const filename = `bulletin-${student.matricule || student.id}-${selected?.name || "periode"}.pdf`;
    const error = await downloadProtectedFile(`/api/grades/report-cards/${student.id}/${reportPeriodId}/pdf`, filename, "open");
    if (error) setSaveError(error);
  };

  const openCertificate = async (student: Student, type: "SCHOOL_CERTIFICATE" | "DIPLOMA") => {
    const filename = `${type === "DIPLOMA" ? "diplome" : "attestation"}-${student.matricule || student.id}.pdf`;
    const error = await downloadProtectedFile(`/api/grades/certificates/${student.id}/pdf?type=${type}`, filename, "open");
    if (error) setSaveError(error);
  };

  const handleDecisionSave = async () => {
    if (!decisionStudentId) { setSaveError("Choisissez un élève pour la décision annuelle."); return; }
    setSaveError(null);
    setSavingDecision(true);
    const { error } = await schoolApi.saveAnnualDecision({
      studentId: decisionStudentId,
      decision: annualDecision,
      nextClassroomId: nextClassroomId || undefined,
      comment: decisionComment || undefined,
      applyToStudent: applyDecision,
    });
    setSavingDecision(false);
    if (error) { setSaveError(error); return; }
    setSaveSuccess("Décision annuelle enregistrée.");
    setDecisionComment("");
    await loadStudents();
    setTimeout(() => setSaveSuccess(null), 3000);
  };

  const avgFilled = entries.filter((e) => e.value !== "");
  const avg = avgFilled.length > 0
    ? (avgFilled.reduce((s, e) => s + parseFloat(e.value), 0) / avgFilled.length).toFixed(2)
    : null;
  const periodOptions = periods.length > 0 ? periods.map((p) => p.name) : PERIODS;

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold font-heading text-white">Notes</h1>
        <p className="text-gray-400 text-sm mt-1">Saisie et gestion des notes</p>
      </motion.div>

      {/* Controls */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 min-w-[240px] flex-1">
          <Search className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher nom, matricule, téléphone..."
            className="bg-transparent text-sm text-white flex-1 focus:outline-none placeholder:text-gray-600"
          />
        </div>
        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 min-w-[190px]">
          <BookOpen className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="bg-transparent text-sm text-white flex-1 focus:outline-none [&>option]:bg-soraCard"
          >
            <option value="">Toutes les classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 min-w-[200px]">
          <BookOpen className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="bg-transparent text-sm text-white flex-1 focus:outline-none [&>option]:bg-soraCard"
          >
            <option value="">Choisir une matière</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5">
          <Star className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-transparent text-sm text-white flex-1 focus:outline-none [&>option]:bg-soraCard"
          >
            {periodOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 min-w-[210px]">
          <FileText className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <select
            value={reportPeriodId}
            onChange={(e) => setReportPeriodId(e.target.value)}
            className="bg-transparent text-sm text-white flex-1 focus:outline-none [&>option]:bg-soraCard"
          >
            <option value="">Période bulletin</option>
            {periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        {avg !== null && (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3.5 py-2.5">
            <span className="text-xs text-gray-400">Moyenne classe:</span>
            <span className="text-sm font-bold text-emerald-400">{avg}/20</span>
          </div>
        )}
      </motion.div>

      {/* Grades table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden mb-4">
        {loading ? (
          <div className="p-6 space-y-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="w-9 h-9 rounded-full bg-white/10 flex-shrink-0" />
                <div className="flex-1"><div className="h-3 bg-white/10 rounded w-36" /></div>
                <div className="w-20 h-9 bg-white/10 rounded-xl" />
                <div className="flex-1 h-9 bg-white/[0.07] rounded-xl" />
              </div>
            ))}
          </div>
        ) : !subjectId ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <BookOpen className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm">Sélectionnez une matière pour commencer</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <Star className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm">Aucun élève enregistré</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_120px_1fr_250px] items-center px-5 py-3 border-b border-white/[0.06] gap-4">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Élève</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Note /20</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Commentaire</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Documents</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {entries.map((entry, idx) => {
                const gradeNum = entry.value !== "" ? parseFloat(entry.value) : null;
                const gradeColor =
                  gradeNum === null ? "" :
                  gradeNum >= 14 ? "text-emerald-400" :
                  gradeNum >= 10 ? "text-amber-400" :
                  "text-red-400";

                return (
                  <motion.div
                    key={entry.studentId}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.02 }}
                    className="grid grid-cols-[1fr_120px_1fr_250px] items-center px-5 py-3 hover:bg-white/[0.02] transition-colors gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <SecureImage
                        src={entry.student.photoUrl || entry.student.photo}
                        alt={`${entry.student.firstName} ${entry.student.lastName}`}
                        className="w-8 h-8 rounded-full object-cover ring-2 ring-emerald-500/20 flex-shrink-0"
                        fallback={(
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                            {(entry.student.firstName[0] + (entry.student.lastName[0] || "")).toUpperCase()}
                          </div>
                        )}
                      />
                      <p className="text-sm font-medium text-white truncate">
                        {entry.student.firstName} {entry.student.lastName}
                      </p>
                    </div>
                    <div>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        step={0.5}
                        placeholder="—"
                        value={entry.value}
                        onChange={(e) => setGrade(entry.studentId, e.target.value)}
                        className={cn(
                          "w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-center transition-all",
                          "focus:outline-none focus:border-emerald-500/50",
                          gradeColor,
                          entry.value !== "" && gradeNum !== null && gradeNum < 10 && "border-red-500/30 bg-red-500/[0.05]",
                          entry.value !== "" && gradeNum !== null && gradeNum >= 14 && "border-emerald-500/30 bg-emerald-500/[0.05]"
                        )}
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Commentaire optionnel..."
                        value={entry.comment}
                        onChange={(e) => setComment(entry.studentId, e.target.value)}
                        className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/50 transition-all"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={!reportPeriodId}
                        onClick={() => void openReportCard(entry.student)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Bulletin
                      </button>
                      <button
                        type="button"
                        onClick={() => void openCertificate(entry.student, "SCHOOL_CERTIFICATE")}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-gray-300 transition hover:text-white hover:bg-white/[0.08]"
                      >
                        <GraduationCap className="w-3.5 h-3.5" />
                        Attestation
                      </button>
                      <button
                        type="button"
                        onClick={() => void openCertificate(entry.student, "DIPLOMA")}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20"
                      >
                        <Award className="w-3.5 h-3.5" />
                        Diplôme
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </motion.div>

      {/* Save button */}
      {entries.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)] disabled:opacity-60"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
            Enregistrer les notes
          </motion.button>

          <AnimatePresence>
            {saveError && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />{saveError}
              </motion.div>
            )}
            {saveSuccess && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-emerald-400 text-sm">
                <CheckCircle className="w-4 h-4" />{saveSuccess}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {students.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-6 rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.055] to-emerald-500/[0.035] p-5"
        >
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Décision annuelle</h2>
              <p className="mt-1 text-sm text-gray-400">
                Valider qui passe, redouble ou reçoit une attestation de fin de classe.
              </p>
            </div>
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              Fin d’année
            </span>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1.4fr_auto]">
            <select
              value={decisionStudentId}
              onChange={(e) => setDecisionStudentId(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none [&>option]:bg-soraCard"
            >
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.lastName} {student.firstName} {student.classroom?.name ? `- ${student.classroom.name}` : ""}
                </option>
              ))}
            </select>
            <select
              value={annualDecision}
              onChange={(e) => setAnnualDecision(e.target.value as AnnualDecisionValue)}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none [&>option]:bg-soraCard"
            >
              <option value="PASSED">Passe</option>
              <option value="REPEATED">Redouble</option>
              <option value="GRADUATED">Diplômé / admis</option>
            </select>
            <select
              value={nextClassroomId}
              onChange={(e) => setNextClassroomId(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none [&>option]:bg-soraCard"
            >
              <option value="">Classe suivante</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input
              value={decisionComment}
              onChange={(e) => setDecisionComment(e.target.value)}
              placeholder="Observation du conseil de classe..."
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none placeholder:text-gray-600 focus:border-emerald-500/50"
            />
            <button
              type="button"
              onClick={handleDecisionSave}
              disabled={savingDecision}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(16,185,129,0.2)] transition hover:bg-emerald-500 disabled:opacity-60"
            >
              {savingDecision ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Valider
            </button>
          </div>

          <label className="mt-3 flex items-center gap-2 text-xs text-gray-400">
            <input
              type="checkbox"
              checked={applyDecision}
              onChange={(e) => setApplyDecision(e.target.checked)}
              className="h-4 w-4 rounded border-white/10 bg-white/[0.04]"
            />
            Déplacer automatiquement l’élève dans la classe suivante sélectionnée
          </label>
        </motion.div>
      )}
    </div>
  );
}
