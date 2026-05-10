"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  Download,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Star,
  Users,
} from "lucide-react";
import {
  downloadProtectedFile,
  schoolApi,
  type Assignment,
  type GradePeriod,
  type Homework,
  type HomeworkCorrection,
} from "@/lib/school-api";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";

const fieldClass = "w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-violet-500/50 [&>option]:bg-soraDark";

const homeworkKinds = [
  { value: "DEVOIR", label: "Devoir" },
  { value: "EXAMEN", label: "Examen" },
  { value: "INTERROGATION", label: "Interrogation" },
  { value: "PROJET", label: "Projet" },
] as const;

type HomeworkKind = (typeof homeworkKinds)[number]["value"];
type HomeworkForm = {
  classroomId: string;
  subjectId: string;
  kind: HomeworkKind;
  title: string;
  description: string;
  dueDate: string;
  maxScore: string;
};

const statusStyle: Record<string, string> = {
  ASSIGNED: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  POSTPONED: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  CORRECTING: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  GRADED: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  CANCELED: "bg-red-500/10 text-red-300 border-red-500/20",
};

const statusLabel: Record<string, string> = {
  ASSIGNED: "Publié",
  POSTPONED: "Reporté",
  CORRECTING: "Correction",
  GRADED: "Corrigé",
  CANCELED: "Annulé",
};

function formatDate(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-CI", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function dateInputValue(value?: string) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function studentName(correction: HomeworkCorrection) {
  return `${correction.student.firstName} ${correction.student.lastName}`.trim();
}

function correctionStats(homework: Homework) {
  const corrections = homework.corrections || [];
  const corrected = corrections.filter((correction) => correction.score !== null && correction.score !== undefined);
  const average = corrected.length
    ? corrected.reduce((sum, correction) => sum + Number(correction.score || 0), 0) / corrected.length
    : null;
  return { total: corrections.length, corrected: corrected.length, average };
}

