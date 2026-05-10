"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { isAuthenticated } from "@/lib/auth";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    authApi.me().then(({ data }) => {
      if (data) setUser(data);
    });
  }, [router, setUser]);

  if (!isAuthenticated() && typeof window !== "undefined") return null;

  return (
    <div className="sora-academy-shell flex min-h-screen bg-soraDark lg:h-screen lg:overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col lg:overflow-hidden">
        <Header onMenuOpen={() => setMobileOpen(true)} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="min-h-full p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
