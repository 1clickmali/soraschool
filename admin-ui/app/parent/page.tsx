"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentSchoolSlug } from "@/lib/school-auth";

export default function ParentShortcutPage() {
  const router = useRouter();

  useEffect(() => {
    const slug = getCurrentSchoolSlug();
    router.replace(slug ? `/${slug}/parent/dashboard` : "/login");
  }, [router]);

  return (
    <div className="min-h-screen bg-soraDark flex items-center justify-center text-sm text-gray-400">
      Ouverture de l’espace parent...
    </div>
  );
}
