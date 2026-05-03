"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap,
  Search,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Upload,
  FileText,
} from "lucide-react";
import { schoolApi, type Student, type Classroom, type CreateStudentInput } from "@/lib/school-api";
import { SecureImage } from "@/components/ui/secure-image";
import { cn, formatDate } from "@/lib/utils";

const PAGE_SIZE = 10;
const STUDENT_DOCUMENTS = [
  { type: "BIRTH_CERTIFICATE", label: "Acte de naissance" },
  { type: "ID_CARD", label: "Pièce identité parent/tuteur" },
  { type: "REPORT_CARD", label: "Ancien bulletin" },
  { type: "MEDICAL_CERTIFICATE", label: "Certificat médical" },
  { type: "OTHER", label: "Autres documents" },
];

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif",
  INACTIVE: "Inactif",
  ENROLLED: "Inscrit",
  PENDING: "En attente",
  SUSPENDED: "Suspendu",
  GRADUATED: "Diplômé",
};
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  INACTIVE: "bg-gray-500/15 text-gray-400 border-gray-500/25",
  ENROLLED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  PENDING: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  SUSPENDED: "bg-red-500/15 text-red-400 border-red-500/25",
  GRADUATED: "bg-blue-500/15 text-blue-400 border-blue-500/25",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", STATUS_COLORS[status] || "bg-gray-500/15 text-gray-400 border-gray-500/25")}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
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
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
                >
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

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = cn(
  "w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white",
  "placeholder:text-gray-600 focus:border-emerald-500/50 focus:bg-emerald-500/[0.03] transition-all duration-200"
);
const selectCls = cn(
  "w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white",
  "focus:border-emerald-500/50 focus:bg-emerald-500/[0.03] transition-all duration-200",
  "[&>option]:bg-soraCard"
);

