"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Calendar,
  CalendarDays,
  CalendarOff,
  CheckSquare,
  ChevronLeft,
  FileText,
  Folder,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  School,
  Shield,
  Star,
  User,
  X,
  Bell,
  Clock,
} from "lucide-react";
import { isSchoolAuthenticated, removeSchoolTokens } from "@/lib/school-auth";
import { schoolAuthApi, type SchoolUser } from "@/lib/school-api";
import { useBranding } from "@/lib/branding";
import { cn } from "@/lib/utils";

/* ── Nav config ─────────────────────────────────────────── */
const bottomNavItems = (slug: string) => [
  { label: "Accueil",    href: `/${slug}/teacher/dashboard`,        icon: LayoutDashboard, color: "text-violet-400"  },
  { label: "Élèves",     href: `/${slug}/teacher/mes-eleves`,       icon: GraduationCap,   color: "text-blue-400"   },
  { label: "Notes",      href: `/${slug}/teacher/notes`,            icon: Star,            color: "text-amber-400"  },
  { label: "Présences",  href: `/${slug}/teacher/presences`,        icon: CheckSquare,     color: "text-emerald-400"},
  { label: "Plus",       href: "",                                   icon: MoreHorizontal,  color: "text-gray-400"   },
];

const moreItems = (slug: string) => [
  { label: "Mes classes",       href: `/${slug}/teacher/mes-classes`,       icon: School,       color: "from-violet-500 to-purple-600"  },
  { label: "Emploi du temps",   href: `/${slug}/teacher/emploi-du-temps`,   icon: Calendar,     color: "from-blue-500 to-cyan-500"      },
  { label: "Devoirs",           href: `/${slug}/teacher/devoirs`,           icon: BookOpen,     color: "from-amber-500 to-orange-500"   },
  { label: "Examens",           href: `/${slug}/teacher/examens`,           icon: FileText,     color: "from-emerald-500 to-teal-500"   },
  { label: "Calendrier",        href: `/${slug}/teacher/calendrier`,        icon: CalendarDays, color: "from-sky-500 to-blue-600"       },
  { label: "Congés",            href: `/${slug}/teacher/conges`,            icon: CalendarOff,  color: "from-rose-500 to-pink-500"      },
  { label: "Discipline",        href: `/${slug}/teacher/discipline`,        icon: Shield,       color: "from-red-500 to-rose-600"       },
  { label: "Documents",         href: `/${slug}/teacher/documents`,         icon: Folder,       color: "from-indigo-500 to-violet-500"  },
  { label: "Messagerie",        href: `/${slug}/teacher/messagerie`,        icon: MessageSquare,color: "from-teal-500 to-emerald-500"   },
  { label: "Mon pointage",      href: `/${slug}/teacher/pointage`,          icon: Clock,        color: "from-blue-500 to-sky-600"       },
  { label: "Mon profil",        href: `/${slug}/teacher/mon-profil`,        icon: User,         color: "from-gray-500 to-slate-600"     },
];

const sidebarItems = (slug: string) => [
  { label: "Tableau de bord",    href: `/${slug}/teacher/dashboard`,       icon: LayoutDashboard },
  { sep: true, label: "MES COURS" },
  { label: "Mes classes",        href: `/${slug}/teacher/mes-classes`,     icon: School },
  { label: "Mes élèves",         href: `/${slug}/teacher/mes-eleves`,      icon: GraduationCap },
  { label: "Emploi du temps",    href: `/${slug}/teacher/emploi-du-temps`, icon: Calendar },
  { label: "Calendrier",         href: `/${slug}/teacher/calendrier`,      icon: CalendarDays },
  { sep: true, label: "PÉDAGOGIE" },
  { label: "Présences",          href: `/${slug}/teacher/presences`,       icon: CheckSquare },
  { label: "Notes & saisie",     href: `/${slug}/teacher/notes`,           icon: Star },
  { label: "Devoirs",            href: `/${slug}/teacher/devoirs`,         icon: BookOpen },
  { label: "Examens & bulletins",href: `/${slug}/teacher/examens`,         icon: FileText },
  { label: "Vacances / Congés",  href: `/${slug}/teacher/conges`,          icon: CalendarOff },
  { label: "Discipline",         href: `/${slug}/teacher/discipline`,      icon: Shield },
  { sep: true, label: "SERVICES" },
  { label: "Documents",          href: `/${slug}/teacher/documents`,       icon: Folder },
  { label: "Messagerie",         href: `/${slug}/teacher/messagerie`,      icon: MessageSquare },
  { sep: true, label: "MON ESPACE" },
  { label: "Mon profil",         href: `/${slug}/teacher/mon-profil`,      icon: User },
] as const;

