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
  CalendarOff,
  DollarSign,
  Settings,
  ShieldCheck,
  FileText,
  Server,
  ChevronLeft,
  LogOut,
  Receipt,
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
  { label: "Vue d'ensemble", href: "/dashboard", icon: LayoutDashboard },
  { label: "Analytique", href: "/analytics", icon: BarChart3 },
  { separator: true, label: "", sectionLabel: "ÉTABLISSEMENTS" },
  { label: "Écoles clientes", href: "/institutions", icon: Building2 },
  { label: "Plans & abonnements", href: "/plans", icon: CreditCard },
  { label: "Facturation SaaS", href: "/payments", icon: DollarSign },
  { label: "Factures SaaS", href: "/factures", icon: Receipt },
  { separator: true, label: "", sectionLabel: "ADMINISTRATION" },
  { label: "Configuration", href: "/configuration", icon: Settings },
  { label: "Utilisateurs & accès", href: "/acces-autorises", icon: ShieldCheck },
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Calendrier", href: "/calendar", icon: CalendarDays },
  { label: "Vacances / Congés", href: "/holidays", icon: CalendarOff },
  { separator: true, label: "", sectionLabel: "SYSTÈME" },
  { label: "Audit & Sécurité", href: "/systeme", icon: Server },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { branding } = useBranding();

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex flex-col h-screen bg-soraSidebar border-r border-white/[0.06] overflow-hidden flex-shrink-0"
    >
      {/* Top gradient */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-soraBlue/5 to-transparent pointer-events-none" />

      {/* Logo area */}
      <div className="relative flex items-center h-16 px-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-soraBlue to-blue-700 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-glow-blue">
            <BrandMark className="h-full w-full object-cover" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="min-w-0"
              >
                <p className="text-white font-bold font-heading text-sm leading-none">
                  {branding.appName}
                </p>
                <p className="text-gray-500 text-xs mt-0.5">Super Admin</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Collapse button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg",
            "text-gray-500 hover:text-gray-300 hover:bg-white/8 transition-colors"
          )}
        >
          <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.3 }}>
            <ChevronLeft className="w-4 h-4" />
          </motion.div>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden scrollbar-none">
        {navItems.map((item, index) => {
          if (item.separator) {
            return (
              <div key={index} className="mt-3 mb-1 mx-4">
                <div className="h-px bg-white/[0.06]" />
                {item.sectionLabel && !collapsed && (
                  <p className="mt-2 px-1 text-[10px] font-bold tracking-widest text-gray-600 uppercase">
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
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl text-sm transition-all duration-200",
                "group",
                isActive
                  ? "text-white"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.06]"
              )}
            >
              {/* Active pill background */}
              {isActive && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-soraBlue/30 to-soraBlue/10 border border-soraBlue/20"
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                />
              )}

              {/* Active left accent */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-soraBlue rounded-r-full" />
              )}

              <Icon
                className={cn(
                  "w-4 h-4 flex-shrink-0 relative z-10 transition-transform duration-200",
                  "group-hover:scale-110",
                  isActive ? "text-soraBlue" : ""
                )}
              />

              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -5 }}
                    transition={{ duration: 0.15 }}
                    className="relative z-10 font-medium truncate"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Tooltip when collapsed */}
              {collapsed && (
                <div className="absolute left-full ml-3 px-3 py-1.5 bg-soraDark border border-white/10 rounded-lg text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-xl z-50">
                  {item.label}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-soraDark" />
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-white/[0.06] p-3">
        <div
          className={cn(
            "flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer group",
            collapsed && "justify-center"
          )}
        >
          {/* Avatar */}
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-soraBlue to-purple-600 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
            {user?.name ? getInitials(user.name) : "SA"}
          </div>

          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                transition={{ duration: 0.15 }}
                className="flex-1 min-w-0"
              >
                <p className="text-sm font-medium text-white truncate">
                  {user?.name || "Super Admin"}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.phone || ""}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {!collapsed && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={logout}
                className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  );
}
