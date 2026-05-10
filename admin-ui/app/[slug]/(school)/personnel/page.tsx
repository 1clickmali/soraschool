"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, Copy, Plus, QrCode, RefreshCw, Search, ShieldCheck, UserCog, X } from "lucide-react";
import { schoolApi, type CreateStaffInput, type StaffMember, type StaffPosition } from "@/lib/school-api";
import { cn, formatCurrency } from "@/lib/utils";

const POSITIONS: Array<{ value: StaffPosition; label: string }> = [
  { value: "TEACHER", label: "Enseignant" },
  { value: "SECRETARIAT", label: "Secrétaire" },
  { value: "ACCOUNTANT", label: "Comptable" },
  { value: "SUPERVISOR", label: "Surveillant" },
  { value: "ASSISTANT_DIRECTOR", label: "Directeur adjoint" },
  { value: "CENSOR", label: "Censeur" },
  { value: "EDUCATION_ADVISOR", label: "Conseiller d'éducation" },
  { value: "LIBRARIAN", label: "Bibliothécaire" },
  { value: "CASHIER", label: "Caissier" },
  { value: "ADMIN_AGENT", label: "Agent administratif" },
  { value: "GUARD", label: "Gardien" },
  { value: "DRIVER", label: "Chauffeur" },
  { value: "CANTEEN", label: "Personnel cantine" },
  { value: "CLEANING", label: "Personnel nettoyage" },
  { value: "STOCK_MANAGER", label: "Stock & fournitures" },
  { value: "OTHER", label: "Autre rôle personnalisé" },
];

const inputCls = "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-emerald-400/60";
const selectCls = cn(inputCls, "[&>option]:bg-soraCard");

function staffLabel(staff: StaffMember) {
  if (staff.customPosition) return staff.customPosition;
  return POSITIONS.find((p) => p.value === staff.position)?.label ?? staff.position;
}

function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              className="w-full max-w-2xl rounded-2xl border border-white/10 bg-soraCard shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
                <h2 className="font-heading text-base font-bold text-white">{title}</h2>
                <button onClick={onClose} className="rounded-lg p-1.5 text-gray-500 transition hover:bg-white/10 hover:text-white">
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

