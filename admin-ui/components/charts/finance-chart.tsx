"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface FinanceChartProps {
  data: { label: string; collected: number }[];
}

interface TooltipProps {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const fmt = (v: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "XOF", maximumFractionDigits: 0 }).format(v);
  return (
    <div className="bg-soraDark border border-white/10 rounded-xl p-3 shadow-2xl">
      <p className="text-gray-400 text-xs mb-2">{label}</p>
      {payload.map((e, i) => (
        <p key={i} className="text-sm text-white">
          {fmt(e.value)}
        </p>
      ))}
    </div>
  );
}

export function FinanceChart({ data }: FinanceChartProps) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 11 }} />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#6B7280", fontSize: 10 }}
          tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
          width={48}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey="collected" name="Encaissé (XOF)" fill="#0066FF" radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}