export default function StudentsPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [documentFiles, setDocumentFiles] = useState<Record<string, File[]>>({});

  const [form, setForm] = useState<CreateStudentInput>({
    firstName: "",
    lastName: "",
    gender: undefined,
    dateOfBirth: "",
    classroomId: "",
    birthPlace: "",
    nationality: "Ivoirienne",
    phone: "",
    email: "",
    cycle: "",
    program: "",
    enrollmentKind: "NEW",
    boardingRegime: "DAY",
    parentName: "",
    parentPhone: "",
    parentRelation: "",
    address: "",
    city: "",
    medicalNotes: "",
    bloodGroup: "",
    allergies: "",
    knownIllness: "",
    currentTreatment: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    fatherName: "",
    fatherPhone: "",
    fatherProfession: "",
    fatherIdNumber: "",
    motherName: "",
    motherPhone: "",
    motherProfession: "",
    motherIdNumber: "",
    guardianName: "",
    guardianPhone: "",
    guardianRelation: "",
    guardianAddress: "",
    tuitionAmount: undefined,
    tuitionTitle: "Frais de scolarité",
    tuitionDueDate: "",
  });

  const loadStudents = useCallback(async () => {
    setLoading(true);
    const { data } = await schoolApi.students(search, classFilter || undefined);
    if (data?.students) setStudents(data.students);
    setLoading(false);
  }, [search, classFilter]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    schoolApi.classes().then(({ data }) => {
      if (data?.classes) setClasses(data.classes);
    });
  }, []);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search, classFilter]);

  const paged = students.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(students.length / PAGE_SIZE);

  const resetForm = () => {
    setForm({
      firstName: "", lastName: "", gender: undefined, dateOfBirth: "",
      classroomId: "", birthPlace: "", nationality: "Ivoirienne", phone: "", email: "",
      cycle: "", program: "", enrollmentKind: "NEW", boardingRegime: "DAY",
      parentName: "", parentPhone: "", parentRelation: "",
      address: "", city: "", medicalNotes: "", bloodGroup: "", allergies: "",
      knownIllness: "", currentTreatment: "", emergencyContactName: "", emergencyContactPhone: "",
      fatherName: "", fatherPhone: "", fatherProfession: "", fatherIdNumber: "",
      motherName: "", motherPhone: "", motherProfession: "", motherIdNumber: "",
      guardianName: "", guardianPhone: "", guardianRelation: "", guardianAddress: "",
      tuitionAmount: undefined, tuitionTitle: "Frais de scolarité", tuitionDueDate: "",
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
    if (!photoFile) {
      setFormError("La photo d'identité est obligatoire");
      return;
    }
    setFormError(null);
    setSaving(true);
    // Strip empty strings — Zod optional fields reject "" but accept undefined
    const payload = Object.fromEntries(
      Object.entries(form).filter(([, v]) => v !== "" && v !== undefined && v !== null)
    ) as CreateStudentInput;
    const { data, error } = await schoolApi.createStudent(payload);
    setSaving(false);
    if (error) { setFormError(error); return; }
    if (!data) { setFormError("Erreur inattendue"); return; }
    await schoolApi.uploadDocuments("STUDENT", data.student.id, "PHOTO", [photoFile], "Photo d'identité");
    for (const [type, files] of Object.entries(documentFiles)) {
      if (files.length) await schoolApi.uploadDocuments("STUDENT", data.student.id, type, files);
    }
    setFormSuccess("Élève ajouté avec succès !");
    setTimeout(() => {
      setModalOpen(false);
      resetForm();
      loadStudents();
    }, 900);
  };

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <h1 className="text-2xl font-bold font-heading text-white">Élèves</h1>
          <p className="text-gray-400 text-sm mt-1">
            {loading ? "Chargement..." : `${students.length} élève${students.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => { resetForm(); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)]"
        >
          <Plus className="w-4 h-4" />
          Ajouter un élève
        </motion.button>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-3 mb-5"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Rechercher un élève..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-emerald-500/50 transition-all"
          />
        </div>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white [&>option]:bg-soraCard focus:border-emerald-500/50 transition-all min-w-[160px]"
        >
          <option value="">Toutes les classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden"
      >
        {loading ? (
          <div className="p-6 space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="w-9 h-9 rounded-full bg-white/10 flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-3 bg-white/10 rounded w-40 mb-2" />
                  <div className="h-2 bg-white/[0.07] rounded w-24" />
                </div>
                <div className="h-5 bg-white/10 rounded-full w-16" />
              </div>
            ))}
          </div>
        ) : paged.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <GraduationCap className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">Aucun élève trouvé</p>
            {search || classFilter ? (
              <p className="text-xs mt-1">Essayez de modifier vos filtres</p>
            ) : (
              <button
                onClick={() => { resetForm(); setModalOpen(true); }}
                className="mt-3 text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
              >
                Ajouter le premier élève
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Élève</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Matricule</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Classe</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                    <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Parent</th>
                    <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {paged.map((s) => (
                    <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <SecureImage
                            src={s.photoUrl || s.photo}
                            alt={`${s.firstName} ${s.lastName}`}
                            className="w-9 h-9 rounded-full object-cover ring-2 ring-emerald-500/20 flex-shrink-0"
                            fallback={(
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                                {(s.firstName[0] + (s.lastName[0] || "")).toUpperCase()}
                              </div>
                            )}
                          />
                          <div>
                            <Link href={`/${slug}/students/${s.id}`} className="text-sm font-medium text-white hover:text-emerald-300 transition-colors">
                              {s.firstName} {s.lastName}
                            </Link>
                            <p className="text-xs text-gray-500">{s.gender === "M" || s.gender === "MALE" ? "Masculin" : s.gender === "F" || s.gender === "FEMALE" ? "Féminin" : "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-gray-300 font-mono">{s.matricule || "—"}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-gray-300">{s.classroom?.name || "—"}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm text-gray-300">{s.guardianName || s.motherName || s.fatherName || s.parentName || "—"}</p>
                        <p className="text-xs text-gray-500">{s.guardianPhone || s.motherPhone || s.fatherPhone || s.parentPhone || ""}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/${slug}/students/${s.id}`} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors" title="Voir fiche">
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link href={`/${slug}/students/${s.id}?edit=1`} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors" title="Modifier">
                            <Pencil className="w-4 h-4" />
                          </Link>
                          <Link href={`/${slug}/students/${s.id}`} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Supprimer depuis la fiche">
                            <Trash2 className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-white/[0.04]">
              {paged.map((s) => (
                <Link key={s.id} href={`/${slug}/students/${s.id}`} className="px-4 py-3.5 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                  <SecureImage
                    src={s.photoUrl || s.photo}
                    alt={`${s.firstName} ${s.lastName}`}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-500/20 flex-shrink-0"
                    fallback={(
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                        {(s.firstName[0] + (s.lastName[0] || "")).toUpperCase()}
                      </div>
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{s.firstName} {s.lastName}</p>
                    <p className="text-xs text-gray-500 truncate">{s.classroom?.name || "Pas de classe"} · {s.parentPhone || "—"}</p>
                  </div>
                  <StatusBadge status={s.status} />
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-white/[0.06]">
                <p className="text-xs text-gray-500">
                  {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, students.length)} sur {students.length}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-gray-400">{page} / {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* Add student modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Ajouter un élève">
        <div className="space-y-4">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Prénom" required>
              <input
                className={inputCls}
                placeholder="Jean"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </FormField>
            <FormField label="Nom" required>
              <input
                className={inputCls}
                placeholder="Kouassi"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Genre">
              <select
                className={selectCls}
                value={form.gender || ""}
                onChange={(e) => setForm({ ...form, gender: (e.target.value as "M" | "F") || undefined })}
              >
                <option value="">Sélectionner</option>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            </FormField>
            <FormField label="Date de naissance">
              <input
                type="date"
                className={inputCls}
                value={form.dateOfBirth || ""}
                onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
              />
            </FormField>
          </div>

          <FormField label="Photo d'identité" required>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/[0.04] px-3.5 py-3 text-sm text-gray-300 cursor-pointer">
              <span className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-500" />
                {photoFile ? photoFile.name : "Choisir une photo JPG/PNG"}
              </span>
              <span className="text-xs text-emerald-400">Obligatoire</span>
              <input hidden type="file" accept="image/jpeg,image/png" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
            </label>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Lieu de naissance">
              <input className={inputCls} value={form.birthPlace || ""} onChange={(e) => setForm({ ...form, birthPlace: e.target.value })} />
            </FormField>
            <FormField label="Nationalité">
              <input className={inputCls} value={form.nationality || ""} onChange={(e) => setForm({ ...form, nationality: e.target.value })} />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Téléphone élève">
              <input className={inputCls} value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </FormField>
            <FormField label="Email élève">
              <input className={inputCls} value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </FormField>
          </div>

          <FormField label="Classe">
            <select
              className={selectCls}
              value={form.classroomId || ""}
              onChange={(e) => setForm({ ...form, classroomId: e.target.value })}
            >
              <option value="">Sélectionner une classe</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </FormField>

          <div className="border-t border-white/[0.06] pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Facture de scolarité</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Montant scolarité">
                <input
                  type="number"
                  min="1"
                  className={inputCls}
                  placeholder="Ex: 150000"
                  value={form.tuitionAmount || ""}
                  onChange={(e) => setForm({ ...form, tuitionAmount: e.target.value ? Number(e.target.value) : undefined })}
                />
              </FormField>
              <FormField label="Échéance">
                <input
                  type="date"
                  className={inputCls}
                  value={form.tuitionDueDate || ""}
                  onChange={(e) => setForm({ ...form, tuitionDueDate: e.target.value })}
                />
              </FormField>
            </div>
            <FormField label="Libellé facture">
              <input
                className={inputCls}
                placeholder="Frais de scolarité annuelle, 1ère tranche..."
                value={form.tuitionTitle || ""}
                onChange={(e) => setForm({ ...form, tuitionTitle: e.target.value })}
              />
            </FormField>
            <p className="mt-2 text-xs text-gray-600">
              Si un montant est renseigné, une facture de scolarité sera créée automatiquement et liée à cet élève.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Cycle">
              <input className={inputCls} placeholder="Primaire, Collège..." value={form.cycle || ""} onChange={(e) => setForm({ ...form, cycle: e.target.value })} />
            </FormField>
            <FormField label="Filière / programme">
              <input className={inputCls} placeholder="Général, Coran..." value={form.program || ""} onChange={(e) => setForm({ ...form, program: e.target.value })} />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Statut inscription">
              <select className={selectCls} value={form.enrollmentKind || "NEW"} onChange={(e) => setForm({ ...form, enrollmentKind: e.target.value })}>
                <option value="NEW">Nouveau</option>
                <option value="RETURNING">Ancien</option>
              </select>
            </FormField>
            <FormField label="Régime">
              <select className={selectCls} value={form.boardingRegime || "DAY"} onChange={(e) => setForm({ ...form, boardingRegime: e.target.value })}>
                <option value="DAY">Externe</option>
                <option value="HALF_BOARDING">Demi-pension</option>
                <option value="BOARDING">Internat</option>
              </select>
            </FormField>
          </div>

          <div className="border-t border-white/[0.06] pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Parents / Tuteurs</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Nom père">
                  <input className={inputCls} value={form.fatherName || ""} onChange={(e) => setForm({ ...form, fatherName: e.target.value })} />
                </FormField>
                <FormField label="Téléphone père">
                  <input className={inputCls} value={form.fatherPhone || ""} onChange={(e) => setForm({ ...form, fatherPhone: e.target.value })} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Profession père">
                  <input className={inputCls} value={form.fatherProfession || ""} onChange={(e) => setForm({ ...form, fatherProfession: e.target.value })} />
                </FormField>
                <FormField label="CNI père">
                  <input className={inputCls} value={form.fatherIdNumber || ""} onChange={(e) => setForm({ ...form, fatherIdNumber: e.target.value })} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Nom mère">
                  <input className={inputCls} value={form.motherName || ""} onChange={(e) => setForm({ ...form, motherName: e.target.value })} />
                </FormField>
                <FormField label="Téléphone mère">
                  <input className={inputCls} value={form.motherPhone || ""} onChange={(e) => setForm({ ...form, motherPhone: e.target.value })} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Profession mère">
                  <input className={inputCls} value={form.motherProfession || ""} onChange={(e) => setForm({ ...form, motherProfession: e.target.value })} />
                </FormField>
                <FormField label="CNI mère">
                  <input className={inputCls} value={form.motherIdNumber || ""} onChange={(e) => setForm({ ...form, motherIdNumber: e.target.value })} />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Tuteur légal">
                  <input
                    className={inputCls}
                    placeholder="Si différent"
                    value={form.guardianName || form.parentName || ""}
                    onChange={(e) => setForm({ ...form, guardianName: e.target.value, parentName: e.target.value })}
                  />
                </FormField>
                <FormField label="Lien tuteur">
                  <input
                    className={inputCls}
                    placeholder="Père / Mère..."
                    value={form.guardianRelation || form.parentRelation || ""}
                    onChange={(e) => setForm({ ...form, guardianRelation: e.target.value, parentRelation: e.target.value })}
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Téléphone tuteur">
                  <input type="tel" className={inputCls} placeholder="+225 07..." value={form.guardianPhone || form.parentPhone || ""} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value, parentPhone: e.target.value })} />
                </FormField>
                <FormField label="Adresse parent/tuteur">
                  <input className={inputCls} value={form.guardianAddress || ""} onChange={(e) => setForm({ ...form, guardianAddress: e.target.value })} />
                </FormField>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Ville">
              <input
                className={inputCls}
                placeholder="Abidjan"
                value={form.city || ""}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </FormField>
            <FormField label="Adresse">
              <input
                className={inputCls}
                placeholder="Cocody..."
                value={form.address || ""}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </FormField>
          </div>

          <div className="border-t border-white/[0.06] pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Informations médicales</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Groupe sanguin">
                <input className={inputCls} placeholder="O+, A-, Inconnu..." value={form.bloodGroup || ""} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })} />
              </FormField>
              <FormField label="Contact urgence">
                <input className={inputCls} value={form.emergencyContactPhone || ""} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} />
              </FormField>
            </div>
          </div>

          <FormField label="Allergies / maladie / traitement">
            <textarea
              className={cn(inputCls, "resize-none h-20")}
              placeholder="Allergies, conditions particulières..."
              value={form.medicalNotes || form.allergies || ""}
              onChange={(e) => setForm({ ...form, medicalNotes: e.target.value, allergies: e.target.value })}
            />
          </FormField>

          <div className="border-t border-white/[0.06] pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Documents à fournir</p>
            <div className="space-y-2">
              {STUDENT_DOCUMENTS.map((doc) => (
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
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {formError}
              </motion.div>
            )}
            {formSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5"
              >
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                {formSuccess}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setModalOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm hover:bg-white/[0.04] hover:text-white transition-all"
            >
              Annuler
            </button>
            <button
              onClick={handleAdd}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all disabled:opacity-60"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Enregistrer"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
