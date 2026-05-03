"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  Library,
  LayoutGrid,
  Calendar,
  CalendarDays,
  CalendarOff,
  CheckSquare,
  Star,
  Shield,
  DollarSign,
  ShoppingBag,
  FileText,
  MessageSquare,
  Settings,
  LogOut,
  ChevronLeft,
  Bell,
  Menu,
  X,
  Building2,
} from "lucide-react";
import { isSchoolAuthenticated, removeSchoolTokens } from "@/lib/school-auth";
import { schoolAuthApi, type SchoolUser, type SchoolInstitution } from "@/lib/school-api";
import { schoolApi } from "@/lib/school-api";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href?: string;
  icon?: React.ElementType;
  separator?: boolean;
  sectionLabel?: string;
  roles?: string[];
}

function buildNavItems(slug: string): NavItem[] {
  return [
    { label: "Tableau de bord", href: `/${slug}/dashboard`, icon: LayoutDashboard },
    { label: "Mes établissements", href: `/${slug}/etablissements`, icon: Building2, roles: ["CENTRAL_ADMIN"] },
    { separator: true, label: "", sectionLabel: "ACADÉMIQUE" },
    { label: "Apprenants", href: `/${slug}/students`, icon: GraduationCap },
    {
      label: "Enseignants", href: `/${slug}/teachers`, icon: BookOpen,
      roles: ["DIRECTOR", "ADMINISTRATION"],
    },
    { label: "Structure académique", href: `/${slug}/classes`, icon: LayoutGrid },
    {
      label: "Programmes & matières", href: `/${slug}/subjects`, icon: Library,
      roles: ["DIRECTOR", "ADMINISTRATION"],
    },
    { label: "Emploi du temps", href: `/${slug}/schedule`, icon: Calendar },
    { label: "Calendrier", href: `/${slug}/calendar`, icon: CalendarDays },
    { label: "Vacances / Congés", href: `/${slug}/holidays`, icon: CalendarOff },
    { label: "Assiduité", href: `/${slug}/attendance`, icon: CheckSquare },
    { label: "Évaluations", href: `/${slug}/grades`, icon: Star },
    {
      label: "Vie scolaire", href: `/${slug}/discipline`, icon: Shield,
      roles: ["DIRECTOR", "ADMINISTRATION"],
    },
    { separator: true, label: "", sectionLabel: "FINANCE" },
    {
      label: "Finance scolaire", href: `/${slug}/payments`, icon: DollarSign,
      roles: ["DIRECTOR", "ADMINISTRATION"],
    },
    {
      label: "Stock & fournitures", href: `/${slug}/shop`, icon: ShoppingBag,
      roles: ["DIRECTOR", "ADMINISTRATION", "ACCOUNTANT", "STOCK_MANAGER", "SECRETARIAT"],
    },
    { separator: true, label: "", sectionLabel: "SERVICES" },
    { label: "Documents officiels", href: `/${slug}/documents`, icon: FileText },
    { label: "Communication", href: `/${slug}/messages`, icon: MessageSquare },
    { separator: true, label: "", sectionLabel: "ADMIN" },
    {
      label: "Configuration", href: `/${slug}/settings`, icon: Settings,
      roles: ["DIRECTOR", "ADMINISTRATION"],
    },
  ];
}

function filterNavByRole(items: NavItem[], role: string): NavItem[] {
  const adminRoles = ["CENTRAL_ADMIN", "DIRECTOR", "ADMINISTRATION"];
  const teacherItems = [
    "Tableau de bord", "Apprenants", "Structure académique", "Calendrier", "Vacances / Congés", "Assiduité", "Évaluations", "Communication",
  ];
  const parentItems = [
    "Tableau de bord", "Calendrier", "Vacances / Congés", "Communication",
  ];

  if (adminRoles.includes(role)) return items.filter((item) => !item.roles || item.roles.includes(role));

  if (role === "TEACHER") {
    return items.filter((item) => {
      if (item.separator) return true;
      if (!item.label) return true;
      return teacherItems.includes(item.label);
    });
  }

  if (role === "PARENT") {
    return items.filter((item) => {
      if (item.separator) return true;
      if (!item.label) return true;
      return parentItems.includes(item.label);
    });
  }

  return items.filter((item) => item.separator || !item.roles || item.roles.includes(role));
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function RoleBadge({ role }: { role: string }) {
  const labels: Record<string, string> = {
    DIRECTOR: "Directeur",
    CENTRAL_ADMIN: "Administration Centrale",
    ADMINISTRATION: "Administration",
    TEACHER: "Enseignant",
    PARENT: "Parent",
    SUPER_ADMIN: "Super Admin",
  };
  const colors: Record<string, string> = {
    DIRECTOR: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    CENTRAL_ADMIN: "bg-amber-500/15 text-amber-300 border-amber-500/25",
    ADMINISTRATION: "bg-blue-500/15 text-blue-400 border-blue-500/25",
    TEACHER: "bg-purple-500/15 text-purple-400 border-purple-500/25",
    PARENT: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    SUPER_ADMIN: "bg-red-500/15 text-red-400 border-red-500/25",
  };
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", colors[role] || "bg-gray-500/15 text-gray-400 border-gray-500/25")}>
      {labels[role] || role}
    </span>
  );
}

