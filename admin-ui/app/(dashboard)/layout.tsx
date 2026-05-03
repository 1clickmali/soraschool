"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { isAuthenticated } from "@/lib/auth";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { setUser } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }

    // Fetch current user profile
    authApi.me().then(({ data }) => {
      if (data) setUser(data);
    });
  }, [router, setUser]);

  if (!isAuthenticated() && typeof window !== "undefined") {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-soraDark">
      <Sidebar />

      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-6 min-h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
