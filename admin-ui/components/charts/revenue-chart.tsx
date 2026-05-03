"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface RevenueChartProps {
  data: { month: string; revenue: number; subscriptions: number }[];
}

interface TooltipProps {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-soraDark border border-white/10 rounded-xl p-3 shadow-2xl backdrop-blur-xl">
      <p className="text-gray-400 text-xs mb-2 font-medium">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-300">
            {entry.name === "revenue"
              ? formatCurrency(entry.value)
              : `${entry.value} abonnements`}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0066FF" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#0066FF" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorSubs" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#C89B3C" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#C89B3C" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.05)"
          vertical={false}
        />
        <XAxis
          dataKey="month"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#6B7280", fontSize: 12 }}
          dy={8}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#6B7280", fontSize: 11 }}
          tickFormatter={(v) =>
            v >= 1000000
              ? `${(v / 1000000).toFixed(1)}M`
              : v >= 1000
              ? `${(v / 1000).toFixed(0)}k`
              : v.toString()
          }
          width={50}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }} />
        <Area
          type="monotone"
          dataKey="revenue"
          name="revenue"
          stroke="#0066FF"
          strokeWidth={2.5}
          fill="url(#colorRevenue)"
          dot={false}
          activeDot={{ r: 5, fill: "#0066FF", stroke: "#fff", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
