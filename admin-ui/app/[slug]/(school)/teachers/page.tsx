"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Plus,
  X,
  Pencil,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Search,
  Upload,
  Download,
  FileText,
  CreditCard,
  Briefcase,
  Printer,
  Trash2,
} from "lucide-react";
import { downloadProtectedFile, schoolApi, type Teacher, type Subject, type Classroom, type CreateTeacherInput } from "@/lib/school-api";
import { SecureImage } from "@/components/ui/secure-image";
import { cn } from "@/lib/utils";

const TEACHER_DOCUMENTS = [
  { type: "ID_CARD", label: "Pièce d'identité" },
  { type: "DIPLOMA", label: "Diplômes" },
  { type: "CV", label: "CV" },
  { type: "CONTRACT", label: "Contrat PDF" },
  { type: "OTHER", label: "Certificats / autres" },
];

const CONTRACT_LABELS: Record<string, string> = {
  CDI: "CDI",
  CDD: "CDD",
  VACATION: "Vacataire",
  VACATAIRE: "Vacataire",
  STAGE: "Stage",
};
const CONTRACT_COLORS: Record<string, string> = {
  CDI: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  CDD: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  VACATION: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  VACATAIRE: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  STAGE: "bg-purple-500/15 text-purple-400 border-purple-500/25",
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
              className="relative w-full max-w-lg bg-soraCard border border-white/10 rounded-2xl shadow-2xl my-auto"
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

function uniqueSubjects(teacher: Teacher) {
  const map = new Map<string, Subject>();
  (teacher.subjects || []).forEach((subject) => map.set(subject.id, subject));
  (teacher.assignments || []).forEach((assignment) => {
    if (assignment.subject) map.set(assignment.subject.id, assignment.subject);
  });
  return [...map.values()];
}

function uniqueClasses(teacher: Teacher) {
  const map = new Map<string, Classroom>();
  (teacher.assignments || []).forEach((assignment) => {
    if (assignment.classroom) map.set(assignment.classroom.id, assignment.classroom);
  });
  return [...map.values()];
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTeacherId, setEditTeacherId] = useState<string | null>(null);
  const [deleteTeacherId, setDeleteTeacherId] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [documentFiles, setDocumentFiles] = useState<Record<string, File[]>>({});
  const [editForm, setEditForm] = useState<{ firstName: string; lastName: string; phone: string; email: string; specialization: string; address: string; contractType: "CDI" | "CDD" | "VACATION" | "VACATAIRE" | "STAGE" }>({
    firstName: "", lastName: "", phone: "", email: "", specialization: "", address: "", contractType: "CDI"
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  const [form, setForm] = useState<CreateTeacherInput>({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    speciality: "",
    specialization: "",
    address: "",
    contractType: "CDI",
    baseSalary: 0,
    hireDate: "",
    subjectIds: [],
    classIds: [],
  });

  const loadTeachers = useCallback(async () => {
    setLoading(true);
    const { data } = await schoolApi.teachers(search, classFilter || undefined);
    if (data?.teachers) setTeachers(data.teachers);
    setLoading(false);
  }, [search, classFilter]);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  useEffect(() => {
    Promise.all([schoolApi.subjects(), schoolApi.classes()]).then(([subjectsRes, classesRes]) => {
      if (subjectsRes.data?.subjects) setSubjects(subjectsRes.data.subjects);
      if (classesRes.data?.classes) setClasses(classesRes.data.classes);
    });
  }, []);

  const filtered = teachers.filter((t) => {
    const q = search.toLowerCase();
    return (
      !q ||
      `${t.firstName} ${t.lastName}`.toLowerCase().includes(q) ||
      (t.speciality || t.specialization || "").toLowerCase().includes(q) ||
      (t.phone || "").toLowerCase().includes(q) ||
      (t.email || "").toLowerCase().includes(q) ||
      (t.matricule || "").toLowerCase().includes(q)
    );
  });

  const teacherPdf = async (
    teacher: Teacher,
    kind: "card" | "profile-pdf" | "contract-pdf",
    mode: "download" | "open" | "print" = "download",
    side: "front" | "back" | "both" = "both"
  ) => {
    setActionMessage(null);
    const names = {
      card: `carte-professeur-${teacher.matricule || teacher.id}-${side === "both" ? "recto-verso" : side === "front" ? "recto" : "verso"}.pdf`,
      "profile-pdf": `fiche-professeur-${teacher.matricule || teacher.id}.pdf`,
      "contract-pdf": `contrat-professeur-${teacher.matricule || teacher.id}.pdf`,
    };
    const endpoint = kind === "card" ? `/api/teachers/${teacher.id}/${kind}?side=${side}` : `/api/teachers/${teacher.id}/${kind}`;
    const error = await downloadProtectedFile(endpoint, names[kind], mode);
    if (error) setActionMessage(error);
  };

  const resetForm = () => {
    setForm({
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      speciality: "",
      specialization: "",
      address: "",
      contractType: "CDI",
      baseSalary: 0,
      hireDate: "",
      subjectIds: [],
      classIds: [],
    });
    setPhotoFile(null);
    setDocumentFiles({});
    setFormError(null);
    setFormSuccess(null);
  };

  const handleAdd = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setFormError("Prénom et nom sont requis");
      return;
    }
    if (!form.phone?.trim()) {
      setFormError("Le téléphone est requis pour l'accès sécurisé");
      return;
    }
    if (!photoFile) {
      setFormError("La photo professionnelle est obligatoire");
      return;
    }
    setFormError(null);
    setSaving(true);
    const payload = Object.fromEntries(
      Object.entries(form).filter(([, v]) => v !== "" && v !== undefined && v !== null)
    ) as CreateTeacherInput;
    const { data, error } = await schoolApi.createTeacher(payload);
    if (error) { setSaving(false); setFormError(error); return; }
    if (!data) { setSaving(false); setFormError("Erreur inattendue"); return; }
    await schoolApi.uploadDocuments("TEACHER", data.teacher.id, "PHOTO", [photoFile], "Photo professionnelle");
    for (const [type, files] of Object.entries(documentFiles)) {
      if (files.length) await schoolApi.uploadDocuments("TEACHER", data.teacher.id, type, files);
    }
    setSaving(false);
    setFormSuccess("Enseignant ajouté !");
    setTimeout(() => { setModalOpen(false); resetForm(); loadTeachers(); }, 900);
  };

  const toggleSubject = (id: string) => {
    setForm((f) => ({
      ...f,
      subjectIds: f.subjectIds?.includes(id)
        ? f.subjectIds.filter((s) => s !== id)
        : [...(f.subjectIds || []), id],
    }));
  };

  const toggleClass = (id: string) => {
    setForm((f) => ({
      ...f,
      classIds: f.classIds?.includes(id)
        ? f.classIds.filter((c) => c !== id)
        : [...(f.classIds || []), id],
    }));
  };

  const openEditModal = (teacher: Teacher) => {
    setEditTeacherId(teacher.id);
    setEditForm({
      firstName: teacher.firstName || "",
      lastName: teacher.lastName || "",
      phone: teacher.phone || "",
      email: teacher.email || "",
      specialization: teacher.specialization || teacher.speciality || "",
      address: teacher.address || "",
      contractType: teacher.contractType || "CDI",
    });
    setEditError(null);
    setEditSuccess(null);
    setEditModalOpen(true);
  };

  const handleEdit = async () => {
    if (!editTeacherId || !editForm.firstName.trim() || !editForm.lastName.trim()) {
      setEditError("Prénom et nom sont requis");
      return;
    }
    setEditError(null);
    setSaving(true);
    const { error } = await schoolApi.updateTeacher(editTeacherId, editForm);
    setSaving(false);
    if (error) { setEditError(error); return; }
    setEditSuccess("Enseignant modifié !");
    setTimeout(() => { setEditModalOpen(false); loadTeachers(); }, 900);
  };

  const openDeleteConfirm = (teacher: Teacher) => {
    setDeleteTeacherId(teacher.id);
    setActionMessage(null);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTeacherId) return;
    setSaving(true);
    const { error } = await schoolApi.deleteTeacher(deleteTeacherId);
    setSaving(false);
    setDeleteConfirmOpen(false);
    if (error) { setActionMessage(error); return; }
    setActionMessage("Enseignant retiré avec succès.");
    loadTeachers();
  };

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading text-white">Enseignants</h1>
          <p className="text-gray-400 text-sm mt-1">
            {loading ? "Chargement..." : `${filtered.length} enseignant${filtered.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => { resetForm(); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)]"
        >
          <Plus className="w-4 h-4" />
          Ajouter enseignant
        </motion.button>
      </motion.div>

      {/* Search */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Rechercher nom, matricule, téléphone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-emerald-500/50 transition-all"
          />
        </div>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white [&>option]:bg-soraCard focus:border-emerald-500/50 transition-all min-w-[180px]"
        >
          <option value="">Toutes les classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </motion.div>

      <AnimatePresence>
        {actionMessage && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {actionMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-white/10" />
                <div className="flex-1">
                  <div className="h-3 bg-white/10 rounded w-36 mb-2" />
                  <div className="h-2 bg-white/[0.07] rounded w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <BookOpen className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">Aucun enseignant trouvé</p>
            <button onClick={() => { resetForm(); setModalOpen(true); }} className="mt-3 text-xs text-emerald-500 hover:text-emerald-400 transition-colors">
              Ajouter le premier enseignant
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Enseignant</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Téléphone</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Spécialité</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contrat</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Matières</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Classes</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <SecureImage
                          src={t.photoUrl}
                          alt={`${t.firstName} ${t.lastName}`}
                          className="w-9 h-9 rounded-full object-cover ring-2 ring-emerald-500/20 flex-shrink-0"
                          fallback={(
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                              {(t.firstName[0] + (t.lastName[0] || "")).toUpperCase()}
                            </div>
                          )}
                        />
                        <div>
                          <p className="text-sm font-medium text-white">{t.firstName} {t.lastName}</p>
                          <p className="text-xs text-gray-500">{t.matricule || t.email || "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-300">{t.phone || "—"}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-300">{t.specialization || t.speciality || "—"}</td>
                    <td className="px-5 py-3.5">
                      {t.contractType ? (
                        <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", CONTRACT_COLORS[t.contractType] || "bg-gray-500/15 text-gray-400 border-gray-500/25")}>
                          {CONTRACT_LABELS[t.contractType] || t.contractType}
                        </span>
                      ) : <span className="text-gray-600 text-sm">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {uniqueSubjects(t).slice(0, 3).map((s) => (
                          <span key={s.id} className="text-xs bg-white/[0.06] text-gray-400 px-2 py-0.5 rounded-full">
                            {s.name}
                          </span>
                        ))}
                        {uniqueSubjects(t).length > 3 && (
                          <span className="text-xs text-gray-500">+{uniqueSubjects(t).length - 3}</span>
                        )}
                        {uniqueSubjects(t).length === 0 && <span className="text-gray-600 text-sm">—</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {uniqueClasses(t).slice(0, 3).map((c) => (
                          <span key={c.id} className="text-xs bg-emerald-500/10 text-emerald-300 px-2 py-0.5 rounded-full">
                            {c.name}
                          </span>
                        ))}
                        {uniqueClasses(t).length > 3 && (
                          <span className="text-xs text-gray-500">+{uniqueClasses(t).length - 3}</span>
                        )}
                        {uniqueClasses(t).length === 0 && <span className="text-gray-600 text-sm">—</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => void teacherPdf(t, "card", "open", "both")}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                          title="Aperçu carte professeur recto-verso"
                        >
                          <CreditCard className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => void teacherPdf(t, "card", "print", "both")}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors"
                          title="Imprimer carte professeur"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => void teacherPdf(t, "card", "download", "both")}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-sky-300 hover:bg-sky-500/10 transition-colors"
                          title="Télécharger carte professeur"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => void teacherPdf(t, "profile-pdf")}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-blue-300 hover:bg-blue-500/10 transition-colors"
                          title="Télécharger fiche professeur"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => void teacherPdf(t, "contract-pdf")}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
                          title="Télécharger contrat professeur"
                        >
                          <Briefcase className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(t)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
                          title="Modifier"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDeleteConfirm(t)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Retirer l'enseignant"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Edit teacher modal */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Modifier l'enseignant">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Prénom" required>
              <input className={inputCls} value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} />
            </FormField>
            <FormField label="Nom" required>
              <input className={inputCls} value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Téléphone">
              <input type="tel" className={inputCls} value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </FormField>
            <FormField label="Email">
              <input type="email" className={inputCls} value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </FormField>
          </div>
          <FormField label="Spécialité">
            <input className={inputCls} value={editForm.specialization} onChange={(e) => setEditForm({ ...editForm, specialization: e.target.value })} />
          </FormField>
          <FormField label="Adresse">
            <input className={inputCls} value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
          </FormField>
          <FormField label="Type de contrat">
            <select className={selectCls} value={editForm.contractType} onChange={(e) => setEditForm({ ...editForm, contractType: e.target.value as "CDI" | "CDD" | "VACATION" | "VACATAIRE" | "STAGE" })}>
              <option value="CDI">CDI</option>
              <option value="CDD">CDD</option>
              <option value="VACATION">Vacataire</option>
              <option value="STAGE">Stage</option>
            </select>
          </FormField>
          <AnimatePresence>
            {editError && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{editError}
              </motion.div>
            )}
            {editSuccess && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />{editSuccess}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setEditModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm hover:bg-white/[0.04] hover:text-white transition-all">Annuler</button>
            <button onClick={handleEdit} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all disabled:opacity-60">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Enregistrer"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm modal */}
      <Modal open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Retirer l'enseignant">
        <div className="space-y-4">
          <p className="text-sm text-gray-300">
            Cette action passera le statut de l&apos;enseignant à <span className="text-red-400 font-semibold">TERMINATED</span>. Il ne pourra plus se connecter ni apparaître dans les listes actives.
          </p>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setDeleteConfirmOpen(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm hover:bg-white/[0.04] hover:text-white transition-all">Annuler</button>
            <button onClick={handleDelete} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-all disabled:opacity-60">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" /> Retirer</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add teacher modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Ajouter un enseignant">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Prénom" required>
              <input className={inputCls} placeholder="Jean" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </FormField>
            <FormField label="Nom" required>
              <input className={inputCls} placeholder="Koné" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Téléphone">
              <input type="tel" className={inputCls} placeholder="+225 07..." value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </FormField>
            <FormField label="Email">
              <input type="email" className={inputCls} placeholder="jean@example.com" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </FormField>
          </div>
          <FormField label="Photo professionnelle" required>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/[0.04] px-3.5 py-3 text-sm text-gray-300 cursor-pointer">
              <span className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-500" />
                {photoFile ? photoFile.name : "Choisir une photo JPG/PNG"}
              </span>
              <span className="text-xs text-emerald-400">Obligatoire</span>
              <input hidden type="file" accept="image/jpeg,image/png" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
            </label>
          </FormField>
          <FormField label="Adresse">
            <input className={inputCls} placeholder="Cocody, Riviera..." value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Spécialité">
              <input className={inputCls} placeholder="Mathématiques" value={form.specialization || form.speciality || ""} onChange={(e) => setForm({ ...form, specialization: e.target.value, speciality: e.target.value })} />
            </FormField>
            <FormField label="Type de contrat">
              <select className={selectCls} value={form.contractType || "CDI"} onChange={(e) => setForm({ ...form, contractType: e.target.value as CreateTeacherInput["contractType"] })}>
                <option value="CDI">CDI</option>
                <option value="CDD">CDD</option>
                <option value="VACATION">Vacataire</option>
                <option value="STAGE">Stage</option>
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Salaire mensuel (XOF)">
              <input type="number" className={inputCls} placeholder="150000" value={form.baseSalary || ""} onChange={(e) => setForm({ ...form, baseSalary: Number(e.target.value) })} />
            </FormField>
            <FormField label="Date d'embauche">
              <input type="date" className={inputCls} value={form.hireDate || ""} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} />
            </FormField>
          </div>

          {subjects.length > 0 && (
            <FormField label="Matières enseignées">
              <div className="flex flex-wrap gap-2 p-3 bg-white/[0.02] border border-white/[0.07] rounded-xl">
                {subjects.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSubject(s.id)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full border transition-all",
                      form.subjectIds?.includes(s.id)
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : "bg-white/[0.04] text-gray-400 border-white/10 hover:border-white/20"
                    )}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </FormField>
          )}

          {classes.length > 0 && (
            <FormField label="Classes assignées">
              <div className="flex flex-wrap gap-2 p-3 bg-white/[0.02] border border-white/[0.07] rounded-xl">
                {classes.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleClass(c.id)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full border transition-all",
                      form.classIds?.includes(c.id)
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : "bg-white/[0.04] text-gray-400 border-white/10 hover:border-white/20"
                    )}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </FormField>
          )}

          <div className="border-t border-white/[0.06] pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Documents enseignant</p>
            <div className="space-y-2">
              {TEACHER_DOCUMENTS.map((doc) => (
                <label key={doc.type} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-gray-300 cursor-pointer">
                  <span className="flex items-center gap-2"><FileText className="w-4 h-4 text-emerald-500" />{doc.label}</span>
                  <span className="text-xs text-gray-500">{documentFiles[doc.type]?.length ? `${documentFiles[doc.type].length} fichier(s)` : "PDF/JPG/PNG"}</span>
                  <input hidden multiple type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setDocumentFiles({ ...documentFiles, [doc.type]: Array.from(e.target.files || []) })} />
                </label>
              ))}
            </div>
          </div>

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
