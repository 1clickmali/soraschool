"use client";

import { Languages } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiLanguage, uiText } from "@/lib/ui-language";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useUiLanguage();

  return (
    <div className={cn(
      "sora-language-switcher inline-flex items-center gap-1 rounded-2xl border border-slate-200/70 bg-white/80 p-1 shadow-sm shadow-slate-900/5",
      compact && "rounded-xl"
    )}>
      {!compact && <Languages className="ml-2 h-4 w-4 text-slate-500" />}
      {(["fr", "en"] as const).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setLanguage(item)}
          className={cn(
            "rounded-xl px-2.5 py-1.5 text-xs font-bold transition",
            language === item
              ? "bg-slate-950 text-white shadow-sm"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          )}
          title={item === "fr" ? "Français" : "English"}
        >
          {compact ? item.toUpperCase() : uiText(item, "FR", "EN")}
        </button>
      ))}
    </div>
  );
}
