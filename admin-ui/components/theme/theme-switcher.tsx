"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { ThemePreference } from "@/lib/api";

const options: Array<{ value: ThemePreference; label: string; icon: React.ElementType }> = [
  { value: "LIGHT", label: "Mode clair", icon: Sun },
  { value: "DARK", label: "Mode sombre", icon: Moon },
  { value: "SYSTEM", label: "Automatique", icon: Monitor },
];

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { preference, setPreference } = useTheme();

  return (
    <div className={cn(
      "flex items-center gap-1 rounded-2xl border border-white/10 bg-soraCard/95 p-1 shadow-2xl backdrop-blur-xl light:border-slate-200 light:bg-white/95",
      compact && "scale-95"
    )}>
      {options.map((option) => {
        const Icon = option.icon;
        const active = preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setPreference(option.value)}
            title={option.label}
            aria-pressed={active}
            className={cn(
              "inline-flex h-9 min-w-9 items-center justify-center gap-2 rounded-xl px-2.5 text-xs font-semibold transition",
              active
                ? "bg-soraBlue text-white shadow-glow-blue"
                : "text-gray-400 hover:bg-white/8 hover:text-white light:text-slate-500 light:hover:bg-slate-100 light:hover:text-slate-900"
            )}
          >
            <Icon className="h-4 w-4" />
            {!compact && <span className="hidden sm:inline">{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function FloatingThemeSwitcher() {
  return (
    <div className="fixed bottom-24 right-4 z-50 sm:bottom-4">
      <ThemeSwitcher compact />
    </div>
  );
}
