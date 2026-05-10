"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  BarChart3,
  Building2,
  CreditCard,
  CalendarDays,
  Settings,
  ShieldCheck,
  FileText,
  Server,
  ChevronLeft,
  LogOut,
  Receipt,
  X,
} from "lucide-react";
import { BrandMark, useBranding } from "@/lib/branding";
import { cn, getInitials } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";

interface NavItem {
  label: string;
  href?: string;
  icon?: React.ElementType;
  separator?: boolean;
  sectionLabel?: string;
}

const navItems: NavItem[] = [
  { label: "Vue d'ensemble",       href: "/dashboard",      icon: LayoutDashboard },
  { label: "Rapports & statistiques", href: "/analytics",   icon: BarChart3 },
  { separator: true, label: "",    sectionLabel: "ÉTABLISSEMENTS" },
  { label: "Écoles clientes",      href: "/institutions",   icon: Building2 },
  { label: "Plans & abonnements",  href: "/plans",          icon: CreditCard },
  { label: "Finance SaaS",         href: "/factures",       icon: Receipt },
  { separator: true, label: "",    sectionLabel: "ADMINISTRATION" },
  { label: "Utilisateurs & permissions", href: "/acces-autorises", icon: ShieldCheck },
  { label: "Documents officiels",  href: "/documents",      icon: FileText },
  { label: "Calendrier scolaire",  href: "/calendar",       icon: CalendarDays },
  { label: "Configuration",        href: "/configuration",  icon: Settings },
  { separator: true, label: "",    sectionLabel: "SYSTÈME" },
  { label: "Audit & sécurité",     href: "/systeme",        icon: Server },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { branding } = useBranding();

  /* ── Shared nav content ─────────────────────────────── */
  const NavContent = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      {/* Top glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-soraBlue/6 to-transparent" />

      {/* Header */}
      <div className="relative flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.06] px-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="h-9 w-9 shrink-0 rounded-2xl bg-gradient-to-br from-soraBlue to-blue-700 overflow-hidden shadow-glow-blue flex items-center justify-center">
            <BrandMark className="h-full w-full object-cover" />
          </div>
          <AnimatePresence>
            {(!collapsed || mobile) && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="min-w-0 flex-1"
              >
                <p className="truncate text-sm font-bold text-white leading-none font-heading">
                  {branding.appName}
                </p>
                <p className="text-xs text-blue-400/70 mt-0.5">Super Admin</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Desktop collapse */}
        {!mobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="shrink-0 rounded-xl p-1.5 text-gray-500 hover:bg-white/8 hover:text-gray-300 transition-colors"
          >
            <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.3 }}>
              <ChevronLeft className="h-4 w-4" />
            </motion.div>
          </button>
        )}

        {/* Mobile close */}
        {mobile && onClose && (
          <button onClick={onClose} className="shrink-0 rounded-xl p-2 text-gray-500 hover:bg-white/8 hover:text-white transition touch-feedback">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 scrollbar-none">
        {navItems.map((item, index) => {
          if (item.separator) {
            return (
              <div key={index} className="mx-4 mb-1 mt-3">
                <div className="h-px bg-white/[0.06]" />
                {item.sectionLabel && (!collapsed || mobile) && (
                  <p className="mt-2 px-1 text-[10px] font-bold uppercase tracking-widest text-gray-600">
                    {item.sectionLabel}
                  </p>
                )}
              </div>
            );
          }

          if (!item.href || !item.icon) return null;
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link key={item.href} href={item.href}
              onClick={() => mobile && onClose?.()}
              className={cn(
                "group relative mx-2 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all duration-200",
                isActive ? "text-white" : "text-gray-400 hover:bg-white/[0.06] hover:text-gray-200"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="superAdminActiveNav"
                  className="absolute inset-0 rounded-2xl bg-gradient-to-r from-soraBlue/28 to-soraBlue/8 border border-soraBlue/20"
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              {isActive && (
                <div className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-soraBlue" />
              )}

              <Icon className={cn("relative z-10 h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110",
                isActive ? "text-soraBlue" : ""
              )} />

              <AnimatePresence>
                {(!collapsed || mobile) && (
                  <motion.span
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -5 }}
                    transition={{ duration: 0.15 }}
                    className="relative z-10 flex-1 truncate font-medium"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Tooltip (desktop collapsed only) */}
              {collapsed && !mobile && (
                <div className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-xl border border-white/10 bg-soraDark px-3 py-1.5 text-xs text-white opacity-0 shadow-xl transition-opacity duration-200 group-hover:opacity-100">
                  {item.label}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-soraDark" />
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="shrink-0 border-t border-white/[0.06] p-3">
        <div className={cn(
          "group flex cursor-pointer items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-white/[0.06]",
          (collapsed && !mobile) && "justify-center"
        )}>
          <div className="h-9 w-9 shrink-0 rounded-2xl bg-gradient-to-br from-soraBlue to-purple-600 flex items-center justify-center text-xs font-bold text-white">
            {user?.name ? getInitials(user.name) : "SA"}
          </div>
          <AnimatePresence>
            {(!collapsed || mobile) && (
              <motion.div
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                transition={{ duration: 0.15 }}
                className="flex-1 min-w-0"
              >
                <p className="truncate text-sm font-medium text-white">{user?.name || "Super Admin"}</p>
                <p className="truncate text-xs text-gray-500">{user?.phone || "super@admin"}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {(!collapsed || mobile) && (
              <motion.button
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={logout}
                className="rounded-xl p-1.5 text-gray-600 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 touch-feedback"
              >
                <LogOut className="h-3.5 w-3.5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* ── Desktop Sidebar ─────────────────────────────── */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="sora-academy-sidebar relative hidden h-screen shrink-0 flex-col overflow-hidden border-r border-white/[0.06] bg-soraSidebar lg:flex"
      >
        <NavContent />
      </motion.aside>

      {/* ── Mobile Drawer ────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="sa-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              key="sa-drawer"
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="sora-academy-sidebar fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-soraSidebar shadow-2xl lg:hidden"
            >
              <NavContent mobile />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
