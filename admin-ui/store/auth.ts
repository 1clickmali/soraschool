"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserProfile } from "@/lib/api";
import { removeTokens } from "@/lib/auth";

interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  setUser: (user: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,

      setUser: (user) => set({ user }),

      setLoading: (isLoading) => set({ isLoading }),

      logout: () => {
        removeTokens();
        set({ user: null });
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      },
    }),
    {
      name: "sora-auth",
      partialize: (state) => ({ user: state.user }),
    }
  )
);
