"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  BookOpen,
  CheckCircle,
  GraduationCap,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  schoolApi,
  type AcademicYear,
  type Assignment,
  type Classroom,
  type CreateSubjectInput,
  type Subject,
  type Teacher,
} from "@/lib/school-api";
import { cn } from "@/lib/utils";

const inputCls = cn(
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white",
  "placeholder:text-gray-600 transition-all focus:border-emerald-500/50 focus:bg-emerald-500/[0.03]"
);
const selectCls = cn(inputCls, "[&>option]:bg-soraCard");

function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 18 }}
              className="w-full max-w-lg rounded-2xl border border-white/10 bg-soraCard shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
                <h2 className="font-heading text-base font-semibold text-white">{title}</h2>
                <button onClick={onClose} className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-white/10 hover:text-white">
                  <X className="h-4 w-4" />
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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-400">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

function teacherName(teacher?: Teacher) {
  if (!teacher) return "Professeur";
  return `${teacher.firstName} ${teacher.lastName}`.trim();
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [savingSubject, setSavingSubject] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [subjectForm, setSubjectForm] = useState<CreateSubjectInput>({ name: "", code: "", coefficient: 1 });
  const [assignmentForm, setAssignmentForm] = useState({
    teacherId: "",
    classroomId: "",
    subjectId: "",
    academicYearId: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [subjectRes, teacherRes, classRes, assignmentRes, yearRes] = await Promise.all([
      schoolApi.subjects({ includeInactive: true }),
      schoolApi.teachers(),
      schoolApi.classes(),
      schoolApi.assignments(),
      schoolApi.academicYears(),
    ]);
    const nextSubjects = subjectRes.data?.subjects || [];
    const nextTeachers = teacherRes.data?.teachers || [];
    const nextClasses = classRes.data?.classes || [];
    const nextAssignments = assignmentRes.data?.assignments || [];
    const nextYears = yearRes.data?.academicYears || [];
    const activeYear = nextYears.find((year) => year.isActive) || nextYears[0];

    setSubjects(nextSubjects);
    setTeachers(nextTeachers);
    setClasses(nextClasses);
    setAssignments(nextAssignments);
    setAcademicYears(nextYears);
    setAssignmentForm((previous) => ({
      teacherId: previous.teacherId || nextTeachers[0]?.id || "",
      classroomId: previous.classroomId || nextClasses[0]?.id || "",
      subjectId: previous.subjectId || nextSubjects.find((subject) => subject.isActive !== false)?.id || "",
      academicYearId: previous.academicYearId || activeYear?.id || "",
    }));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredSubjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return subjects;
    return subjects.filter((subject) =>
      [subject.name, subject.code || ""].some((value) => value.toLowerCase().includes(query))
    );
  }, [subjects, search]);

  const activeSubjects = subjects.filter((subject) => subject.isActive !== false);
  const assignedSubjectIds = new Set(assignments.map((assignment) => assignment.subject?.id || assignment.subjectId).filter(Boolean));
  const assignedTeacherIds = new Set(assignments.map((assignment) => assignment.teacher?.id || assignment.teacherId).filter(Boolean));

  const resetSubjectForm = () => {
    setEditingSubject(null);
    setSubjectForm({ name: "", code: "", coefficient: 1 });
    setMessage(null);
  };

  const openCreateSubject = () => {
    resetSubjectForm();
    setSubjectModalOpen(true);
  };

  const openEditSubject = (subject: Subject) => {
    setEditingSubject(subject);
    setSubjectForm({
      name: subject.name,
      code: subject.code || "",
      coefficient: subject.coefficient || 1,
    });
    setMessage(null);
    setSubjectModalOpen(true);
  };

  const saveSubject = async () => {
    if (!subjectForm.name.trim()) {
      setMessage({ type: "error", text: "Le nom de la matière est obligatoire." });
      return;
    }
    setSavingSubject(true);
    const payload = {
      name: subjectForm.name.trim(),
      code: subjectForm.code?.trim() || undefined,
      coefficient: Number(subjectForm.coefficient) || 1,
    };
    const result = editingSubject
      ? await schoolApi.updateSubject(editingSubject.id, payload)
      : await schoolApi.createSubject(payload);
    setSavingSubject(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setMessage({ type: "success", text: editingSubject ? "Matière mise à jour." : "Matière créée." });
    setTimeout(() => {
      setSubjectModalOpen(false);
      resetSubjectForm();
      load();
    }, 700);
  };

  const toggleSubject = async (subject: Subject) => {
    const result = subject.isActive === false
      ? await schoolApi.updateSubject(subject.id, { isActive: true })
      : await schoolApi.archiveSubject(subject.id);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
      return;
    }
    setMessage({ type: "success", text: subject.isActive === false ? "Matière réactivée." : "Matière archivée." });
    load();
  };

  const createAssignment = async () => {
    if (!assignmentForm.teacherId || !assignmentForm.classroomId || !assignmentForm.subjectId) {
      setMessage({ type: "error", text: "Choisissez un professeur, une classe et une matière." });
      return;
    }
    setSavingAssignment(true);
    const { error } = await schoolApi.createAssignment({
      teacherId: assignmentForm.teacherId,
      classroomId: assignmentForm.classroomId,
      subjectId: assignmentForm.subjectId,
      academicYearId: assignmentForm.academicYearId || undefined,
    });
    setSavingAssignment(false);
    if (error) {
      setMessage({ type: "error", text: error });
      return;
    }
    setMessage({ type: "success", text: "Affectation créée ou déjà synchronisée." });
    load();
  };

  const deleteAssignment = async (assignment: Assignment) => {
    const { error } = await schoolApi.deleteAssignment(assignment.id);
    if (error) {
      setMessage({ type: "error", text: error });
      return;
    }
    setMessage({ type: "success", text: "Affectation supprimée." });
    load();
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white">Matières</h1>
          <p className="mt-1 text-sm text-gray-400">Créez les matières et reliez chaque professeur à sa classe et son année scolaire.</p>
        </div>
        <button
          onClick={openCreateSubject}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all hover:bg-emerald-500"
        >
          <Plus className="h-4 w-4" />
          Ajouter une matière
        </button>
      </motion.div>

      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm",
              message.type === "success" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-red-500/20 bg-red-500/10 text-red-300"
            )}
          >
            {message.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Matières actives", value: activeSubjects.length, icon: BookOpen, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Affectations", value: assignments.length, icon: GraduationCap, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Profs affectés", value: assignedTeacherIds.size, icon: Users, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "Matières non assignées", value: activeSubjects.filter((subject) => !assignedSubjectIds.has(subject.id)).length, icon: AlertCircle, color: "text-red-300", bg: "bg-red-500/10" },
        ].map((stat, index) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
            <div className={cn("mb-3 flex h-10 w-10 items-center justify-center rounded-xl", stat.bg)}>
              <stat.icon className={cn("h-5 w-5", stat.color)} />
            </div>
            <p className="font-heading text-2xl font-bold text-white">{stat.value}</p>
            <p className="mt-0.5 text-xs text-gray-500">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-white/[0.07] bg-white/[0.03]">
          <div className="flex flex-col gap-3 border-b border-white/[0.06] p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-heading text-base font-semibold text-white">Catalogue des matières</h2>
              <p className="mt-0.5 text-xs text-gray-500">Les matières archivées ne sont plus proposées dans les nouveaux devoirs et emplois du temps.</p>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} className={cn(inputCls, "pl-10")} placeholder="Rechercher..." />
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-xl bg-white/[0.05]" />
              ))}
            </div>
          ) : filteredSubjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
              <BookOpen className="mb-3 h-10 w-10 text-gray-700" />
              <p className="text-sm font-medium text-gray-400">Aucune matière trouvée</p>
              <button onClick={openCreateSubject} className="mt-3 text-xs font-medium text-emerald-400 hover:text-emerald-300">Créer une matière</button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {filteredSubjects.map((subject) => {
                const subjectAssignments = assignments.filter((assignment) => (assignment.subject?.id || assignment.subjectId) === subject.id);
                return (
                  <div key={subject.id} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-white/[0.02] md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-white">{subject.name}</p>
                        {subject.code && <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-gray-400">{subject.code}</span>}
                        <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", subject.isActive === false ? "border-gray-500/20 bg-gray-500/10 text-gray-500" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300")}>
                          {subject.isActive === false ? "Archivée" : "Active"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Coefficient {subject.coefficient || 1} · {subjectAssignments.length} affectation{subjectAssignments.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEditSubject(subject)} className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-white/10 hover:text-white" title="Modifier">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => toggleSubject(subject)} className={cn("rounded-lg px-3 py-2 text-xs font-semibold transition-colors", subject.isActive === false ? "bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20" : "bg-red-500/10 text-red-300 hover:bg-red-500/20")}>
                        {subject.isActive === false ? "Réactiver" : "Archiver"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="space-y-5">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-heading text-base font-semibold text-white">Affecter une matière</h2>
                <p className="mt-0.5 text-xs text-gray-500">Un professeur peut avoir plusieurs matières, dans plusieurs classes.</p>
              </div>
              <button onClick={load} className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-white/10 hover:text-white" title="Actualiser">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <Field label="Professeur" required>
                <select className={selectCls} value={assignmentForm.teacherId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, teacherId: event.target.value }))}>
                  <option value="">Choisir un professeur</option>
                  {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacherName(teacher)}</option>)}
                </select>
              </Field>
              <Field label="Classe" required>
                <select className={selectCls} value={assignmentForm.classroomId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, classroomId: event.target.value }))}>
                  <option value="">Choisir une classe</option>
                  {classes.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.name}</option>)}
                </select>
              </Field>
              <Field label="Matière" required>
                <select className={selectCls} value={assignmentForm.subjectId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, subjectId: event.target.value }))}>
                  <option value="">Choisir une matière</option>
                  {activeSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                </select>
              </Field>
              <Field label="Année scolaire">
                <select className={selectCls} value={assignmentForm.academicYearId} onChange={(event) => setAssignmentForm((prev) => ({ ...prev, academicYearId: event.target.value }))}>
                  <option value="">Année active automatiquement</option>
                  {academicYears.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isActive ? " · active" : ""}</option>)}
                </select>
              </Field>
              <button
                onClick={createAssignment}
                disabled={savingAssignment}
                className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
              >
                {savingAssignment ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Affecter
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03]">
            <div className="border-b border-white/[0.06] px-5 py-4">
              <h2 className="font-heading text-base font-semibold text-white">Affectations existantes</h2>
              <p className="mt-0.5 text-xs text-gray-500">Ces liens alimentent directement devoirs, notes, présences prof et emploi du temps.</p>
            </div>
            <div className="max-h-[460px] divide-y divide-white/[0.05] overflow-y-auto">
              {assignments.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <GraduationCap className="mx-auto mb-3 h-10 w-10 text-gray-700" />
                  <p className="text-sm text-gray-500">Aucune affectation créée.</p>
                </div>
              ) : assignments.map((assignment) => (
                <div key={assignment.id} className="flex items-start justify-between gap-3 px-5 py-4 hover:bg-white/[0.02]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{teacherName(assignment.teacher)}</p>
                    <p className="mt-1 text-xs text-gray-400">{assignment.classroom?.name || "Classe"} · {assignment.subject?.name || "Matière"}</p>
                    <p className="mt-0.5 text-xs text-gray-600">{assignment.academicYear?.name || "Année active"}</p>
                  </div>
                  <button onClick={() => deleteAssignment(assignment)} className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-300" title="Supprimer l'affectation">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      <Modal open={subjectModalOpen} title={editingSubject ? "Modifier la matière" : "Créer une matière"} onClose={() => setSubjectModalOpen(false)}>
        <div className="space-y-4">
          <Field label="Nom de la matière" required>
            <input className={inputCls} value={subjectForm.name} onChange={(event) => setSubjectForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Mathématiques, Français, Sciences islamiques..." />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code">
              <input className={inputCls} value={subjectForm.code || ""} onChange={(event) => setSubjectForm((prev) => ({ ...prev, code: event.target.value }))} placeholder="MATH" />
            </Field>
            <Field label="Coefficient">
              <input type="number" min={1} className={inputCls} value={subjectForm.coefficient || 1} onChange={(event) => setSubjectForm((prev) => ({ ...prev, coefficient: Number(event.target.value) || 1 }))} />
            </Field>
          </div>
          {message && (
            <div className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm",
              message.type === "success" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-red-500/20 bg-red-500/10 text-red-300"
            )}>
              {message.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {message.text}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setSubjectModalOpen(false)} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-gray-400 transition-colors hover:bg-white/[0.04] hover:text-white">Annuler</button>
            <button onClick={saveSubject} disabled={savingSubject} className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50">
              {savingSubject ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
