"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  School,
  GraduationCap,
  Calendar,
  CalendarDays,
  CalendarOff,
  CheckSquare,
  Star,
  BookOpen,
  FileText,
  Shield,
  Folder,
  MessageSquare,
  User,
  LogOut,
  ChevronLeft,
  Menu,
  X,
} from "lucide-react";
import { isSchoolAuthenticated, removeSchoolTokens } from "@/lib/school-auth";
import { schoolAuthApi, type SchoolUser } from "@/lib/school-api";
import { useBranding } from "@/lib/branding";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href?: string;
  icon?: React.ElementType;
  separator?: boolean;
  sectionLabel?: string;
}

function buildTeacherNavItems(slug: string): NavItem[] {
  return [
    { label: "Tableau de bord", href: `/${slug}/teacher/dashboard`, icon: LayoutDashboard },
    { separator: true, label: "", sectionLabel: "MES COURS" },
    { label: "Mes classes", href: `/${slug}/teacher/mes-classes`, icon: School },
    { label: "Mes élèves", href: `/${slug}/teacher/mes-eleves`, icon: GraduationCap },
    { label: "Mon emploi du temps", href: `/${slug}/teacher/emploi-du-temps`, icon: Calendar },
    { label: "Calendrier", href: `/${slug}/teacher/calendrier`, icon: CalendarDays },
    { separator: true, label: "", sectionLabel: "PÉDAGOGIE" },
    { label: "Présences", href: `/${slug}/teacher/presences`, icon: CheckSquare },
    { label: "Notes & saisie", href: `/${slug}/teacher/notes`, icon: Star },
    { label: "Devoirs", href: `/${slug}/teacher/devoirs`, icon: BookOpen },
    { label: "Examens & bulletins", href: `/${slug}/teacher/examens`, icon: FileText },
    { label: "Vacances / Congés", href: `/${slug}/teacher/conges`, icon: CalendarOff },
    { label: "Discipline", href: `/${slug}/teacher/discipline`, icon: Shield },
    { separator: true, label: "", sectionLabel: "SERVICES" },
    { label: "Documents", href: `/${slug}/teacher/documents`, icon: Folder },
    { label: "Messagerie", href: `/${slug}/teacher/messagerie`, icon: MessageSquare },
    { separator: true, label: "", sectionLabel: "MON ESPACE" },
    { label: "Mon profil", href: `/${slug}/teacher/mon-profil`, icon: User },
  ];
}

function getInitials(firstName?: string, lastName?: string): string {
  const f = firstName?.[0] || "";
  const l = lastName?.[0] || "";
  return (f + l).toUpperCase() || "EN";
}

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const slug = params.slug as string;

  const [user, setUser] = useState<SchoolUser | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const { branding } = useBranding();

  useEffect(() => {
    if (!isSchoolAuthenticated()) {
      router.replace(`/${slug}/login`);
      return;
    }

    schoolAuthApi.me().then(({ data }) => {
      if (!data) {
        removeSchoolTokens();
        router.replace(`/${slug}/login`);
        return;
      }
      if (data.role !== "TEACHER") {
        setAccessDenied(true);
        setAuthChecked(true);
        return;
      }
      setUser(data);
      setAuthChecked(true);
    });
  }, [router, slug]);

  const handleLogout = () => {
    removeSchoolTokens();
    router.push(`/${slug}/login`);
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-soraDark flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-soraDark flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/15 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white font-heading mb-2">Accès refusé</h1>
          <p className="text-gray-400 text-sm mb-6">Accès réservé aux enseignants</p>
          <p className="mb-6 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-gray-400">
            Besoin d’aide ? Contact support : {branding.supportEmail} · {branding.supportPhone}
          </p>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl bg-white/10 text-white text-sm hover:bg-white/15 transition-colors"
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  const navItems = buildTeacherNavItems(slug);
  const firstName = (user as (SchoolUser & { firstName?: string }))?.firstName;
  const lastName = (user as (SchoolUser & { lastName?: string }))?.lastName;
  const displayName = user?.name || (firstName && lastName ? `${firstName} ${lastName}` : "Enseignant");
  const initials = getInitials(firstName, lastName) || getInitials(displayName.split(" ")[0], displayName.split(" ")[1]);

  const SidebarContent = () => (
    <>
      {/* Top gradient accent */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-violet-500/8 to-transparent pointer-events-none" />

      {/* Logo */}
      <div className="relative flex items-center h-16 px-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center flex-shrink-0 shadow-[0_0_12px_rgba(139,92,246,0.3)]">
            <GraduationCap className="w-4 h-4 text-white" />
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
                  Espace Enseignant
                </p>
                <p className="text-violet-400/70 text-xs mt-0.5 truncate">/{slug}</p>
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
            (item.href !== `/${slug}/teacher/dashboard` && pathname.startsWith(item.href));

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
                  layoutId={`activeTeacherNav-${slug}`}
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-500/25 to-violet-500/8 border border-violet-500/20"
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-violet-500 rounded-r-full" />
              )}

              <Icon
                className={cn(
                  "w-4 h-4 flex-shrink-0 relative z-10 transition-transform duration-200 group-hover:scale-110",
                  isActive ? "text-violet-400" : ""
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
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
            {initials}
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
                <p className="text-sm font-medium text-white truncate">{displayName}</p>
                <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/25 font-medium mt-0.5">
                  Enseignant
                </span>
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
    <div className="flex h-screen overflow-hidden bg-soraDark">
      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="relative hidden lg:flex flex-col h-screen bg-soraSidebar border-r border-white/[0.06] overflow-hidden flex-shrink-0"
      >
        <SidebarContent />
      </motion.aside>

      {/* Mobile Sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="fixed left-0 top-0 bottom-0 w-64 flex flex-col bg-soraSidebar border-r border-white/[0.06] z-50 lg:hidden"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center h-16 px-4 lg:px-6 border-b border-white/[0.06] bg-soraDark/80 backdrop-blur-xl">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/8 transition-all mr-3"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate leading-none">{displayName}</p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">Espace enseignant · /{slug}</p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/25 font-medium hidden sm:inline">
              Enseignant
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-px h-6 bg-white/10" />
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Déconnexion</span>
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