export default function SchoolLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const slug = params.slug as string;

  const [user, setUser] = useState<SchoolUser | null>(null);
  const [institution, setInstitution] = useState<SchoolInstitution | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!isSchoolAuthenticated()) {
      router.replace(`/${slug}/login`);
      return;
    }

    // Fetch user profile
    schoolAuthApi.me().then(({ data }) => {
      if (data) {
        if (data.role === "PARENT") {
          router.replace(`/${slug}/parent/dashboard`);
          return;
        }
        setUser(data);
      } else {
        removeSchoolTokens();
        router.replace(`/${slug}/login`);
      }
      setAuthChecked(true);
    });

    // Fetch institution info
    schoolApi.settings().then(({ data: settingsData }) => {
      // Try to get institution from settings or slug lookup
    });

    schoolAuthApi.getInstitutionBySlug(slug).then(({ data }) => {
      if (data?.institution) setInstitution(data.institution);
    });
  }, [router, slug]);

  const handleLogout = () => {
    removeSchoolTokens();
    router.push(`/${slug}/login`);
  };

  if (!authChecked || !user) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#080d1a]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
          className="h-12 w-12 rounded-full border-2 border-emerald-500/20 border-t-emerald-500"
        />
        <motion.p
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="mt-4 text-sm text-gray-500"
        >
          Chargement…
        </motion.p>
      </div>
    );
  }

  const allNavItems = buildNavItems(slug);
  const navItems = filterNavByRole(allNavItems, user.role);
  const schoolName = institution?.name || slug.toUpperCase();
  const schoolInitials = institution?.name ? getInitials(institution.name) : slug.slice(0, 2).toUpperCase();

  const SidebarContent = () => (
    <>
      {/* Top gradient */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none" />

      {/* Logo / School name */}
      <div className="relative flex items-center h-16 px-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center flex-shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.3)]">
            <span className="text-white font-bold text-xs">{schoolInitials}</span>
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="min-w-0 flex-1"
              >
                <p className="text-white font-bold font-heading text-xs leading-none truncate">
                  {schoolName}
                </p>
                <p className="text-emerald-500/70 text-xs mt-0.5">
                  {user?.role === "CENTRAL_ADMIN" ? "Administration Centrale" : "Portail École"}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/8 transition-colors flex-shrink-0"
        >
          <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.3 }}>
            <ChevronLeft className="w-4 h-4" />
          </motion.div>
        </button>

        {/* Mobile close */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:text-gray-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden scrollbar-none">
        {navItems.map((item, index) => {
          if (item.separator) {
            return (
              <div key={index} className="my-2 mx-4">
                <div className="h-px bg-white/[0.06]" />
                {item.sectionLabel && !collapsed && (
                  <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mt-3 mb-1 px-1">
                    {item.sectionLabel}
                  </p>
                )}
              </div>
            );
          }

          if (!item.href || !item.icon) return null;
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== `/${slug}/dashboard` && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                setMobileOpen(false);
              }}
              className={cn(
                "relative flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group",
                isActive
                  ? "text-white"
                  : "text-gray-400 hover:text-gray-200 hover:bg-white/[0.06]"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId={`activeNav-${slug}`}
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500/25 to-emerald-500/8 border border-emerald-500/20"
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-emerald-500 rounded-r-full" />
              )}

              <Icon
                className={cn(
                  "w-4 h-4 flex-shrink-0 relative z-10 transition-transform duration-200",
                  "group-hover:scale-110",
                  isActive ? "text-emerald-500" : ""
                )}
              />

              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -5 }}
                    transition={{ duration: 0.15 }}
                    className="relative z-10 font-medium truncate flex-1"
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
            "flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/[0.06] transition-colors group",
            collapsed && "justify-center"
          )}
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
            {user?.name ? getInitials(user.name) : user?.phone?.slice(-2) || "US"}
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
                  {user?.name || "Utilisateur"}
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
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-[#080d1a] lg:h-screen lg:overflow-hidden">

      {/* ── Desktop Sidebar ──────────────────────────────── */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="relative hidden lg:flex flex-col h-screen bg-soraSidebar border-r border-white/[0.06] overflow-hidden flex-shrink-0"
      >
        <SidebarContent />
      </motion.aside>

      {/* ── Mobile Sidebar drawer ─────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="school-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              key="school-drawer"
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-72 flex flex-col bg-soraSidebar z-50 lg:hidden shadow-2xl"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main area ─────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 lg:overflow-hidden">

        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center h-16 px-4 lg:px-6 border-b border-white/[0.06] bg-[#080d1a]/90 backdrop-blur-xl shrink-0">

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-gray-400 hover:text-white hover:bg-white/[0.08] transition-all mr-3 touch-feedback"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* School info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* School icon – mobile */}
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-xs font-bold text-white shadow-[0_0_12px_rgba(16,185,129,0.25)] lg:hidden">
              {schoolInitials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate leading-none">{schoolName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {user && <RoleBadge role={user.role} />}
              </div>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button className="relative flex h-9 w-9 items-center justify-center rounded-2xl text-gray-500 hover:bg-white/[0.06] hover:text-white transition-all touch-feedback">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </button>
            <button
              onClick={handleLogout}
              className="flex h-9 items-center gap-1.5 rounded-2xl px-3 text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all touch-feedback"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Déco.</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-4 lg:p-6 min-h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
