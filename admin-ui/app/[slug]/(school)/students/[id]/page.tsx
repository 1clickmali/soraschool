"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  CreditCard,
  Download,
  FileText,
  GraduationCap,
  HeartPulse,
  ImageIcon,
  Pencil,
  Printer,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import {
  downloadProtectedFile,
  schoolApi,
  type Classroom,
  type CreateStudentInput,
  type SchoolDocument,
  type Student,
} from "@/lib/school-api";
import { SecureImage } from "@/components/ui/secure-image";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

const DOCUMENT_TYPES = [
  { value: "BIRTH_CERTIFICATE", label: "Acte de naissance" },
  { value: "ID_CARD", label: "Pièce d'identité parent/tuteur" },
  { value: "REPORT_CARD", label: "Ancien bulletin" },
  { value: "MEDICAL_CERTIFICATE", label: "Certificat médical" },
  { value: "PHOTO", label: "Photo d'identité" },
  { value: "OTHER", label: "Autre document" },
];

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actif",
  INACTIVE: "Inactif",
  ENROLLED: "Inscrit",
  PENDING: "En attente",
  SUSPENDED: "Suspendu",
  GRADUATED: "Diplômé",
};

const inputCls = cn(
  "w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white",
  "placeholder:text-gray-600 focus:border-emerald-500/50 focus:bg-emerald-500/[0.03] outline-none transition-all"
);
const selectCls = cn(inputCls, "[&>option]:bg-soraCard");

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
              className="relative w-full max-w-3xl bg-soraCard border border-white/10 rounded-2xl shadow-2xl my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
                <h2 className="text-base font-semibold font-heading text-white">{title}</h2>
                <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 max-h-[78vh] overflow-y-auto">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

