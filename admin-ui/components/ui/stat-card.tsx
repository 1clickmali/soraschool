"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  icon: LucideIcon;
  color: "blue" | "green" | "orange" | "red" | "purple" | "indigo" | "emerald" | "gold";
  trend?: number;
  trendLabel?: string;
  formatValue?: (v: number) => string;
  delay?: number;
}

const colorMap = {
  blue: {
    icon: "bg-blue-500/20 text-blue-400",
    glow: "hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]",
    text: "text-blue-400",
  },
  green: {
    icon: "bg-emerald-500/20 text-emerald-400",
    glow: "hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]",
    text: "text-emerald-400",
  },
  orange: {
    icon: "bg-orange-500/20 text-orange-400",
    glow: "hover:shadow-[0_0_30px_rgba(249,115,22,0.2)]",
    text: "text-orange-400",
  },
  red: {
    icon: "bg-red-500/20 text-red-400",
    glow: "hover:shadow-[0_0_30px_rgba(239,68,68,0.2)]",
    text: "text-red-400",
  },
  purple: {
    icon: "bg-purple-500/20 text-purple-400",
    glow: "hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]",
    text: "text-purple-400",
  },
  indigo: {
    icon: "bg-indigo-500/20 text-indigo-400",
    glow: "hover:shadow-[0_0_30px_rgba(99,102,241,0.2)]",
    text: "text-indigo-400",
  },
  emerald: {
    icon: "bg-emerald-500/20 text-emerald-400",
    glow: "hover:shadow-[0_0_30px_rgba(16,185,129,0.2)]",
    text: "text-emerald-400",
  },
  gold: {
    icon: "bg-yellow-500/20 text-yellow-400",
    glow: "hover:shadow-[0_0_30px_rgba(200,155,60,0.3)]",
    text: "text-yellow-400",
  },
};

function useCountUp(target: number, duration = 1200) {
  const [count, setCount] = useState(0);
  const frameRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    startTimeRef.current = performance.now();

    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      setCount(Math.round(easeOut(progress) * target));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration]);

  return count;
}

export function StatCard({
  title,
  value,
  prefix = "",
  suffix = "",
  icon: Icon,
  color,
  trend,
  trendLabel,
  formatValue,
  delay = 0,
}: StatCardProps) {
  const animatedValue = useCountUp(value);
  const colors = colorMap[color];

  const displayValue = formatValue
    ? formatValue(animatedValue)
    : `${prefix}${animatedValue.toLocaleString("fr-CI")}${suffix}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      className={cn(
        "relative bg-soraCard border border-white/8 rounded-2xl p-5 cursor-default",
        "transition-shadow duration-300",
        "overflow-hidden group",
        colors.glow
      )}
    >
      {/* Subtle gradient background on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-white/[0.02] to-transparent rounded-2xl" />

      {/* Top decoration line */}
      <div className={cn("absolute inset-x-0 top-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-transparent via-current to-transparent", colors.text)} />

      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className={cn("p-2.5 rounded-xl", colors.icon)}>
            <Icon className="w-5 h-5" />
          </div>

          {trend !== undefined && (
            <div
              className={cn(
                "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
                trend >= 0
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-red-500/15 text-red-400"
              )}
            >
              {trend >= 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {Math.abs(trend)}%
            </div>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-2xl font-bold font-heading text-white tracking-tight">
            {displayValue}
          </p>
          <p className="text-sm text-gray-400">{title}</p>
          {trendLabel && (
            <p className="text-xs text-gray-500">{trendLabel}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