export default function DevoirsPage() {
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [periods, setPeriods] = useState<GradePeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [correctOpen, setCorrectOpen] = useState(false);
  const [selectedHomework, setSelectedHomework] = useState<Homework | null>(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [correctionRows, setCorrectionRows] = useState<Array<{ studentId: string; score: string; appreciation: string; comment: string }>>([]);

  const emptyForm: HomeworkForm = {
    classroomId: "",
    subjectId: "",
    kind: "DEVOIR" as const,
    title: "",
    description: "",
    dueDate: "",
    maxScore: "20",
  };
  const [form, setForm] = useState(emptyForm);

  const classrooms = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    assignments.forEach((assignment) => assignment.classroom && map.set(assignment.classroom.id, assignment.classroom));
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [assignments]);

  const subjects = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    assignments.forEach((assignment) => {
      if (!form.classroomId || assignment.classroom?.id === form.classroomId) {
        if (assignment.subject) map.set(assignment.subject.id, assignment.subject);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [assignments, form.classroomId]);

  const load = async () => {
    setLoading(true);
    const [homeworkRes, assignmentRes, periodRes] = await Promise.all([
      schoolApi.homeworks(),
      schoolApi.assignments(),
      schoolApi.gradePeriods(),
    ]);
    if (homeworkRes.error) setMessage(homeworkRes.error);
    setHomeworks(homeworkRes.data?.homeworks || []);
    setAssignments(assignmentRes.data?.assignments || []);
    setPeriods(periodRes.data?.periods || []);
    setSelectedPeriodId((prev) => prev || periodRes.data?.periods?.[0]?.id || "");
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setCreateOpen(true);
  };

  const openEdit = (homework: Homework) => {
    setSelectedHomework(homework);
    setForm({
      classroomId: homework.classroomId,
      subjectId: homework.subjectId,
      kind: (homework.kind || "DEVOIR") as typeof emptyForm.kind,
      title: homework.title,
      description: homework.description || "",
      dueDate: dateInputValue(homework.dueDate),
      maxScore: String(homework.maxScore || 20),
    });
    setEditOpen(true);
  };

  const openCorrection = (homework: Homework) => {
    setSelectedHomework(homework);
    setCorrectionRows(
      (homework.corrections || []).map((correction) => ({
        studentId: correction.studentId,
        score: correction.score === null || correction.score === undefined ? "" : String(correction.score),
        appreciation: correction.appreciation || "",
        comment: correction.comment || "",
      }))
    );
    setCorrectOpen(true);
  };

  const saveHomework = async (mode: "create" | "edit") => {
    if (!form.classroomId || !form.subjectId || !form.title || !form.dueDate) return;
    setSaving(true);
    setMessage(null);
    const payload = {
      classroomId: form.classroomId,
      subjectId: form.subjectId,
      kind: form.kind,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      dueDate: form.dueDate,
      maxScore: Number(form.maxScore) || 20,
    };
    const result =
      mode === "create"
        ? await schoolApi.createHomework(payload)
        : selectedHomework
          ? await schoolApi.updateHomework(selectedHomework.id, payload)
          : { data: null, error: "Devoir introuvable" };
    setSaving(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setCreateOpen(false);
    setEditOpen(false);
    setSelectedHomework(null);
    setMessage(mode === "create" ? "Devoir créé et visible par la direction." : "Devoir mis à jour.");
    await load();
  };

  const saveCorrections = async () => {
    if (!selectedHomework) return;
    setSaving(true);
    setMessage(null);
    const { data, error } = await schoolApi.saveHomeworkCorrections(selectedHomework.id, {
      periodId: selectedPeriodId || undefined,
      corrections: correctionRows
        .filter((row) => row.score !== "" && !Number.isNaN(Number(row.score)))
        .map((row) => ({
          studentId: row.studentId,
          score: Number(row.score),
          appreciation: row.appreciation || undefined,
          comment: row.comment || undefined,
        })),
    });
    setSaving(false);
    if (error) {
      setMessage(error);
      return;
    }
    setCorrectOpen(false);
    setSelectedHomework(null);
    setMessage("Correction enregistrée et notes envoyées dans les bulletins.");
    if (data?.homework) {
      setHomeworks((prev) => prev.map((homework) => (homework.id === data.homework.id ? data.homework : homework)));
    } else {
      await load();
    }
  };

  const exportNotes = async (homework: Homework) => {
    const error = await downloadProtectedFile(`/api/homeworks/${homework.id}/export.csv`, `notes-${homework.title}.csv`);
    if (error) setMessage(error);
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white">Devoirs, examens et corrections</h1>
          <p className="mt-1 text-sm text-gray-400">Créer, reporter, modifier, corriger et exporter les notes de vos classes.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.09]">
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </button>
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(139,92,246,0.3)] transition hover:bg-violet-500">
            <Plus className="h-4 w-4" />
            Nouveau devoir/examen
          </button>
        </div>
      </motion.div>

      {message && (
        <div className="mb-5 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-gray-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          {message}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, index) => <div key={index} className="h-52 animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.04]" />)}
        </div>
      ) : homeworks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-white/[0.07] bg-white/[0.03] py-20 text-center">
          <BookOpen className="mb-3 h-14 w-14 text-gray-700" />
          <p className="font-semibold text-white">Aucun devoir ou examen publié</p>
          <p className="mt-1 text-sm text-gray-500">Créez le premier devoir relié à votre classe et à votre matière.</p>
          <button onClick={openCreate} className="mt-5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500">Créer maintenant</button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {homeworks.map((homework) => {
            const stats = correctionStats(homework);
            const overdue = dateInputValue(homework.dueDate) < today && homework.status !== "GRADED";
            return (
              <motion.article key={homework.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl border border-white/[0.07] bg-soraCard">
                <div className="border-b border-white/[0.06] p-5">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-2 py-1 text-xs font-semibold text-violet-200">{homework.kind || "DEVOIR"}</span>
                    <span className={cn("rounded-full border px-2 py-1 text-xs font-semibold", statusStyle[homework.status] || statusStyle.ASSIGNED)}>{statusLabel[homework.status] || homework.status}</span>
                    {overdue && <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-300">Date dépassée</span>}
                  </div>
                  <h2 className="line-clamp-2 font-heading text-lg font-bold text-white">{homework.title}</h2>
                  <p className="mt-1 text-xs text-gray-500">{homework.classroom?.name || "Classe"} · {homework.subject?.name || "Matière"}</p>
                  {homework.description && <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-400">{homework.description}</p>}
                </div>

                <div className="grid grid-cols-3 gap-2 p-4">
                  <MiniStat icon={Calendar} label="Remise" value={formatDate(homework.dueDate)} />
                  <MiniStat icon={Users} label="Corrigés" value={`${stats.corrected}/${stats.total}`} />
                  <MiniStat icon={Star} label="Moyenne" value={stats.average === null ? "—" : `${stats.average.toFixed(2)}/${homework.maxScore}`} />
                </div>

                <div className="flex flex-wrap gap-2 border-t border-white/[0.06] p-4">
                  <button onClick={() => openCorrection(homework)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500">
                    <Save className="h-4 w-4" />
                    Corriger
                  </button>
                  <button onClick={() => openEdit(homework)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-gray-200 hover:bg-white/[0.09]">
                    <Edit3 className="h-4 w-4" />
                    Modifier / reporter
                  </button>
                  <button onClick={() => exportNotes(homework)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20">
                    <Download className="h-4 w-4" />
                    Évaluations CSV
                  </button>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      <HomeworkFormModal
        open={createOpen}
        title="Créer un devoir ou examen"
        form={form}
        setForm={setForm}
        classrooms={classrooms}
        subjects={subjects}
        saving={saving}
        onClose={() => setCreateOpen(false)}
        onSave={() => saveHomework("create")}
      />

      <HomeworkFormModal
        open={editOpen}
        title="Modifier ou reporter"
        form={form}
        setForm={setForm}
        classrooms={classrooms}
        subjects={subjects}
        saving={saving}
        onClose={() => setEditOpen(false)}
        onSave={() => saveHomework("edit")}
      />

      <Modal isOpen={correctOpen} onClose={() => setCorrectOpen(false)} title={`Corriger : ${selectedHomework?.title || ""}`} size="xl">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Période bulletin</label>
              <select value={selectedPeriodId} onChange={(e) => setSelectedPeriodId(e.target.value)} className={fieldClass}>
                <option value="">Créer/utiliser période Devoirs & examens</option>
                {periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}
              </select>
            </div>
            <InfoBox label="Barème" value={`${selectedHomework?.maxScore || 20} points`} />
            <InfoBox label="Apprenants" value={`${correctionRows.length}`} />
          </div>

          <div className="max-h-[55vh] overflow-y-auto rounded-2xl border border-white/[0.07]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-soraCard">
                <tr className="border-b border-white/[0.06]">
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-gray-500">Élève</th>
                  <th className="px-3 py-3 text-center text-xs uppercase tracking-wide text-gray-500">Note</th>
                  <th className="px-3 py-3 text-left text-xs uppercase tracking-wide text-gray-500">Appréciation</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-gray-500">Commentaire</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {(selectedHomework?.corrections || []).map((correction) => {
                  const row = correctionRows.find((item) => item.studentId === correction.studentId);
                  if (!row) return null;
                  return (
                    <tr key={correction.id} className="hover:bg-white/[0.025]">
                      <td className="px-4 py-3 font-medium text-white">{studentName(correction)}</td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min={0}
                          max={selectedHomework?.maxScore || 20}
                          step={0.25}
                          value={row.score}
                          onChange={(e) => setCorrectionRows((prev) => prev.map((item) => item.studentId === row.studentId ? { ...item, score: e.target.value } : item))}
                          className="mx-auto block w-20 rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1.5 text-center text-sm font-bold text-white outline-none focus:border-violet-500/50"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <input
                          value={row.appreciation}
                          onChange={(e) => setCorrectionRows((prev) => prev.map((item) => item.studentId === row.studentId ? { ...item, appreciation: e.target.value } : item))}
                          placeholder="Bien, Assez bien..."
                          className={fieldClass}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={row.comment}
                          onChange={(e) => setCorrectionRows((prev) => prev.map((item) => item.studentId === row.studentId ? { ...item, comment: e.target.value } : item))}
                          placeholder="Observation..."
                          className={fieldClass}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={() => setCorrectOpen(false)} className="flex-1 rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/[0.09]">Annuler</button>
            <button onClick={saveCorrections} disabled={saving || correctionRows.every((row) => row.score === "")} className="flex-1 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50">
              {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Enregistrer la correction"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function HomeworkFormModal({
  open,
  title,
  form,
  setForm,
  classrooms,
  subjects,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  form: HomeworkForm;
  setForm: React.Dispatch<React.SetStateAction<HomeworkForm>>;
  classrooms: Array<{ id: string; name: string }>;
  subjects: Array<{ id: string; name: string }>;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal isOpen={open} onClose={onClose} title={title} size="lg">
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Classe</label>
            <select value={form.classroomId} onChange={(e) => setForm((prev) => ({ ...prev, classroomId: e.target.value, subjectId: "" }))} className={fieldClass}>
              <option value="">Sélectionner...</option>
              {classrooms.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Matière</label>
            <select value={form.subjectId} onChange={(e) => setForm((prev) => ({ ...prev, subjectId: e.target.value }))} className={fieldClass}>
              <option value="">Sélectionner...</option>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Type</label>
            <select value={form.kind} onChange={(e) => setForm((prev) => ({ ...prev, kind: e.target.value as typeof form.kind }))} className={fieldClass}>
              {homeworkKinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Titre</label>
          <input value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Ex: Examen fractions, devoir maison..." className={fieldClass} />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Consignes</label>
          <textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} rows={3} placeholder="Instructions, chapitres à réviser, documents nécessaires..." className={cn(fieldClass, "resize-none")} />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Date de remise / examen</label>
            <input type="date" value={form.dueDate} onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))} className={fieldClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Barème</label>
            <input type="number" min={1} max={100} value={form.maxScore} onChange={(e) => setForm((prev) => ({ ...prev, maxScore: e.target.value }))} className={fieldClass} />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/[0.09]">Annuler</button>
          <button onClick={onSave} disabled={saving || !form.classroomId || !form.subjectId || !form.title || !form.dueDate} className="flex-1 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50">
            {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Enregistrer"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
      <Icon className="mb-2 h-4 w-4 text-violet-300" />
      <p className="truncate text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 truncate text-xs font-semibold text-white">{value}</p>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
