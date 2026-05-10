"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getAccessToken } from "./auth";
import { getSchoolToken } from "./school-auth";
import { getApiBaseUrl } from "./api-url";
import type { ThemePreference } from "./api";

type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "sora-theme-preference";

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "LIGHT") return "light";
  if (preference === "DARK") return "dark";
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
  return "dark";
}

function applyTheme(preference: ThemePreference) {
  const resolved = resolveTheme(preference);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.classList.toggle("light", resolved === "light");
  root.dataset.theme = resolved;
  root.dataset.themePreference = preference.toLowerCase();
}

async function persistTheme(preference: ThemePreference) {
  const token = getAccessToken() || getSchoolToken();
  if (!token) return;
  await fetch(`${getApiBaseUrl()}/api/auth/theme`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "Idempotency-Key": `theme-${preference.toLowerCase()}-${Date.now()}`,
    },
    body: JSON.stringify({ themePreference: preference }),
  }).catch(() => undefined);
}

async function fetchSavedTheme() {
  const token = getAccessToken() || getSchoolToken();
  if (!token) return undefined;
  const response = await fetch(`${getApiBaseUrl()}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return undefined;
  const payload = await response.json().catch(() => null);
  return payload?.user?.themePreference as ThemePreference | undefined;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("SYSTEM");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");

  useEffect(() => {
    const localPreference = (localStorage.getItem(STORAGE_KEY) as ThemePreference | null) || "SYSTEM";
    setPreferenceState(localPreference);
    setResolvedTheme(resolveTheme(localPreference));
    applyTheme(localPreference);

    fetchSavedTheme().then((saved) => {
      if (!saved) return;
      localStorage.setItem(STORAGE_KEY, saved);
      setPreferenceState(saved);
      setResolvedTheme(resolveTheme(saved));
      applyTheme(saved);
    });
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      if (preference !== "SYSTEM") return;
      const next = resolveTheme("SYSTEM");
      setResolvedTheme(next);
      applyTheme("SYSTEM");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const value = useMemo<ThemeContextValue>(() => ({
    preference,
    resolvedTheme,
    setPreference(next) {
      localStorage.setItem(STORAGE_KEY, next);
      setPreferenceState(next);
      setResolvedTheme(resolveTheme(next));
      applyTheme(next);
      void persistTheme(next);
    },
  }), [preference, resolvedTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export function ThemeBootScript() {
  const code = `
    (function(){
      try {
        var pref = localStorage.getItem('${STORAGE_KEY}') || 'SYSTEM';
        var light = pref === 'LIGHT' || (pref === 'SYSTEM' && window.matchMedia('(prefers-color-scheme: light)').matches);
        document.documentElement.classList.toggle('light', light);
        document.documentElement.classList.toggle('dark', !light);
        document.documentElement.dataset.theme = light ? 'light' : 'dark';
        document.documentElement.dataset.themePreference = String(pref).toLowerCase();
      } catch (_) {
        document.documentElement.classList.add('dark');
        document.documentElement.dataset.theme = 'dark';
      }
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