export default function PersonnelPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [qrModal, setQrModal] = useState<{ staff: StaffMember; payload: string; image?: string } | null>(null);
  const [form, setForm] = useState<CreateStaffInput>({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    position: "TEACHER",
    customPosition: "",
    baseSalary: 0,
    hireDate: "",
    contractType: "CDI",
    createAccess: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await schoolApi.staff();
    if (data?.staff) setStaff(data.staff);
    if (error) setMessage({ type: "err", text: error });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return staff.filter((member) => !q || `${member.firstName} ${member.lastName} ${member.phone ?? ""} ${staffLabel(member)} ${member.matricule}`.toLowerCase().includes(q));
  }, [search, staff]);

  const resetForm = () => {
    setForm({ firstName: "", lastName: "", phone: "", email: "", position: "TEACHER", customPosition: "", baseSalary: 0, hireDate: "", contractType: "CDI", createAccess: true });
  };

  const createStaff = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setMessage({ type: "err", text: "Le prénom et le nom sont obligatoires." });
      return;
    }
    setSaving(true);
    setMessage(null);
    const payload = {
      ...form,
      baseSalary: Number(form.baseSalary || 0),
      hireDate: form.hireDate || undefined,
      customPosition: form.position === "OTHER" ? form.customPosition : undefined,
    };
    const { data, error } = await schoolApi.createStaff(payload);
    setSaving(false);
    if (error) {
      setMessage({ type: "err", text: error });
      return;
    }
    if (data) {
      setMessage({ type: "ok", text: "Personnel créé avec QR code sécurisé." });
      setQrModal({ staff: data.staff, payload: data.qrPayload, image: data.qrDataUrl });
      setModalOpen(false);
      resetForm();
      load();
    }
  };

  const showQr = async (member: StaffMember, regenerate = false) => {
    setMessage(null);
    const { data, error } = regenerate ? await schoolApi.regenerateStaffQr(member.id) : await schoolApi.staffQr(member.id);
    if (error) {
      setMessage({ type: "err", text: error });
      return;
    }
    if (data) {
      setQrModal({ staff: data.staff, payload: data.qrPayload, image: data.qrDataUrl });
      if (regenerate) {
        setMessage({ type: "ok", text: "QR code régénéré. L'ancien QR est automatiquement invalidé." });
        load();
      }
    }
  };

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setMessage({ type: "ok", text: "Copié dans le presse-papiers." });
  };

  return (
    <div className="min-h-screen bg-soraDark text-white">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-500/15 p-2.5">
                <UserCog className="h-6 w-6 text-emerald-300" />
              </div>
              <div>
                <h1 className="font-heading text-2xl font-bold">Personnel</h1>
                <p className="text-sm text-gray-400">Ajout, rôle, QR code, contrat et statut du personnel de l'école.</p>
              </div>
            </div>
          </div>
          <button onClick={() => setModalOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500">
            <Plus className="h-4 w-4" /> Ajouter un personnel
          </button>
        </div>

        {message && (
          <div className={cn("flex items-center gap-2 rounded-xl border p-3 text-sm", message.type === "ok" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-red-500/25 bg-red-500/10 text-red-300")}>
            {message.type === "ok" ? <CheckCircle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
            {message.text}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
            <p className="text-xs text-gray-500">Personnel total</p>
            <p className="mt-1 text-2xl font-bold">{staff.length}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
            <p className="text-xs text-gray-500">Enseignants</p>
            <p className="mt-1 text-2xl font-bold">{staff.filter((s) => s.position === "TEACHER").length}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
            <p className="text-xs text-gray-500">QR actifs</p>
            <p className="mt-1 text-2xl font-bold text-emerald-300">{staff.filter((s) => s.qrActive).length}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
            <p className="text-xs text-gray-500">Masse salariale base</p>
            <p className="mt-1 text-2xl font-bold">{formatCurrency(staff.reduce((sum, s) => sum + (s.baseSalary || 0), 0))}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
          <Search className="h-4 w-4 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher nom, rôle, matricule, téléphone..." className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-600" />
          <button onClick={load} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-white">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_160px] gap-3 border-b border-white/[0.07] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <span>Personnel</span><span>Poste</span><span>Salaire</span><span>Accès / QR</span><span className="text-right">Actions</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-14 text-sm text-gray-400"><RefreshCw className="h-4 w-4 animate-spin" /> Chargement...</div>
          ) : filtered.length === 0 ? (
            <div className="py-14 text-center text-sm text-gray-500">Aucun personnel trouvé.</div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {filtered.map((member) => (
                <div key={member.id} className="grid grid-cols-[1.4fr_1fr_1fr_1fr_160px] items-center gap-3 px-5 py-4 text-sm transition hover:bg-white/[0.025]">
                  <div>
                    <p className="font-semibold text-white">{member.firstName} {member.lastName}</p>
                    <p className="text-xs text-gray-500">{member.matricule} · {member.phone || "Téléphone non renseigné"}</p>
                  </div>
                  <span className="text-gray-300">{staffLabel(member)}</span>
                  <span className="font-medium text-emerald-300">{formatCurrency(member.baseSalary || 0)}</span>
                  <div className="space-y-1">
                    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs", member.status === "ACTIVE" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-amber-500/25 bg-amber-500/10 text-amber-300")}>{member.status}</span>
                    <p className="text-xs text-gray-500">QR v{member.qrTokenVersion} · {member.qrActive ? "actif" : "inactif"}</p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => showQr(member)} className="rounded-lg border border-white/10 bg-white/[0.04] p-2 text-gray-300 transition hover:bg-white/10" title="Afficher QR">
                      <QrCode className="h-4 w-4" />
                    </button>
                    <button onClick={() => showQr(member, true)} className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-amber-300 transition hover:bg-amber-500/20" title="Régénérer QR">
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Ajouter un personnel">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5 text-xs text-gray-400">Prénom<input className={inputCls} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></label>
          <label className="space-y-1.5 text-xs text-gray-400">Nom<input className={inputCls} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></label>
          <label className="space-y-1.5 text-xs text-gray-400">Téléphone<input className={inputCls} value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label className="space-y-1.5 text-xs text-gray-400">Email<input className={inputCls} value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label className="space-y-1.5 text-xs text-gray-400">Poste<select className={selectCls} value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value as StaffPosition })}>{POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
          <label className="space-y-1.5 text-xs text-gray-400">Salaire base<input type="number" className={inputCls} value={form.baseSalary ?? 0} onChange={(e) => setForm({ ...form, baseSalary: Number(e.target.value) })} /></label>
          {form.position === "OTHER" && <label className="space-y-1.5 text-xs text-gray-400 md:col-span-2">Rôle personnalisé<input className={inputCls} value={form.customPosition ?? ""} onChange={(e) => setForm({ ...form, customPosition: e.target.value })} /></label>}
          <label className="space-y-1.5 text-xs text-gray-400">Date recrutement<input type="date" className={inputCls} value={form.hireDate ?? ""} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} /></label>
          <label className="space-y-1.5 text-xs text-gray-400">Contrat<select className={selectCls} value={form.contractType ?? "CDI"} onChange={(e) => setForm({ ...form, contractType: e.target.value as CreateStaffInput["contractType"] })}><option value="CDI">CDI</option><option value="CDD">CDD</option><option value="VACATAIRE">Vacataire</option><option value="STAGE">Stage</option></select></label>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-gray-300 md:col-span-2">
            <input type="checkbox" checked={form.createAccess ?? true} onChange={(e) => setForm({ ...form, createAccess: e.target.checked })} />
            Créer aussi un accès utilisateur si le rôle système existe.
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={() => setModalOpen(false)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-300 transition hover:bg-white/10">Annuler</button>
          <button disabled={saving} onClick={createStaff} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Créer
          </button>
        </div>
      </Modal>

      <Modal open={!!qrModal} onClose={() => setQrModal(null)} title="QR code de pointage">
        {qrModal && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl border border-white/10 bg-white p-3">
                {qrModal.image ? <Image src={qrModal.image} alt="QR personnel" width={176} height={176} unoptimized className="h-44 w-44" /> : <QrCode className="h-44 w-44 text-gray-900" />}
              </div>
              <div>
                <p className="text-lg font-bold text-white">{qrModal.staff.firstName} {qrModal.staff.lastName}</p>
                <p className="text-sm text-gray-400">{staffLabel(qrModal.staff)} · {qrModal.staff.matricule}</p>
                <p className="mt-2 text-xs text-emerald-300">QR unique à cette école. Régénérer invalide l'ancien code.</p>
              </div>
            </div>
            <textarea readOnly value={qrModal.payload} className="h-24 w-full rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-xs text-gray-300 outline-none" />
            <button onClick={() => copy(qrModal.payload)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white transition hover:bg-white/10">
              <Copy className="h-4 w-4" /> Copier le contenu QR
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
