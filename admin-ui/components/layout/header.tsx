"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  ChevronRight,
  LogOut,
  Menu,
  Search,
  Settings,
  User,
} from "lucide-react";
import { superAdminApi, type SuperAdminNotification } from "@/lib/api";
import { useBranding } from "@/lib/branding";
import { cn, formatRelativeDate, getInitials } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";

const breadcrumbMap: Record<string, string> = {
  "/dashboard":       "Vue d'ensemble",
  "/analytics":       "Analytique",
  "/institutions":    "Écoles clientes",
  "/plans":           "Plans & abonnements",
  "/payments":        "Facturation SaaS",
  "/factures":        "Factures SaaS",
  "/configuration":   "Configuration",
  "/acces-autorises": "Utilisateurs & accès",
  "/documents":       "Documents",
  "/systeme":         "Système",
  "/administration":  "Gestion admins",
  "/parametres":      "Paramètres",
  "/calendar":        "Calendrier",
  "/holidays":        "Vacances / Congés",
};

interface HeaderProps {
  onMenuOpen?: () => void;
}

export function Header({ onMenuOpen }: HeaderProps) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu]           = useState(false);
  const [notifications, setNotifications]         = useState<SuperAdminNotification[]>([]);
  const { branding } = useBranding();

  const currentPage  = breadcrumbMap[pathname] || "Page";
  const unreadCount  = notifications.filter((n) => n.unread).length;
  const pathSegments = pathname.split("/").filter(Boolean);

  useEffect(() => {
    superAdminApi.notifications().then(({ data }) => {
      setNotifications(data?.notifications || []);
    });
  }, []);

  const closeAll = () => { setShowNotifications(false); setShowUserMenu(false); };

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center border-b border-white/[0.06] bg-[#080d1a]/90 px-4 backdrop-blur-xl lg:px-6">

      {/* ── Mobile hamburger ──────────────────────────── */}
      <button
        onClick={onMenuOpen}
        className="mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-gray-400 transition hover:bg-white/[0.08] hover:text-white lg:hidden touch-feedback"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* ── Breadcrumb (desktop) ──────────────────────── */}
      <div className="hidden flex-1 items-center gap-2 text-sm lg:flex">
        <span className="cursor-pointer text-gray-500 transition hover:text-gray-300">
          {branding.appName}
        </span>
        {pathSegments.map((seg, i) => {
          const isLast = i === pathSegments.length - 1;
          const segPath = "/" + pathSegments.slice(0, i + 1).join("/");
          const label = breadcrumbMap[segPath] || seg;
          return (
            <span key={seg} className="flex items-center gap-2">
              <ChevronRight className="h-3.5 w-3.5 text-gray-600" />
              <span className={cn("font-medium transition-colors",
                isLast ? "text-white" : "cursor-pointer text-gray-500 hover:text-gray-300"
              )}>
                {label}
              </span>
            </span>
          );
        })}
      </div>

      {/* ── Page title (mobile) ──────────────────────── */}
      <div className="flex-1 lg:hidden">
        <p className="text-sm font-bold text-white leading-none">{currentPage}</p>
        <p className="text-[11px] text-blue-400/60 mt-0.5">{branding.appName}</p>
      </div>

      {/* ── Search (desktop) ─────────────────────────── */}
      <div className="mr-3 hidden w-52 items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 transition hover:border-white/[0.14] md:flex">
        <Search className="h-3.5 w-3.5 shrink-0 text-gray-500" />
        <input
          type="text"
          placeholder="Rechercher…"
          className="w-full flex-1 bg-transparent text-sm text-gray-400 placeholder:text-gray-600"
        />
        <kbd className="rounded bg-white/5 px-1.5 py-0.5 text-xs text-gray-600">⌘K</kbd>
      </div>

      {/* ── Right actions ─────────────────────────────── */}
      <div className="flex items-center gap-1">

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false); }}
            className="relative flex h-9 w-9 items-center justify-center rounded-2xl text-gray-400 transition hover:bg-white/[0.06] hover:text-white touch-feedback"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-soraBlue">
                <span className="absolute inset-0 animate-ping rounded-full bg-soraBlue opacity-75" />
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -5 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl border border-white/10 bg-soraCard shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                  <span className="text-sm font-semibold text-white">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-soraBlue/10 px-2 py-0.5 text-xs text-soraBlue">{unreadCount} nouvelles</span>
                  )}
                </div>
                <div className="divide-y divide-white/5 max-h-72 overflow-y-auto scrollbar-none">
                  {notifications.length === 0 && (
                    <div className="px-4 py-8 text-center">
                      <Bell className="mx-auto mb-2 h-6 w-6 text-gray-600" />
                      <p className="text-sm text-gray-500">Aucune notification</p>
                    </div>
                  )}
                  {notifications.map((n) => (
                    <div key={n.id} className={cn("cursor-pointer px-4 py-3 transition hover:bg-white/[0.03]", n.unread && "bg-soraBlue/[0.03]")}>
                      <div className="flex items-start gap-3">
                        <div className={cn("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", n.unread ? "bg-soraBlue" : "bg-transparent")} />
                        <div>
                          <p className="text-sm font-medium text-white">{n.title}</p>
                          <p className="mt-0.5 text-xs text-gray-400">{n.desc}</p>
                          <p className="mt-1 text-xs text-gray-600">{formatRelativeDate(n.time)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-white/8 px-4 py-2.5 text-center">
                  <button className="text-xs text-soraBlue transition hover:text-blue-400">Tout voir</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mx-1 h-6 w-px bg-white/10" />

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false); }}
            className="flex items-center gap-2 rounded-2xl py-1.5 pl-1 pr-3 transition hover:bg-white/8 touch-feedback"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-soraBlue to-purple-600 text-xs font-bold text-white">
              {user?.name ? getInitials(user.name) : "SA"}
            </div>
            <div className="hidden text-left md:block">
              <p className="text-sm font-semibold text-white leading-none">{user?.name || "Super Admin"}</p>
              <p className="mt-0.5 text-xs text-gray-500">Super Admin</p>
            </div>
          </button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -5 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-3xl border border-white/10 bg-soraCard shadow-2xl"
              >
                <div className="border-b border-white/8 px-4 py-3">
                  <p className="text-sm font-semibold text-white">{user?.name || "Super Admin"}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{user?.phone}</p>
                </div>
                <div className="p-2">
                  <button className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-gray-300 transition hover:bg-white/[0.06] hover:text-white touch-feedback">
                    <User className="h-4 w-4" /> Mon profil
                  </button>
                  <button className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-gray-300 transition hover:bg-white/[0.06] hover:text-white touch-feedback">
                    <Settings className="h-4 w-4" /> Paramètres
                  </button>
                  <div className="my-1.5 h-px bg-white/8" />
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-red-400 transition hover:bg-red-500/10 hover:text-red-300 touch-feedback"
                  >
                    <LogOut className="h-4 w-4" /> Déconnexion
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Click-away overlay */}
      {(showNotifications || showUserMenu) && (
        <div className="fixed inset-0 z-[-1]" onClick={closeAll} />
      )}
    </header>
  );
}
