"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Banknote, CheckCircle, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { schoolApi, type StaffSalarySnapshot } from "@/lib/school-api";
import { cn, formatCurrency } from "@/lib/utils";

type StaffSalarySnapshotCompat = StaffSalarySnapshot & {
  absentCount?: number;
  netAmount?: number;
};

const safeNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getNetSalary = (salary: StaffSalarySnapshotCompat) => safeNumber(salary.netSalary ?? salary.netAmount);
const getAbsenceCount = (salary: StaffSalarySnapshotCompat) => safeNumber(salary.absenceCount ?? salary.absentCount);

export default function TeacherSalairePage() {
  const [salary, setSalary] = useState<StaffSalarySnapshotCompat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await schoolApi.staffMeSalary();
    setSalary(data ?? null);
    setError(error);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const chart = salary ? [
    { name: "Base", montant: safeNumber(salary.baseSalary) },
    { name: "Primes", montant: safeNumber(salary.bonuses) },
    { name: "Pénalités", montant: safeNumber(salary.penalties) },
    { name: "Retenues", montant: safeNumber(salary.deductions) },
    { name: "Net", montant: getNetSalary(salary) },
  ] : [];

  return (
    <div className="min-h-screen bg-soraDark pb-24 text-white">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-emerald-500/15 p-2.5"><Banknote className="h-6 w-6 text-emerald-300" /></div>
          <div>
            <h1 className="font-heading text-2xl font-bold">Mon salaire</h1>
            <p className="text-sm text-gray-400">Salaire net estimé en temps réel selon les retards, absences, justifications et ajustements validés.</p>
          </div>
        </div>

        {error && <div className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-300"><AlertTriangle className="h-4 w-4" /> {error}</div>}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] py-16 text-sm text-gray-400"><RefreshCw className="h-4 w-4 animate-spin" /> Chargement...</div>
        ) : salary && (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"><p className="text-xs text-gray-500">Salaire base</p><p className="mt-2 text-2xl font-bold">{formatCurrency(safeNumber(salary.baseSalary))}</p></div>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"><p className="text-xs text-gray-500">Primes</p><p className="mt-2 text-2xl font-bold text-blue-300">{formatCurrency(safeNumber(salary.bonuses))}</p></div>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"><p className="text-xs text-gray-500">Pénalités/Retenues</p><p className="mt-2 text-2xl font-bold text-red-300">{formatCurrency(safeNumber(salary.penalties) + safeNumber(salary.deductions))}</p></div>
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4"><p className="text-xs text-emerald-200/70">Net estimé</p><p className="mt-2 text-2xl font-bold text-emerald-300">{formatCurrency(getNetSalary(salary))}</p></div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                <h2 className="mb-4 flex items-center gap-2 font-semibold"><TrendingUp className="h-4 w-4 text-emerald-300" /> Composition du salaire</h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip contentStyle={{ background: "#101827", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12 }} formatter={(value) => formatCurrency(Number(value))} />
                      <Bar dataKey="montant" fill="#34d399" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                <h2 className="mb-4 font-semibold">Assiduité du mois</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3"><span>Retards non justifiés</span><strong className="text-amber-300">{safeNumber(salary.lateCount)}</strong></div>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3"><span>Absences non justifiées</span><strong className="text-red-300">{getAbsenceCount(salary)}</strong></div>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3"><span>Justifications en attente</span><strong className="text-blue-300">{safeNumber(salary.pendingJustifications)}</strong></div>
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3"><span>Acceptées / refusées</span><strong>{safeNumber(salary.acceptedJustifications)} / {safeNumber(salary.refusedJustifications)}</strong></div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
              <h2 className="mb-4 flex items-center gap-2 font-semibold"><TrendingDown className="h-4 w-4 text-red-300" /> Pénalités appliquées</h2>
              {salary.penaltyItems.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle className="h-4 w-4" /> Aucune pénalité appliquée ce mois.</div>
              ) : (
                <div className="space-y-2">
                  {salary.penaltyItems.map((penalty) => (
                    <div key={penalty.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
                      <span>{penalty.reason}</span>
                      <strong className={cn(penalty.status === "APPLIED" ? "text-red-300" : "text-gray-400")}>{formatCurrency(penalty.amount)} · {penalty.status}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