function Field({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
      <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">{label}</p>
      <div className="text-sm text-white">{children || <span className="text-gray-600">Non renseigné</span>}</div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function getInitials(student?: Student | null) {
  if (!student) return "EL";
  return `${student.firstName?.[0] || ""}${student.lastName?.[0] || ""}`.toUpperCase() || "EL";
}

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const id = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [documents, setDocuments] = useState<SchoolDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<CreateStudentInput> & { status?: Student["status"] }>({});
  const [docType, setDocType] = useState("OTHER");
  const [docFiles, setDocFiles] = useState<File[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [studentRes, docsRes, classRes] = await Promise.all([
      schoolApi.getStudent(id),
      schoolApi.documents({ ownerType: "STUDENT", ownerId: id }),
      schoolApi.classes(),
    ]);
    const nextStudent = studentRes.data?.student || null;
    setStudent(nextStudent);
    setDocuments(docsRes.data?.documents || []);
    setClasses(classRes.data?.classes || []);
    if (nextStudent) {
      setForm({
        firstName: nextStudent.firstName,
        lastName: nextStudent.lastName,
        gender: nextStudent.gender,
        birthDate: nextStudent.birthDate,
        birthPlace: nextStudent.birthPlace,
        nationality: nextStudent.nationality,
        phone: nextStudent.phone,
        email: nextStudent.email,
        classroomId: nextStudent.classroomId,
        address: nextStudent.address,
        cycle: nextStudent.cycle,
        program: nextStudent.program,
        enrollmentKind: nextStudent.enrollmentKind,
        boardingRegime: nextStudent.boardingRegime,
        bloodGroup: nextStudent.bloodGroup,
        allergies: nextStudent.allergies,
        knownIllness: nextStudent.knownIllness,
        currentTreatment: nextStudent.currentTreatment,
        emergencyContactName: nextStudent.emergencyContactName,
        emergencyContactPhone: nextStudent.emergencyContactPhone,
        fatherName: nextStudent.fatherName,
        fatherPhone: nextStudent.fatherPhone,
        fatherProfession: nextStudent.fatherProfession,
        fatherIdNumber: nextStudent.fatherIdNumber,
        motherName: nextStudent.motherName,
        motherPhone: nextStudent.motherPhone,
        motherProfession: nextStudent.motherProfession,
        motherIdNumber: nextStudent.motherIdNumber,
        guardianName: nextStudent.guardianName,
        guardianPhone: nextStudent.guardianPhone,
        guardianRelation: nextStudent.guardianRelation,
        guardianAddress: nextStudent.guardianAddress,
        status: nextStudent.status,
      });
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("edit") === "1") setEditOpen(true);
  }, [searchParams]);

  const fullName = student ? `${student.firstName} ${student.lastName}` : "Élève";
  const paidAmount = useMemo(() => (student?.invoices || []).reduce((sum, invoice) => sum + (invoice.paidAmount || 0), 0), [student]);
  const dueAmount = useMemo(() => (student?.invoices || []).reduce((sum, invoice) => sum + Math.max((invoice.totalAmount || invoice.amount || 0) - (invoice.paidAmount || 0), 0), 0), [student]);

  const pdf = async (kind: "enrollment-form" | "card" | "dossier", mode: "download" | "open" | "print") => {
    const names = {
      "enrollment-form": `fiche-inscription-${student?.matricule || id}.pdf`,
      card: `carte-eleve-${student?.matricule || id}.pdf`,
      dossier: `dossier-eleve-${student?.matricule || id}.pdf`,
    };
    const error = await downloadProtectedFile(`/api/students/${id}/${kind}`, names[kind], mode);
    if (error) setMessage(error);
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    const payload = Object.fromEntries(
      Object.entries(form).filter(([, value]) => value !== undefined)
    ) as Partial<CreateStudentInput> & { status?: Student["status"] };
    const { data, error } = await schoolApi.updateStudent(id, payload);
    setSaving(false);
    if (error) {
      setMessage(error);
      return;
    }
    setStudent(data?.student || null);
    setEditOpen(false);
    setMessage("Fiche élève mise à jour.");
    void load();
  };

  const uploadDocs = async () => {
    if (!docFiles.length) {
      setMessage("Choisissez au moins un fichier.");
      return;
    }
    setSaving(true);
    const { error } = await schoolApi.uploadDocuments("STUDENT", id, docType, docFiles);
    setSaving(false);
    if (error) {
      setMessage(error);
      return;
    }
    setDocFiles([]);
    setMessage("Document ajouté.");
    void load();
  };

  const removeDocument = async (documentId: string) => {
    if (!confirm("Supprimer ce document ?")) return;
    await schoolApi.deleteDocument(documentId);
    void load();
  };

  const deactivate = async () => {
    if (!confirm("Désactiver cet élève ? Il restera dans l'historique.")) return;
    await schoolApi.updateStudent(id, { status: "INACTIVE" });
    setMessage("Élève désactivé.");
    void load();
  };

  const removeStudent = async () => {
    if (!confirm("Supprimer définitivement cet élève et ses données liées ?")) return;
    const { error } = await schoolApi.deleteStudent(id);
    if (error) {
      setMessage(error);
      return;
    }
    router.push(`/${slug}/students`);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 rounded-2xl bg-white/[0.04] border border-white/[0.07] animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, index) => <div key={index} className="h-28 rounded-2xl bg-white/[0.04] border border-white/[0.07] animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-10 text-center">
        <GraduationCap className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-white font-semibold">Élève introuvable</p>
        <Link href={`/${slug}/students`} className="inline-flex mt-4 text-sm text-emerald-400 hover:text-emerald-300">Retour aux élèves</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/${slug}/students`} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" />
          Retour aux élèves
        </Link>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setEditOpen(true)} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white text-sm">
            <Pencil className="w-4 h-4" /> Modifier
          </button>
          <button onClick={deactivate} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-sm border border-amber-500/20">
            <ShieldAlert className="w-4 h-4" /> Désactiver
          </button>
          <button onClick={removeStudent} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 text-sm border border-red-500/20">
            <Trash2 className="w-4 h-4" /> Supprimer
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {message}
        </div>
      )}

      <section className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950 via-soraCard to-soraDark p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.22),transparent_35%)]" />
        <div className="relative flex flex-col lg:flex-row gap-6 lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <SecureImage
              src={student.photoUrl || student.photo}
              alt={fullName}
              className="w-24 h-24 rounded-3xl object-cover ring-4 ring-emerald-500/20 shadow-2xl"
              fallback={<div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-900 flex items-center justify-center text-2xl font-bold text-white ring-4 ring-emerald-500/20">{getInitials(student)}</div>}
            />
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">{STATUS_LABELS[student.status] || student.status}</span>
                <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-gray-300 border border-white/10">{student.classroom?.name || "Sans classe"}</span>
              </div>
              <h1 className="text-3xl font-bold font-heading text-white">{fullName}</h1>
              <p className="text-sm text-gray-400 mt-1">Matricule : <span className="font-mono text-emerald-300">{student.matricule}</span></p>
              <p className="text-sm text-gray-500 mt-1">{student.program || student.cycle || "Programme non renseigné"}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button onClick={() => pdf("enrollment-form", "download")} className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white text-soraDark text-sm font-semibold hover:bg-emerald-50">
              <Download className="w-4 h-4" /> Fiche PDF
            </button>
            <button onClick={() => pdf("card", "download")} className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500">
              <CreditCard className="w-4 h-4" /> Carte PDF
            </button>
            <button onClick={() => pdf("dossier", "print")} className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/[0.08] text-white text-sm font-semibold hover:bg-white/[0.12] border border-white/10">
              <Printer className="w-4 h-4" /> Imprimer
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-5">
          <section className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
            <div className="flex items-center gap-2 mb-4">
              <BadgeCheck className="w-5 h-5 text-emerald-400" />
              <h2 className="font-semibold text-white">Fiche d'inscription</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Nom">{student.lastName}</Field>
              <Field label="Prénom">{student.firstName}</Field>
              <Field label="Sexe">{student.gender === "MALE" ? "Masculin" : student.gender === "FEMALE" ? "Féminin" : "Non renseigné"}</Field>
              <Field label="Naissance">{student.birthDate ? formatDate(student.birthDate) : undefined}</Field>
              <Field label="Lieu de naissance">{student.birthPlace}</Field>
              <Field label="Nationalité">{student.nationality}</Field>
              <Field label="Classe">{student.classroom?.name}</Field>
              <Field label="Cycle">{student.cycle}</Field>
              <Field label="Filière / programme">{student.program}</Field>
              <Field label="Régime">{student.boardingRegime}</Field>
              <Field label="Téléphone">{student.phone}</Field>
              <Field label="Email">{student.email}</Field>
              <Field label="Adresse">{student.address}</Field>
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-emerald-400" />
              <h2 className="font-semibold text-white">Parents / tuteurs</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Père">{student.fatherName}<br /><span className="text-gray-500">{student.fatherPhone}</span></Field>
              <Field label="Mère">{student.motherName}<br /><span className="text-gray-500">{student.motherPhone}</span></Field>
              <Field label="Tuteur légal">{student.guardianName}<br /><span className="text-gray-500">{student.guardianPhone}</span></Field>
              <Field label="Adresse tuteur">{student.guardianAddress}</Field>
            </div>
            {!!student.parents?.length && (
              <div className="mt-4 divide-y divide-white/[0.06] rounded-xl border border-white/[0.06] overflow-hidden">
                {student.parents.map((link) => (
                  <div key={`${link.parent.id}-${link.relationship}`} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-white">{link.parent.firstName} {link.parent.lastName}</p>
                      <p className="text-xs text-gray-500">{link.relationship} · {link.parent.phone}</p>
                    </div>
                    <span className="text-xs text-emerald-300">{link.isPrimary ? "Contact principal" : "Contact"}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
            <div className="flex items-center gap-2 mb-4">
              <HeartPulse className="w-5 h-5 text-emerald-400" />
              <h2 className="font-semibold text-white">Santé</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Groupe sanguin">{student.bloodGroup}</Field>
              <Field label="Allergies">{student.allergies}</Field>
              <Field label="Maladie connue">{student.knownIllness}</Field>
              <Field label="Traitement">{student.currentTreatment}</Field>
              <Field label="Contact urgence">{student.emergencyContactName}<br /><span className="text-gray-500">{student.emergencyContactPhone}</span></Field>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
            <h2 className="font-semibold text-white mb-4">Actions PDF</h2>
            <div className="space-y-2">
              <button onClick={() => pdf("enrollment-form", "open")} className="w-full inline-flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-sm text-white">
                Ouvrir fiche d'inscription <FileText className="w-4 h-4" />
              </button>
              <button onClick={() => pdf("card", "open")} className="w-full inline-flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-sm text-white">
                Ouvrir carte scolaire <CreditCard className="w-4 h-4" />
              </button>
              <button onClick={() => pdf("dossier", "download")} className="w-full inline-flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-sm text-white">
                Télécharger dossier complet <Download className="w-4 h-4" />
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
            <h2 className="font-semibold text-white mb-4">Finances rapides</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Payé">{formatCurrency(paidAmount)}</Field>
              <Field label="Reste">{formatCurrency(dueAmount)}</Field>
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
            <h2 className="font-semibold text-white mb-4">Documents</h2>
            <div className="space-y-3 mb-4">
              <select value={docType} onChange={(e) => setDocType(e.target.value)} className={selectCls}>
                {DOCUMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
              <label className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/[0.04] px-3.5 py-3 text-sm text-gray-300 cursor-pointer">
                <span className="flex items-center gap-2"><Upload className="w-4 h-4 text-emerald-500" />{docFiles.length ? `${docFiles.length} fichier(s)` : "Ajouter PDF/JPG/PNG"}</span>
                <input hidden multiple type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setDocFiles(Array.from(e.target.files || []))} />
              </label>
              <button onClick={uploadDocs} disabled={saving} className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-60">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Téléverser
              </button>
            </div>

            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{doc.title}</p>
                      <p className="text-xs text-gray-500">{doc.type} · {formatDate(doc.createdAt)}</p>
                    </div>
                    <ImageIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => void downloadProtectedFile(doc.fileUrl, doc.title, "open")} className="text-xs px-2 py-1 rounded-lg bg-white/[0.06] text-gray-300 hover:text-white">Voir</button>
                    <button onClick={() => void downloadProtectedFile(doc.fileUrl, doc.title, "download")} className="text-xs px-2 py-1 rounded-lg bg-white/[0.06] text-gray-300 hover:text-white">Télécharger</button>
                    <button onClick={() => removeDocument(doc.id)} className="text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-300 hover:bg-red-500/20">Supprimer</button>
                  </div>
                </div>
              ))}
              {!documents.length && <p className="text-sm text-gray-500 text-center py-4">Aucun document ajouté.</p>}
            </div>
          </section>
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`Modifier ${fullName}`}>
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FormField label="Prénom">
              <input className={inputCls} value={form.firstName || ""} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </FormField>
            <FormField label="Nom">
              <input className={inputCls} value={form.lastName || ""} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </FormField>
            <FormField label="Statut">
              <select className={selectCls} value={form.status || "ACTIVE"} onChange={(e) => setForm({ ...form, status: e.target.value as Student["status"] })}>
                <option value="ACTIVE">Actif</option>
                <option value="INACTIVE">Inactif</option>
                <option value="SUSPENDED">Suspendu</option>
                <option value="GRADUATED">Diplômé</option>
              </select>
            </FormField>
            <FormField label="Classe">
              <select className={selectCls} value={form.classroomId || ""} onChange={(e) => setForm({ ...form, classroomId: e.target.value })}>
                <option value="">Sans classe</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </FormField>
            <FormField label="Sexe">
              <select className={selectCls} value={form.gender || ""} onChange={(e) => setForm({ ...form, gender: e.target.value as CreateStudentInput["gender"] })}>
                <option value="">Non renseigné</option>
                <option value="MALE">Masculin</option>
                <option value="FEMALE">Féminin</option>
              </select>
            </FormField>
            <FormField label="Date de naissance">
              <input type="date" className={inputCls} value={form.birthDate ? String(form.birthDate).slice(0, 10) : ""} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
            </FormField>
            <FormField label="Lieu de naissance">
              <input className={inputCls} value={form.birthPlace || ""} onChange={(e) => setForm({ ...form, birthPlace: e.target.value })} />
            </FormField>
            <FormField label="Nationalité">
              <input className={inputCls} value={form.nationality || ""} onChange={(e) => setForm({ ...form, nationality: e.target.value })} />
            </FormField>
            <FormField label="Téléphone">
              <input className={inputCls} value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </FormField>
            <FormField label="Email">
              <input className={inputCls} value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </FormField>
            <FormField label="Cycle">
              <input className={inputCls} value={form.cycle || ""} onChange={(e) => setForm({ ...form, cycle: e.target.value })} />
            </FormField>
            <FormField label="Filière / programme">
              <input className={inputCls} value={form.program || ""} onChange={(e) => setForm({ ...form, program: e.target.value })} />
            </FormField>
          </div>

          <FormField label="Adresse">
            <input className={inputCls} value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Nom père">
              <input className={inputCls} value={form.fatherName || ""} onChange={(e) => setForm({ ...form, fatherName: e.target.value })} />
            </FormField>
            <FormField label="Téléphone père">
              <input className={inputCls} value={form.fatherPhone || ""} onChange={(e) => setForm({ ...form, fatherPhone: e.target.value })} />
            </FormField>
            <FormField label="Nom mère">
              <input className={inputCls} value={form.motherName || ""} onChange={(e) => setForm({ ...form, motherName: e.target.value })} />
            </FormField>
            <FormField label="Téléphone mère">
              <input className={inputCls} value={form.motherPhone || ""} onChange={(e) => setForm({ ...form, motherPhone: e.target.value })} />
            </FormField>
            <FormField label="Tuteur">
              <input className={inputCls} value={form.guardianName || ""} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} />
            </FormField>
            <FormField label="Téléphone tuteur">
              <input className={inputCls} value={form.guardianPhone || ""} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FormField label="Groupe sanguin">
              <input className={inputCls} value={form.bloodGroup || ""} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })} />
            </FormField>
            <FormField label="Allergies">
              <input className={inputCls} value={form.allergies || ""} onChange={(e) => setForm({ ...form, allergies: e.target.value })} />
            </FormField>
            <FormField label="Traitement">
              <input className={inputCls} value={form.currentTreatment || ""} onChange={(e) => setForm({ ...form, currentTreatment: e.target.value })} />
            </FormField>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setEditOpen(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm hover:bg-white/[0.04] hover:text-white transition-all">Annuler</button>
            <button onClick={save} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all disabled:opacity-60">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Enregistrer"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