function getInitials(a?: string, b?: string) {
  return ((a?.[0] || "") + (b?.[0] || "")).toUpperCase() || "EN";
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5)  return { text: "Bonne nuit",    emoji: "🌙" };
  if (h < 12) return { text: "Bonjour",        emoji: "👋" };
  if (h < 18) return { text: "Bon après-midi", emoji: "☀️" };
  return             { text: "Bonsoir",         emoji: "🌆" };
}

/* ── Loader ─────────────────────────────────────────────── */
function Loader() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#080d1a]">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        className="h-12 w-12 rounded-full border-2 border-violet-500/20 border-t-violet-500"
      />
      <motion.p
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="mt-4 text-sm text-gray-500"
      >
        Chargement de votre espace enseignant…
      </motion.p>
    </div>
  );
}

/* ── Layout ─────────────────────────────────────────────── */
export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const params   = useParams();
  const pathname = usePathname();
  const slug     = params.slug as string;

  const [user, setUser]             = useState<SchoolUser | null>(null);
  const [collapsed, setCollapsed]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen]     = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const { branding } = useBranding();

  useEffect(() => {
    if (!isSchoolAuthenticated()) { router.replace(`/${slug}/login`); return; }
    schoolAuthApi.me().then(({ data }) => {
      if (!data) { removeSchoolTokens(); router.replace(`/${slug}/login`); return; }
      if (data.role !== "TEACHER") { setAccessDenied(true); setAuthChecked(true); return; }
      setUser(data);
      setAuthChecked(true);
    });
  }, [router, slug]);

  useEffect(() => { setMoreOpen(false); setMobileOpen(false); }, [pathname]);

  const handleLogout = () => { removeSchoolTokens(); router.push(`/${slug}/login`); };

  if (!authChecked) return <Loader />;

  if (accessDenied) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#080d1a] p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-red-500/10">
            <Shield className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="text-lg font-bold text-white">Accès refusé</h1>
          <p className="mt-2 text-sm text-gray-400">Cet espace est réservé aux enseignants.</p>
          <button onClick={handleLogout} className="mt-6 rounded-2xl bg-white/10 px-5 py-2.5 text-sm text-white transition hover:bg-white/15 touch-feedback">
            Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  const firstName   = (user as any)?.firstName;
  const lastName    = (user as any)?.lastName;
  const displayName = user?.name || [firstName, lastName].filter(Boolean).join(" ") || "Enseignant";
  const initials    = getInitials(firstName, lastName);
  const greeting    = getGreeting();

  const bottomItems = bottomNavItems(slug);
  const extra       = moreItems(slug);
  const sidebar     = sidebarItems(slug);

  function isActive(href: string) {
    if (!href) return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  const moreActive = extra.some((i) => isActive(i.href));

  /* ── Desktop sidebar ──────────────────────────────────── */
  const DesktopSidebar = () => (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="relative hidden h-screen shrink-0 flex-col overflow-hidden border-r border-white/[0.06] bg-soraSidebar lg:flex"
    >
      {/* Glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-violet-500/8 to-transparent" />

      {/* Header */}
      <div className="relative flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.06] px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 text-xs font-bold text-white shadow-[0_0_16px_rgba(139,92,246,0.3)]">
          {initials}
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-white leading-tight">Espace Enseignant</p>
              <p className="text-[11px] text-violet-400/70 mt-0.5">/{slug}</p>
            </motion.div>
          )}
        </AnimatePresence>
        <button onClick={() => setCollapsed(!collapsed)} className="ml-auto rounded-xl p-1.5 text-gray-600 transition hover:bg-white/8 hover:text-gray-300">
          <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.3 }}>
            <ChevronLeft className="h-4 w-4" />
          </motion.div>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 scrollbar-none">
        {sidebar.map((item: any, i) => {
          if (item.sep) {
            return (
              <div key={i} className="mx-4 mb-1 mt-3">
                <div className="h-px bg-white/[0.06]" />
                {!collapsed && <p className="mt-2 px-1 text-[10px] font-bold uppercase tracking-widest text-gray-600">{item.label}</p>}
              </div>
            );
          }
          if (!item.href || !item.icon) return null;
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href}
              className={cn("group relative mx-2 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all",
                active ? "text-white" : "text-gray-500 hover:bg-white/[0.04] hover:text-white"
              )}
            >
              {active && (
                <motion.div layoutId="teacherActiveNav"
                  className="absolute inset-0 rounded-2xl bg-gradient-to-r from-violet-500/25 to-violet-500/8 border border-violet-500/20"
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                />
              )}
              {active && <div className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-violet-500" />}
              <Icon className={cn("relative z-10 h-4 w-4 shrink-0 transition-transform group-hover:scale-110", active && "text-violet-400")} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -5 }} transition={{ duration: 0.15 }}
                    className="relative z-10 flex-1 truncate font-medium"
                  >{item.label}</motion.span>
                )}
              </AnimatePresence>
              {collapsed && (
                <div className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-xl border border-white/10 bg-soraDark px-3 py-1.5 text-xs text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                  {item.label}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-soraDark" />
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-white/[0.06] p-3">
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="mb-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-xs font-bold text-white">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-white">{displayName}</p>
                  <p className="text-[11px] text-violet-400/60">Enseignant</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <button onClick={handleLogout}
          className={cn("flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-gray-500 transition hover:bg-red-500/10 hover:text-red-400", collapsed && "justify-center")}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </motion.aside>
  );

  /* ── Mobile sidebar drawer ────────────────────────────── */
  const MobileSidebar = () => (
    <AnimatePresence>
      {mobileOpen && (
        <>
          <motion.div key="t-back"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          />
          <motion.aside key="t-drawer"
            initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-soraSidebar lg:hidden shadow-2xl"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-violet-500/10 to-transparent" />
            <div className="relative flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.06] px-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 text-sm font-bold text-white shadow-lg shadow-violet-500/20">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-white leading-tight">Espace Enseignant</p>
                <p className="text-[11px] text-violet-400/70">/{slug}</p>
              </div>
              <button onClick={() => setMobileOpen(false)} className="rounded-xl p-2 text-gray-500 hover:bg-white/8 hover:text-white touch-feedback">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Profile card */}
            <div className="relative mx-3 mt-3 rounded-2xl border border-violet-500/15 bg-gradient-to-r from-violet-500/10 to-purple-500/5 p-3">
              <p className="text-[13px] font-bold text-white">{displayName}</p>
              <p className="text-[11px] text-violet-400/70 mt-0.5">{greeting.text} {greeting.emoji}</p>
            </div>

            <nav className="mt-3 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4 scrollbar-none">
              {sidebar.map((item: any, i) => {
                if (item.sep) return (
                  <div key={i} className="mx-1 mb-1 mt-3">
                    <div className="h-px bg-white/[0.06]" />
                    <p className="mt-2 px-2 text-[10px] font-bold uppercase tracking-widest text-gray-600">{item.label}</p>
                  </div>
                );
                if (!item.href || !item.icon) return null;
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <motion.div key={item.href}
                    initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 + 0.05 }}
                  >
                    <Link href={item.href}
                      className={cn("flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all",
                        active ? "bg-violet-500/12 text-white font-semibold" : "text-gray-400 hover:bg-white/[0.04] hover:text-white"
                      )}
                    >
                      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition", active ? "bg-violet-400/15" : "bg-white/[0.04]")}>
                        <Icon className={cn("h-4 w-4", active ? "text-violet-400" : "text-gray-600")} />
                      </div>
                      {item.label}
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            <div className="shrink-0 border-t border-white/[0.06] p-3">
              <button onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-gray-500 transition hover:bg-red-500/10 hover:text-red-400 touch-feedback"
              >
                <LogOut className="h-4 w-4" /> Déconnexion
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );

  /* ── Mobile top header ────────────────────────────────── */
  const MobileHeader = () => (
    <header className="mobile-header lg:hidden">
      <div className="flex h-full items-center gap-3 px-4">
        <button onClick={() => setMobileOpen(true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 text-xs font-bold text-white shadow-md shadow-violet-500/20 touch-feedback"
        >
          {initials}
        </button>
        <div className="flex-1 min-w-0">
          <p className="truncate text-[13px] font-bold text-white leading-tight">{displayName}</p>
          <p className="text-[11px] text-violet-400/70">{greeting.text}, Enseignant</p>
        </div>
        <button className="relative rounded-2xl p-2 text-gray-400 hover:bg-white/[0.06] hover:text-white touch-feedback">
          <Bell className="h-5 w-5" />
        </button>
      </div>
    </header>
  );

  /* ── Bottom tab nav ───────────────────────────────────── */
  const BottomNav = () => (
    <nav className="bottom-nav animate-bottom-nav lg:hidden">
      <div className="flex items-center justify-around px-2 py-2">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const isMore = item.label === "Plus";
          const active = isMore ? moreActive || moreOpen : isActive(item.href);

          if (isMore) {
            return (
              <button key="more" onClick={() => setMoreOpen(!moreOpen)}
                className="relative flex flex-col items-center gap-1 px-3 py-1 touch-feedback"
              >
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-200",
                  moreActive || moreOpen ? "bg-gray-400/15 scale-110" : "bg-white/[0.04]"
                )}>
                  <motion.div animate={{ rotate: moreOpen ? 90 : 0 }} transition={{ duration: 0.2 }}>
                    <MoreHorizontal className={cn("h-5 w-5 transition", moreActive || moreOpen ? "text-gray-300" : "text-gray-600")} />
                  </motion.div>
                </div>
                <span className={cn("text-[10px] font-medium transition", moreActive || moreOpen ? "text-gray-300" : "text-gray-600")}>Plus</span>
              </button>
            );
          }

          return (
            <Link key={item.href} href={item.href}
              className="relative flex flex-col items-center gap-1 px-3 py-1 touch-feedback"
            >
              <div className={cn("relative flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-200",
                active ? "scale-110" : "bg-white/[0.04]"
              )}>
                {active && (
                  <motion.div layoutId="teacherBottomActive"
                    className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-400/20 to-violet-600/10"
                  />
                )}
                <Icon className={cn("relative z-10 h-5 w-5 transition-all duration-200", active ? item.color : "text-gray-600")} />
              </div>
              <span className={cn("text-[10px] font-medium transition", active ? "text-white" : "text-gray-600")}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );

  /* ── More drawer ──────────────────────────────────────── */
  const MoreDrawer = () => (
    <AnimatePresence>
      {moreOpen && (
        <>
          <motion.div key="t-more-back"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setMoreOpen(false)}
            className="fixed inset-0 z-40 lg:hidden"
          />
          <motion.div key="t-more-sheet"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 400 }}
            className="fixed bottom-[76px] left-0 right-0 z-50 lg:hidden"
          >
            <div className="mx-3 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0d1528]/98 backdrop-blur-2xl shadow-2xl">
              <div className="flex justify-center pt-3 pb-1">
                <div className="h-1 w-10 rounded-full bg-white/20" />
              </div>
              <p className="px-4 pb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-600">
                Toutes les sections
              </p>
              <div className="grid grid-cols-4 gap-1.5 p-3 pt-0">
                {extra.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <motion.div key={item.href}
                      initial={{ opacity: 0, y: 10, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <Link href={item.href}
                        className="flex flex-col items-center gap-1.5 rounded-2xl p-2.5 touch-feedback hover:bg-white/[0.04]"
                      >
                        <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br", item.color)}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-center text-[10px] font-medium text-gray-400 leading-tight">{item.label}</span>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
              <div className="border-t border-white/[0.06] p-3 mt-1">
                <button onClick={handleLogout}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-red-400 hover:bg-red-500/10 touch-feedback transition"
                >
                  <LogOut className="h-4 w-4" /> Déconnexion
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <div className="flex min-h-screen bg-[#080d1a]">
      <DesktopSidebar />
      <MobileSidebar />
      <MobileHeader />
      <BottomNav />
      <MoreDrawer />

      <main className={cn(
        "flex-1 min-w-0 min-h-screen transition-all duration-300",
        "pt-16 pb-28 lg:pt-0 lg:pb-0",
        collapsed ? "lg:ml-[72px]" : "lg:ml-0"
      )}>
        {/* Desktop header */}
        <header className="sticky top-0 z-30 hidden h-16 shrink-0 items-center border-b border-white/[0.06] bg-[#080d1a]/90 px-6 backdrop-blur-xl lg:flex">
          <div className="flex flex-1 items-center gap-3 min-w-0">
            <p className="text-sm font-bold text-white">{displayName}</p>
            <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-400">
              Enseignant
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button className="flex h-9 w-9 items-center justify-center rounded-2xl text-gray-500 hover:bg-white/[0.06] hover:text-white transition">
              <Bell className="h-4 w-4" />
            </button>
            <button onClick={handleLogout}
              className="flex h-9 items-center gap-2 rounded-2xl px-3 text-sm text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition touch-feedback"
            >
              <LogOut className="h-4 w-4" />
              <span>Déco.</span>
            </button>
          </div>
        </header>

        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
