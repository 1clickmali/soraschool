"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getApiBaseUrl } from "@/lib/api-url";
import { platformApi, type PlatformBranding } from "@/lib/api";
import { DEFAULT_BRANDING } from "@/lib/branding-defaults";

interface BrandingContextValue {
  branding: PlatformBranding;
  setBranding: (branding: PlatformBranding) => void;
  refreshBranding: () => Promise<void>;
  assetUrl: (value?: string | null) => string | undefined;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

function resolveAssetUrl(value?: string | null) {
  if (!value) return undefined;
  if (/^https?:\/\//.test(value)) return value;
  if (value.startsWith("/api/")) return `${getApiBaseUrl()}${value}`;
  return value;
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<PlatformBranding>(DEFAULT_BRANDING);

  const refreshBranding = async () => {
    const { data } = await platformApi.branding();
    if (data?.branding) setBranding({ ...DEFAULT_BRANDING, ...data.branding });
  };

  useEffect(() => {
    void refreshBranding();
  }, []);

  useEffect(() => {
    document.title = branding.appName;
    document.documentElement.style.setProperty("--runtime-primary", branding.primaryColor);
    document.documentElement.style.setProperty("--runtime-secondary", branding.secondaryColor);
    document.documentElement.style.setProperty("--runtime-accent", branding.accentColor);

    const favicon = resolveAssetUrl(branding.faviconUrl || branding.logoUrl) ?? DEFAULT_BRANDING.faviconUrl ?? "/icons/soraschool-icon.svg";
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = favicon;
  }, [branding]);

  const value = useMemo<BrandingContextValue>(() => ({
    branding,
    setBranding,
    refreshBranding,
    assetUrl: resolveAssetUrl,
  }), [branding]);

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (!context) {
    return {
      branding: DEFAULT_BRANDING,
      setBranding: () => undefined,
      refreshBranding: async () => undefined,
      assetUrl: resolveAssetUrl,
    };
  }
  return context;
}

export function BrandMark({ className = "h-5 w-5" }: { className?: string }) {
  const { branding, assetUrl } = useBranding();
  const logo = assetUrl(branding.logoUrl);

  if (logo) {
    return <img src={logo} alt={branding.appName} className={className} />;
  }

  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label={branding.appName}>
      <defs>
        <linearGradient id="soraschool-mark" x1="8" y1="6" x2="56" y2="58">
          <stop stopColor={branding.primaryColor} />
          <stop offset="1" stopColor={branding.accentColor} />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="52" height="52" rx="16" fill="url(#soraschool-mark)" />
      <path d="M20 24l12-7 12 7-12 7-12-7Z" fill="white" opacity=".96" />
      <path d="M24 30v8c0 3 16 3 16 0v-8l-8 5-8-5Z" fill="white" opacity=".9" />
      <path d="M44 26v12" stroke="white" strokeWidth="3" strokeLinecap="round" opacity=".85" />
    </svg>
  );
}
