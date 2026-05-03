"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getApiBaseUrl } from "@/lib/api-url";
import { getSchoolToken } from "@/lib/school-auth";

interface SecureImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallback: ReactNode;
}

export function SecureImage({ src, alt, className, fallback }: SecureImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!src) {
      setObjectUrl(null);
      setFailed(false);
      return;
    }

    let mounted = true;
    let nextUrl: string | null = null;

    async function loadImage() {
      try {
        if (src!.startsWith("http") && !src!.includes("/api/documents/")) {
          if (mounted) setObjectUrl(src!);
          return;
        }

        const token = getSchoolToken();
        const url = src!.startsWith("http") ? src! : `${getApiBaseUrl()}${src}`;
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Image inaccessible");
        const blob = await res.blob();
        nextUrl = URL.createObjectURL(blob);
        if (mounted) {
          setObjectUrl(nextUrl);
          setFailed(false);
        }
      } catch {
        if (mounted) {
          setObjectUrl(null);
          setFailed(true);
        }
      }
    }

    loadImage();

    return () => {
      mounted = false;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [src]);

  if (!src || failed || !objectUrl) return <>{fallback}</>;

  return <img src={objectUrl} alt={alt} className={className} loading="lazy" />;
}
