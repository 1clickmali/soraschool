"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid,
  Plus,
  X,
  Users,
  BookOpen,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Pencil,
  Trash2,
} from "lucide-react";
import { schoolApi, type Classroom, type Level, type CreateClassInput } from "@/lib/school-api";
import { cn } from "@/lib/utils";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-md bg-soraCard border border-white/10 rounded-2xl shadow-2xl"
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

const CLASS_COLORS = [
  "from-emerald-600 to-emerald-800",
  "from-blue-600 to-blue-800",
  "from-purple-600 to-purple-800",
  "from-amber-600 to-amber-800",
  "from-red-600 to-red-800",
  "from-indigo-600 to-indigo-800",
];

export default function ClassesPage() {
  const params = useParams();
  void params;

  const [classes, setClasses] = useState<Classroom[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editClassId, setEditClassId] = useState<string | null>(null);
  const [deleteClassId, setDeleteClassId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [form, setForm] = useState<CreateClassInput>({
    name: "",
    levelId: "",
    capacity: undefined,
    description: "",
  });

  const [editForm, setEditForm] = useState({ name: "", capacity: "" });

  const loadClasses = useCallback(async () => {
    setLoading(true);
    const { data } = await schoolApi.classes();
    if (data?.classes) setClasses(data.classes);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadClasses();
    schoolApi.levels().then(({ data }) => {
      if (data?.levels) setLevels(data.levels);
    });
  }, [loadClasses]);

  const resetForm = () => {
    setForm({ name: "", levelId: "", capacity: undefined, description: "" });
    setFormError(null);
    setFormSuccess(null);
  };

  const handleAdd = async () => {
    if (!form.name.trim()) { setFormError("Le nom de la classe est requis"); return; }
    setFormError(null);
    setSaving(true);
    const { error } = await schoolApi.createClass(form);
    setSaving(false);
    if (error) { setFormError(error); return; }
    setFormSuccess("Classe créée !");
    setTimeout(() => { setModalOpen(false); resetForm(); loadClasses(); }, 900);
  };

  const openEditModal = (cls: Classroom) => {
    setEditClassId(cls.id);
    setEditForm({ name: cls.name, capacity: cls.capacity ? String(cls.capacity) : "" });
    setEditError(null);
    setEditSuccess(null);
    setEditModalOpen(true);
  };

  const handleEdit = async () => {
    if (!editClassId || !editForm.name.trim()) { setEditError("Le nom est requis"); return; }
    setEditError(null);
    setSaving(true);
    const { error } = await schoolApi.updateClass(editClassId, {
      name: editForm.name,
      capacity: editForm.capacity ? Number(editForm.capacity) : undefined,
    });
    setSaving(false);
    if (error) { setEditError(error); return; }
    setEditSuccess("Classe modifiée !");
    setTimeout(() => { setEditModalOpen(false); loadClasses(); }, 900);
  };

  const openDeleteConfirm = (cls: Classroom) => {
    setDeleteClassId(cls.id);
    setActionMessage(null);
    setDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteClassId) return;
    setSaving(true);
    const { error } = await schoolApi.deleteClass(deleteClassId);
    setSaving(false);
    setDeleteConfirmOpen(false);
    if (error) { setActionMessage(error); return; }
    setActionMessage("Classe supprimée.");
    loadClasses();
  };

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading text-white">Structure académique</h1>
          <p className="text-gray-400 text-sm mt-1">
            {loading ? "Chargement..." : `${classes.length} classe${classes.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => { resetForm(); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)]"
        >
          <Plus className="w-4 h-4" />
          Ajouter une classe
        </motion.button>
      </motion.div>

      {actionMessage && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="mb-4 flex items-center gap-2 text-sm bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-gray-300"
        >
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />{actionMessage}
        </motion.div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 animate-pulse">
              <div className="h-12 w-12 rounded-xl bg-white/10 mb-4" />
              <div className="h-4 bg-white/10 rounded w-24 mb-2" />
              <div className="h-3 bg-white/[0.07] rounded w-16" />
            </div>
          ))}
        </div>
      ) : classes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
          <LayoutGrid className="w-12 h-12 mb-3 opacity-20" />
          <p className="text-sm font-medium">Aucune classe créée</p>
          <button onClick={() => { resetForm(); setModalOpen(true); }} className="mt-3 text-xs text-emerald-500 hover:text-emerald-400 transition-colors">
            Créer la première classe
          </button>
        </div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls, idx) => (
            <motion.div key={cls.id} variants={item}>
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 hover:bg-white/[0.05] hover:border-white/10 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  <div className={cn("w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center", CLASS_COLORS[idx % CLASS_COLORS.length])}>
                    <LayoutGrid className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEditModal(cls)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
                      title="Modifier"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openDeleteConfirm(cls)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="text-base font-semibold text-white font-heading mb-1">{cls.name}</h3>
                {cls.gradeLevel && (
                  <p className="text-xs text-gray-500 mb-1">{cls.gradeLevel.name}</p>
                )}
                {!cls.gradeLevel && cls.level && (
                  <p className="text-xs text-gray-500 mb-1">{cls.level.name}</p>
                )}
                {cls.academicYear && (
                  <p className="text-xs text-gray-600 mb-3">{cls.academicYear.name}</p>
                )}

                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/[0.06]">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Users className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{cls._count?.students ?? cls.studentCount ?? 0} élèves</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                    <span>{cls._count?.assignments ?? cls.teacherCount ?? 0} enseignants</span>
                  </div>
                  {cls.capacity && (
                    <div className="ml-auto text-xs text-gray-600">
                      Cap. {cls.capacity}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Add class modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Ajouter une classe">
        <div className="space-y-4">
          <FormField label="Nom de la classe" required>
            <input className={inputCls} placeholder="6ème A, Terminale C..." value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FormField>
          {levels.length > 0 && (
            <FormField label="Niveau">
              <select className={selectCls} value={form.levelId || ""} onChange={(e) => setForm({ ...form, levelId: e.target.value })}>
                <option value="">Sélectionner un niveau</option>
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </FormField>
          )}
          <FormField label="Capacité (nombre de places)">
            <input type="number" className={inputCls} placeholder="40" value={form.capacity || ""}
              onChange={(e) => setForm({ ...form, capacity: e.target.value ? Number(e.target.value) : undefined })} />
          </FormField>
          <AnimatePresence>
            {formError && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{formError}
              </motion.div>
            )}
            {formSuccess && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />{formSuccess}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm hover:bg-white/[0.04] hover:text-white transition-all">Annuler</button>
            <button onClick={handleAdd} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all disabled:opacity-60">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Créer la classe"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit class modal */}
      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title="Modifier la classe">
        <div className="space-y-4">
          <FormField label="Nom de la classe" required>
            <input className={inputCls} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </FormField>
          <FormField label="Capacité (nombre de places)">
            <input type="number" className={inputCls} placeholder="40" value={editForm.capacity}
              onChange={(e) => setEditForm({ ...editForm, capacity: e.target.value })} />
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
      <Modal open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Supprimer la classe">
        <div className="space-y-4">
          <p className="text-sm text-gray-300">
            La classe sera <span className="text-red-400 font-semibold">définitivement supprimée</span>. Cette action est irréversible. Impossible si des élèves y sont inscrits.
          </p>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setDeleteConfirmOpen(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm hover:bg-white/[0.04] hover:text-white transition-all">Annuler</button>
            <button onClick={handleDelete} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-all disabled:opacity-60">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" /> Supprimer</>}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
