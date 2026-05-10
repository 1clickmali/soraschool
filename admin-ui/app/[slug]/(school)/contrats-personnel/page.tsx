"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, Download, FileSignature, Plus, RefreshCw } from "lucide-react";
import { downloadProtectedFile, schoolApi, type CreateStaffContractInput, type StaffContract, type StaffMember } from "@/lib/school-api";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

export default function ContratsPersonnelPage() {
  const [contracts, setContracts] = useState<StaffContract[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [form, setForm] = useState<CreateStaffContractInput>({
    staffId: "",
    title: "Contrat du personnel",
    salary: 0,
    startsAt: new Date().toISOString().split("T")[0],
    scheduleText: "Horaires selon planning validé par la Direction.",
    generalClauses: "Le personnel s'engage à respecter le règlement intérieur, les horaires, la confidentialité et les missions confiées par la Direction.",
    specificClauses: "",
    penaltyClauses: "Retard non justifié : 1 000 FCFA. Absence non justifiée : 2 500 FCFA, sauf justification acceptée par le Directeur.",
    obligations: "Ponctualité, suivi pédagogique/administratif, respect des élèves et reporting à la Direction.",
    status: "ACTIVE",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [contractsRes, staffRes] = await Promise.all([schoolApi.staffContracts(), schoolApi.staff()]);
    if (contractsRes.data?.contracts) setContracts(contractsRes.data.contracts);
    if (staffRes.data?.staff) setStaff(staffRes.data.staff);
    if (contractsRes.error) setMessage({ type: "err", text: contractsRes.error });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.staffId || !form.startsAt || form.generalClauses.length < 10) {
      setMessage({ type: "err", text: "Sélectionnez un personnel et renseignez les clauses obligatoires." });
      return;
    }
    setSaving(true);
    const payload = { ...form, salary: Number(form.salary || 0) };
    const { error } = await schoolApi.createStaffContract(payload);
    setSaving(false);
    setMessage(error ? { type: "err", text: error } : { type: "ok", text: "Contrat créé. L'ancien contrat actif est archivé si nécessaire." });
    if (!error) load();
  };

  const openPdf = async (contract: StaffContract) => {
    const error = await downloadProtectedFile(`/api/staff/contracts/${contract.id}/pdf`, `contrat-${contract.number}.pdf`, "open");
    if (error) setMessage({ type: "err", text: error });
  };

  return (
    <div className="min-h-screen bg-soraDark text-white">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-indigo-500/15 p-2.5"><FileSignature className="h-6 w-6 text-indigo-300" /></div>
            <div>
              <h1 className="font-heading text-2xl font-bold">Contrats du personnel</h1>
              <p className="text-sm text-gray-400">Clauses personnalisées, salaire, horaires, pénalités et PDF professionnel.</p>
            </div>
          </div>
          <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-200 transition hover:bg-white/10"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Actualiser</button>
        </div>

        {message && (
          <div className={cn("flex items-center gap-2 rounded-xl border p-3 text-sm", message.type === "ok" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-red-500/25 bg-red-500/10 text-red-300")}>
            {message.type === "ok" ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} {message.text}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <h2 className="mb-4 font-semibold">Créer un contrat</h2>
            <div className="space-y-3">
              <select value={form.staffId} onChange={(e) => {
                const member = staff.find((s) => s.id === e.target.value);
                setForm({ ...form, staffId: e.target.value, salary: member?.baseSalary ?? form.salary });
              }} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white [&>option]:bg-soraCard">
                <option value="">Sélectionner un personnel</option>
                {staff.map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName}</option>)}
              </select>
              <input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Titre du contrat" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none" />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none" />
                <input type="date" value={form.endsAt ?? ""} onChange={(e) => setForm({ ...form, endsAt: e.target.value || undefined })} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none" />
              </div>
              <input type="number" value={form.salary ?? 0} onChange={(e) => setForm({ ...form, salary: Number(e.target.value) })} placeholder="Salaire" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none" />
              <textarea value={form.scheduleText ?? ""} onChange={(e) => setForm({ ...form, scheduleText: e.target.value })} placeholder="Horaires" className="h-20 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none" />
              <textarea value={form.generalClauses} onChange={(e) => setForm({ ...form, generalClauses: e.target.value })} placeholder="Clauses générales" className="h-24 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none" />
              <textarea value={form.specificClauses ?? ""} onChange={(e) => setForm({ ...form, specificClauses: e.target.value })} placeholder="Clauses spécifiques" className="h-20 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none" />
              <textarea value={form.penaltyClauses ?? ""} onChange={(e) => setForm({ ...form, penaltyClauses: e.target.value })} placeholder="Règles de pénalité" className="h-20 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none" />
              <textarea value={form.obligations ?? ""} onChange={(e) => setForm({ ...form, obligations: e.target.value })} placeholder="Obligations" className="h-20 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none" />
              <button disabled={saving} onClick={create} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60">
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Créer le contrat
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
            <div className="grid grid-cols-[1.2fr_1fr_1fr_100px] gap-3 border-b border-white/[0.07] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <span>Contrat</span><span>Personnel</span><span>Salaire / période</span><span className="text-right">PDF</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-14 text-sm text-gray-400"><RefreshCw className="h-4 w-4 animate-spin" /> Chargement...</div>
            ) : contracts.length === 0 ? (
              <div className="py-14 text-center text-sm text-gray-500">Aucun contrat RH.</div>
            ) : contracts.map((contract) => (
              <div key={contract.id} className="grid grid-cols-[1.2fr_1fr_1fr_100px] items-center gap-3 border-b border-white/[0.05] px-5 py-4 text-sm last:border-b-0">
                <div><p className="font-semibold">{contract.title}</p><p className="text-xs text-gray-500">{contract.number} · {contract.status}</p></div>
                <span>{contract.staff ? `${contract.staff.firstName} ${contract.staff.lastName}` : contract.staffId}</span>
                <span>{formatCurrency(contract.salary)}<br /><span className="text-xs text-gray-500">{formatDate(contract.startsAt)} - {contract.endsAt ? formatDate(contract.endsAt) : "Indéterminée"}</span></span>
                <div className="text-right">
                  <button onClick={() => openPdf(contract)} className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-indigo-300 transition hover:bg-white/10">
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
