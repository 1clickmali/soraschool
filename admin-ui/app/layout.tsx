import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { BrandingProvider } from "@/lib/branding";
import { DEFAULT_BRANDING } from "@/lib/branding-defaults";
import { getApiBaseUrl } from "@/lib/api-url";
import type { PlatformBranding } from "@/lib/api";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

async function getBrandingForMetadata(): Promise<PlatformBranding> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/platform/branding`, {
      cache: "no-store",
    });
    if (!response.ok) return DEFAULT_BRANDING;
    const data = await response.json();
    return { ...DEFAULT_BRANDING, ...data.branding };
  } catch {
    return DEFAULT_BRANDING;
  }
}

function resolveMetadataAsset(value?: string | null) {
  if (!value) return "/icons/soraschool-icon.svg";
  if (/^https?:\/\//.test(value)) return value;
  if (value.startsWith("/api/")) return `${getApiBaseUrl()}${value}`;
  return value;
}

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBrandingForMetadata();
  const icon = resolveMetadataAsset(branding.faviconUrl || branding.logoUrl);

  return {
    applicationName: branding.appName,
    title: {
      default: branding.appName,
      template: `%s | ${branding.appName}`,
    },
    description: `${branding.appName} — ${branding.slogan || "Gestion scolaire complète pour écoles, groupes et administrations"}`,
    manifest: "/manifest.webmanifest",
    icons: {
      icon,
      apple: icon,
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: branding.appName,
    },
    formatDetection: {
      telephone: false,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f6bff",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`dark ${inter.variable} ${poppins.variable}`}>
      <body className="bg-soraDark text-gray-100 font-sans antialiased">
        <BrandingProvider>
          <PwaRegister />
          {children}
        </BrandingProvider>
      </body>
    </html>
  );
}
