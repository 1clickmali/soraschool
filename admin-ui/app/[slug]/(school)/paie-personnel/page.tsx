"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Banknote, CheckCircle, MinusCircle, PlusCircle, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { schoolApi, type StaffSalaryAdjustmentKind, type StaffSalarySnapshot } from "@/lib/school-api";
import { cn, formatCurrency } from "@/lib/utils";

type StaffSalarySnapshotCompat = StaffSalarySnapshot & {
  absentCount?: number;
  netAmount?: number;
};

const safeNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getNetSalary = (item: StaffSalarySnapshotCompat) => safeNumber(item.netSalary ?? item.netAmount);
const getAbsenceCount = (item: StaffSalarySnapshotCompat) => safeNumber(item.absenceCount ?? item.absentCount);

export default function PaiePersonnelPage() {
  const now = new Date();
  const [payroll, setPayroll] = useState<StaffSalarySnapshotCompat[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [form, setForm] = useState({
    kind: "BONUS" as StaffSalaryAdjustmentKind,
    title: "",
    amount: 0,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await schoolApi.staffPayroll();
    if (data?.payroll) setPayroll(data.payroll);
    if (error) setMessage({ type: "err", text: error });
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    schoolApi.staffPayroll().then(({ data, error }) => {
      if (!active) return;
      if (data?.payroll) setPayroll(data.payroll);
      if (error) setMessage({ type: "err", text: error });
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const totals = useMemo(() => ({
    gross: payroll.reduce((sum, p) => sum + safeNumber(p.baseSalary) + safeNumber(p.bonuses), 0),
    penalties: payroll.reduce((sum, p) => sum + safeNumber(p.penalties) + safeNumber(p.deductions), 0),
    net: payroll.reduce((sum, p) => sum + getNetSalary(p), 0),
    late: payroll.reduce((sum, p) => sum + safeNumber(p.lateCount), 0),
    absent: payroll.reduce((sum, p) => sum + getAbsenceCount(p), 0),
  }), [payroll]);

  const addAdjustment = async () => {
    if (!selectedStaffId || !form.title.trim() || form.amount <= 0) {
      setMessage({ type: "err", text: "Sélectionnez un personnel, un motif et un montant." });
      return;
    }
    setSaving(true);
    const { error } = await schoolApi.createStaffSalaryAdjustment({ staffId: selectedStaffId, ...form, amount: Number(form.amount), month: Number(form.month), year: Number(form.year) });
    setSaving(false);
    setMessage(error ? { type: "err", text: error } : { type: "ok", text: "Ajustement enregistré. Salaire net recalculé." });
    if (!error) {
      setForm({ ...form, title: "", amount: 0 });
      load();
    }
  };

  const chartData = payroll.map((item) => ({
    name: `${item.staff.firstName?.charAt(0) || item.staff.lastName?.charAt(0) || "?"}. ${item.staff.lastName || item.staff.firstName || "Personnel"}`.slice(0, 18),
    brut: safeNumber(item.baseSalary) + safeNumber(item.bonuses),
    net: getNetSalary(item),
    penalites: safeNumber(item.penalties) + safeNumber(item.deductions),
  }));

  return (
    <div className="min-h-screen bg-soraDark text-white">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-500/15 p-2.5"><Banknote className="h-6 w-6 text-emerald-300" /></div>
            <div>
              <h1 className="font-heading text-2xl font-bold">Paie du personnel</h1>
              <p className="text-sm text-gray-400">Salaire en temps réel : salaire de base + primes - pénalités - retenues.</p>
            </div>
          </div>
          <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-gray-200 transition hover:bg-white/10"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Actualiser</button>
        </div>

        {message && (
          <div className={cn("flex items-center gap-2 rounded-xl border p-3 text-sm", message.type === "ok" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-red-500/25 bg-red-500/10 text-red-300")}>
            {message.type === "ok" ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} {message.text}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-5">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"><p className="text-xs text-gray-500">Masse brute</p><p className="mt-2 text-2xl font-bold">{formatCurrency(totals.gross)}</p></div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"><p className="text-xs text-gray-500">Retenues + pénalités</p><p className="mt-2 text-2xl font-bold text-red-300">{formatCurrency(totals.penalties)}</p></div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"><p className="text-xs text-gray-500">Masse nette estimée</p><p className="mt-2 text-2xl font-bold text-emerald-300">{formatCurrency(totals.net)}</p></div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"><p className="text-xs text-gray-500">Retards</p><p className="mt-2 text-2xl font-bold text-amber-300">{totals.late}</p></div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"><p className="text-xs text-gray-500">Absences</p><p className="mt-2 text-2xl font-bold text-red-300">{totals.absent}</p></div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <h2 className="mb-4 flex items-center gap-2 font-semibold"><TrendingUp className="h-4 w-4 text-emerald-300" /> Brut vs net par personnel</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip contentStyle={{ background: "#101827", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12 }} formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="brut" fill="#38bdf8" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="net" fill="#34d399" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="penalites" fill="#f87171" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <h2 className="mb-4 font-semibold">Prime / retenue Directeur</h2>
            <div className="space-y-3">
              <select value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white [&>option]:bg-soraCard">
                <option value="">Sélectionner un personnel</option>
                {payroll.map((item) => <option key={item.staff.id} value={item.staff.id}>{item.staff.firstName} {item.staff.lastName}</option>)}
              </select>
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as StaffSalaryAdjustmentKind })} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white [&>option]:bg-soraCard">
                <option value="BONUS">Prime</option>
                <option value="DEDUCTION">Retenue</option>
              </select>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Motif" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none" />
              <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} placeholder="Montant" className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none" />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={form.month} onChange={(e) => setForm({ ...form, month: Number(e.target.value) })} min={1} max={12} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none" />
                <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none" />
              </div>
              <button disabled={saving} onClick={addAdjustment} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60">
                {form.kind === "BONUS" ? <PlusCircle className="h-4 w-4" /> : <MinusCircle className="h-4 w-4" />} {saving ? "Enregistrement..." : "Enregistrer l'ajustement"}
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
          <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr_1fr] gap-3 border-b border-white/[0.07] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <span>Personnel</span><span>Base</span><span>Pénalités</span><span>Justifications</span><span>Net estimé</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-14 text-sm text-gray-400"><RefreshCw className="h-4 w-4 animate-spin" /> Chargement...</div>
          ) : payroll.length === 0 ? (
            <div className="py-14 text-center text-sm text-gray-500">Aucune donnée de paie.</div>
          ) : payroll.map((item) => (
            <div key={item.staff.id} className="grid grid-cols-[1.3fr_1fr_1fr_1fr_1fr] items-center gap-3 border-b border-white/[0.05] px-5 py-4 text-sm last:border-b-0">
              <div><p className="font-semibold">{item.staff.firstName} {item.staff.lastName}</p><p className="text-xs text-gray-500">{item.staff.matricule}</p></div>
              <span>{formatCurrency(safeNumber(item.baseSalary))}</span>
              <span className="inline-flex items-center gap-1 text-red-300"><TrendingDown className="h-3.5 w-3.5" /> {formatCurrency(safeNumber(item.penalties) + safeNumber(item.deductions))}</span>
              <span className="text-xs text-gray-400">{safeNumber(item.pendingJustifications)} attente · {safeNumber(item.acceptedJustifications)} OK · {safeNumber(item.refusedJustifications)} refusée(s)</span>
              <span className="font-bold text-emerald-300">{formatCurrency(getNetSalary(item))}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
