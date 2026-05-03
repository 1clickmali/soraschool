"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Building2, Download, DollarSign, RefreshCw, ShieldAlert, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { superAdminApi, type DashboardData } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

const tooltipStyle = {
  backgroundColor: "#111827",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "12px",
  color: "#F9FAFB",
  fontSize: "13px",
};

const PERIODS = [
  { label: "3 mois", value: 3 },
  { label: "6 mois", value: 6 },
  { label: "12 mois", value: 12 },
];

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actives",
  TRIAL: "Essai",
  SUSPENDED: "Suspendues",
  EXPIRED: "Expirées",
};

const EMPTY_DASHBOARD: DashboardData = {
  totalInstitutions: 0,
  activeInstitutions: 0,
  suspendedInstitutions: 0,
  expiredSubscriptions: 0,
  totalStudents: 0,
  totalTeachers: 0,
  monthlyRevenue: 0,
  annualRevenue: 0,
  pendingSaaSPayments: 0,
  recentInstitutions: [],
  institutionsByStatus: [],
  monthlyRevenueSeries: [],
};

export default function AnalyticsPage() {
  const [period, setPeriod] = useState(12);
  const [dashboard, setDashboard] = useState<DashboardData>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error: apiError } = await superAdminApi.dashboard();
    if (apiError) setError(apiError);
    if (data) setDashboard(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const revenueData = useMemo(
    () => (dashboard.monthlyRevenueSeries || []).slice(-period),
    [dashboard.monthlyRevenueSeries, period]
  );

  const statusData = useMemo(
    () => (dashboard.institutionsByStatus || []).map((item) => ({
      status: STATUS_LABELS[item.status] || item.status,
      count: item.count,
    })),
    [dashboard.institutionsByStatus]
  );

  const exportCsv = () => {
    const rows = [
      ["Mois", "Revenu", "Abonnements"].join(","),
      ...revenueData.map((row) => [row.month, row.revenue, row.subscriptions].join(",")),
    ];
    const blob = new Blob([`\uFEFF${rows.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "analytics-soraschool.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const kpis = [
    { label: "MRR encaissé", value: formatCurrency(dashboard.monthlyRevenue), icon: TrendingUp, color: "text-soraBlue", bg: "bg-soraBlue/10" },
    { label: "Revenu annuel", value: formatCurrency(dashboard.annualRevenue), icon: DollarSign, color: "text-soraGold", bg: "bg-soraGold/10" },
    { label: "Écoles actives", value: `${dashboard.activeInstitutions}/${dashboard.totalInstitutions}`, icon: Building2, color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { label: "Paiements à vérifier", value: String(dashboard.pendingSaaSPayments || 0), icon: ShieldAlert, color: "text-orange-400", bg: "bg-orange-400/10" },
  ];

  return (
    <div className="max-w-[1600px] space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white">Analytique & rapports</h1>
          <p className="mt-0.5 text-sm text-gray-400">Performance réelle calculée depuis les institutions, abonnements et paiements SaaS.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-xl border border-white/8 bg-white/[0.04] p-1">
            {PERIODS.map((item) => (
              <button
                key={item.value}
                onClick={() => setPeriod(item.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${period === item.value ? "bg-soraBlue text-white" : "text-gray-400 hover:text-white"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" icon={<RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />} onClick={load}>
            Actualiser
          </Button>
          <Button variant="secondary" size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={exportCsv} disabled={revenueData.length === 0}>
            Exporter
          </Button>
        </div>
      </motion.div>

      {error && <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi, index) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }} className="rounded-2xl border border-white/8 bg-soraCard p-5">
            <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${kpi.bg}`}>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </div>
            <p className="font-heading text-xl font-bold text-white">{loading ? "…" : kpi.value}</p>
            <p className="mt-0.5 text-xs text-gray-500">{kpi.label}</p>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="rounded-2xl border border-white/8 bg-soraCard p-6">
        <div className="mb-6">
          <h2 className="flex items-center gap-2 font-heading text-base font-semibold text-white">
            <BarChart3 className="h-4 w-4 text-soraBlue" />
            Revenu mensuel réel
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">Paiements SaaS payés sur la période sélectionnée.</p>
        </div>
        {revenueData.length === 0 ? (
          <div className="grid h-[280px] place-items-center rounded-xl border border-dashed border-white/10 text-sm text-gray-500">
            Aucun paiement SaaS payé pour cette période.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0066FF" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0066FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: "#6B7280", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6B7280", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${(Number(value) / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [formatCurrency(value), "Revenu"]} />
              <Area type="monotone" dataKey="revenue" stroke="#0066FF" strokeWidth={2.5} fill="url(#mrrGrad)" dot={false} activeDot={{ r: 5, fill: "#0066FF" }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="rounded-2xl border border-white/8 bg-soraCard p-6">
          <h2 className="mb-5 flex items-center gap-2 font-heading text-base font-semibold text-white">
            <Building2 className="h-4 w-4 text-emerald-400" />
            Institutions par statut
          </h2>
          {statusData.length === 0 ? (
            <div className="grid h-[220px] place-items-center rounded-xl border border-dashed border-white/10 text-sm text-gray-500">Aucune institution enregistrée.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={statusData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="status" tick={{ fill: "#6B7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#6B7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Institutions" fill="#10B981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-2xl border border-white/8 bg-soraCard p-6">
          <h2 className="mb-5 flex items-center gap-2 font-heading text-base font-semibold text-white">
            <TrendingUp className="h-4 w-4 text-purple-400" />
            Abonnements payés
          </h2>
          {revenueData.length === 0 ? (
            <div className="grid h-[220px] place-items-center rounded-xl border border-dashed border-white/10 text-sm text-gray-500">Aucun abonnement payé enregistré.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fill: "#6B7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#6B7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value}`, "Abonnements"]} />
                <Bar dataKey="subscriptions" name="Abonnements" fill="#A78BFA" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>
    </div>
  );
}
