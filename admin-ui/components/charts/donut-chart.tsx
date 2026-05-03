"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface DonutChartProps {
  data: { name: string; value: number; color: string }[];
  total?: number;
  label?: string;
}

interface TooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; payload: { color: string } }[];
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="bg-soraDark border border-white/10 rounded-xl p-3 shadow-2xl">
      <div className="flex items-center gap-2 text-sm">
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: item.payload.color }}
        />
        <span className="text-gray-300">{item.name}</span>
        <span className="text-white font-bold ml-1">{item.value}</span>
      </div>
    </div>
  );
}

export function DonutChart({ data, total, label = "Total" }: DonutChartProps) {
  const displayTotal = total ?? data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={65}
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-3xl font-bold font-heading text-white">
          {displayTotal}
        </span>
        <span className="text-xs text-gray-400 mt-0.5">{label}</span>
      </div>

      {/* Legend */}
      <div className="mt-2 grid grid-cols-2 gap-2 px-2">
        {data.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-gray-400 truncate">{item.name}</span>
            <span className="text-xs text-white font-medium ml-auto">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
