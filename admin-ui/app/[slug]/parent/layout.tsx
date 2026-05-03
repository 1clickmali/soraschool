"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  BookOpen,
  CalendarDays,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  FileText,
  GraduationCap,
  Home,
  LogOut,
  MessageSquareWarning,
  MoreHorizontal,
  ReceiptText,
  Settings,
  Shield,
  User,
  X,
} from "lucide-react";
import { isSchoolAuthenticated, removeSchoolTokens } from "@/lib/school-auth";
import { schoolAuthApi, type SchoolInstitution, type SchoolUser } from "@/lib/school-api";
import { useBranding } from "@/lib/branding";
import { cn } from "@/lib/utils";

/* ── Nav items ─────────────────────────────────────────── */
const mainNavItems = (slug: string) => [
  { label: "Accueil",  href: `/${slug}/parent/dashboard`,  icon: Home,       color: "text-amber-400"  },
  { label: "Enfants",  href: `/${slug}/parent/enfants`,    icon: GraduationCap, color: "text-emerald-400" },
  { label: "Notes",    href: `/${slug}/parent/bulletins`,  icon: BookOpen,   color: "text-blue-400"   },
  { label: "Paiements",href: `/${slug}/parent/paiements`,  icon: ReceiptText,color: "text-purple-400" },
  { label: "Plus",     href: "",                           icon: MoreHorizontal, color: "text-gray-400" },
];

const moreNavItems = (slug: string) => [
  { label: "Calendrier",      href: `/${slug}/parent/calendrier`,  icon: CalendarDays,         color: "from-blue-500 to-cyan-500"    },
  { label: "Vacances",        href: `/${slug}/parent/conges`,      icon: CalendarOff,          color: "from-amber-500 to-orange-500" },
  { label: "Plaintes",        href: `/${slug}/parent/plaintes`,    icon: MessageSquareWarning, color: "from-red-500 to-rose-500"     },
];

const sidebarItems = (slug: string) => [
  { label: "Accueil",          href: `/${slug}/parent/dashboard`,  icon: Home                 },
  { label: "Mes enfants",      href: `/${slug}/parent/enfants`,    icon: GraduationCap        },
  { label: "Calendrier",       href: `/${slug}/parent/calendrier`, icon: CalendarDays         },
  { label: "Vacances / Congés",href: `/${slug}/parent/conges`,     icon: CalendarOff          },
  { label: "Bulletins & notes",href: `/${slug}/parent/bulletins`,  icon: BookOpen             },
  { label: "Reçus de paiement",href: `/${slug}/parent/paiements`,  icon: ReceiptText          },
  { label: "Plaintes",         href: `/${slug}/parent/plaintes`,   icon: MessageSquareWarning },
];

function getInitials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "PA";
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5)  return "Bonne nuit 🌙";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

/* ── Loader ─────────────────────────────────────────────── */
function PremiumLoader() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#080d1a]">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        className="h-12 w-12 rounded-full border-2 border-amber-400/20 border-t-amber-400"
      />
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-4 text-sm text-gray-500"
      >
        Chargement de votre espace…
      </motion.p>
    </div>
  );
}

/* ── Main layout ─────────────────────────────────────────── */
export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const slug = params.slug as string;

  const [user, setUser] = useState<SchoolUser | null>(null);
  const [institution, setInstitution] = useState<SchoolInstitution | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { branding } = useBranding();

  useEffect(() => {
    if (!isSchoolAuthenticated()) { router.replace(`/${slug}/login`); return; }
    schoolAuthApi.me().then(({ data }) => {
      if (!data) { removeSchoolTokens(); router.replace(`/${slug}/login`); return; }
      if (data.role !== "PARENT") {
        router.replace(data.role === "TEACHER" ? `/${slug}/teacher/dashboard` : `/${slug}/dashboard`);
        return;
      }
      setUser(data);
      setAuthChecked(true);
    });
    schoolAuthApi.getInstitutionBySlug(slug).then(({ data }) => {
      if (data?.institution) setInstitution(data.institution);
    });
  }, [router, slug]);

  // close "more" drawer on nav
  useEffect(() => { setMoreOpen(false); setMobileOpen(false); }, [pathname]);

  const handleLogout = () => { removeSchoolTokens(); router.push(`/${slug}/login`); };

  if (!authChecked) return <PremiumLoader />;

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.name || "Parent";
  const firstName   = user?.firstName || displayName.split(" ")[0];
  const initials    = getInitials(user?.firstName, user?.lastName);
  const navItems    = mainNavItems(slug);
  const extraItems  = moreNavItems(slug);
  const sidebar     = sidebarItems(slug);

  // Active tab detection
  function isActive(href: string) {
    if (!href) return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  function activeTab() {
    for (const item of navItems) {
      if (item.href && isActive(item.href)) return item.href;
    }
    for (const item of extraItems) {
      if (isActive(item.href)) return "more";
    }
    return "";
  }
  const currentTab = activeTab();

  /* ── Desktop sidebar ──────────────────────────────────── */
  const DesktopSidebar = () => (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-white/[0.06] bg-[#080d19]/98 backdrop-blur-xl transition-all duration-300 lg:flex",
      collapsed ? "w-20" : "w-72"
    )}>
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-amber-500/8 to-transparent" />

      {/* Header */}
      <div className="relative flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.06] px-4">
        <div className={cn(
          "flex shrink-0 items-center justify-center rounded-2xl font-bold text-white shadow-lg transition-all",
          collapsed ? "h-10 w-10 text-sm" : "h-10 w-10 text-sm",
          "bg-gradient-to-br from-amber-400 to-emerald-500 shadow-amber-500/25"
        )}>
          {institution?.name?.[0]?.toUpperCase() || "E"}
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-white leading-tight">{institution?.name || "Portail Parent"}</p>
              <p className="text-[11px] text-amber-300/70 mt-0.5">Espace parent</p>
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
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 scrollbar-none">
        {sidebar.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link key={item.label} href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all",
                active
                  ? "bg-gradient-to-r from-amber-500/15 to-amber-500/5 text-white"
                  : "text-gray-500 hover:bg-white/[0.04] hover:text-white"
              )}
            >
              {active && (
                <motion.div layoutId="activeSidebar"
                  className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-amber-400"
                />
              )}
              <Icon className={cn("h-4 w-4 shrink-0 transition",
                active ? "text-amber-300" : "text-gray-600 group-hover:text-amber-300/70"
              )} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="truncate font-medium"
                  >{item.label}</motion.span>
                )}
              </AnimatePresence>
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
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-emerald-500 text-xs font-bold text-white">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-white">{displayName}</p>
                  <p className="text-[11px] text-amber-300/60">Parent lecture seule</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <button onClick={handleLogout}
          className={cn("flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-gray-500 transition hover:bg-red-500/10 hover:text-red-400",
            collapsed && "justify-center"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  );

  /* ── Mobile sidebar drawer ────────────────────────────── */
  const MobileSidebar = () => (
    <AnimatePresence>
      {mobileOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          />
          <motion.aside
            key="drawer"
            initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-[#080d19] lg:hidden"
          >
            {/* Glow */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-amber-500/10 to-transparent" />

            {/* Header */}
            <div className="relative flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.06] px-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-emerald-500 text-sm font-bold text-white shadow-lg shadow-amber-500/20">
                {institution?.name?.[0]?.toUpperCase() || "E"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-white leading-tight">{institution?.name || "Portail Parent"}</p>
                <p className="text-[11px] text-amber-300/70">Espace parent</p>
              </div>
              <button onClick={() => setMobileOpen(false)} className="rounded-xl p-1.5 text-gray-500 hover:bg-white/8 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Profile card */}
            <div className="relative mx-3 mt-3 rounded-2xl bg-gradient-to-r from-amber-500/10 to-emerald-500/5 border border-amber-500/15 p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-emerald-500 text-sm font-bold text-white">
                  {initials}
                </div>
                <div>
                  <p className="text-[13px] font-bold text-white">{displayName}</p>
                  <p className="text-[11px] text-amber-300/70">{getGreeting()}</p>
                </div>
              </div>
            </div>

            {/* Nav */}
            <nav className="mt-3 flex-1 space-y-1 overflow-y-auto px-3 pb-4 scrollbar-none">
              {sidebar.map((item, i) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <motion.div key={item.label}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 + 0.1 }}
                  >
                    <Link href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition-all",
                        active
                          ? "bg-amber-500/12 text-white font-semibold"
                          : "text-gray-400 hover:bg-white/[0.04] hover:text-white"
                      )}
                    >
                      <div className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition",
                        active ? "bg-amber-400/15" : "bg-white/[0.04]"
                      )}>
                        <Icon className={cn("h-4 w-4", active ? "text-amber-300" : "text-gray-500")} />
                      </div>
                      {item.label}
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            {/* Logout */}
            <div className="shrink-0 border-t border-white/[0.06] p-3">
              <button onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-gray-500 transition hover:bg-red-500/10 hover:text-red-400"
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
        {/* Avatar / menu toggle */}
        <button onClick={() => setMobileOpen(true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-emerald-500 text-xs font-bold text-white shadow-md shadow-amber-500/20 touch-feedback"
        >
          {initials}
        </button>

        {/* Center info */}
        <div className="flex-1 min-w-0">
          <p className="truncate text-[13px] font-bold text-white leading-tight">
            {institution?.name || "Portail parent"}
          </p>
          <p className="text-[11px] text-amber-300/70">
            {getGreeting()}, {firstName}
          </p>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <button className="relative rounded-2xl p-2 text-gray-400 hover:bg-white/[0.06] hover:text-white touch-feedback">
            <Bell className="h-5 w-5" />
            <span className="notif-dot" />
          </button>
        </div>
      </div>
    </header>
  );

  /* ── Bottom navigation bar ────────────────────────────── */
  const BottomNav = () => {
    const moreActive = currentTab === "more" || moreOpen;
    return (
      <nav className="bottom-nav animate-bottom-nav lg:hidden">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isMore = item.label === "Plus";
            const active = isMore ? moreActive : isActive(item.href);

            if (isMore) {
              return (
                <button key="more"
                  onClick={() => setMoreOpen(!moreOpen)}
                  className="relative flex flex-col items-center gap-1 px-3 py-1 touch-feedback"
                >
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-200",
                    moreActive ? "bg-gray-400/15 scale-110" : "bg-white/[0.04]"
                  )}>
                    <motion.div animate={{ rotate: moreOpen ? 90 : 0 }} transition={{ duration: 0.2 }}>
                      <MoreHorizontal className={cn("h-5 w-5 transition", moreActive ? "text-gray-300" : "text-gray-600")} />
                    </motion.div>
                  </div>
                  <span className={cn("text-[10px] font-medium transition", moreActive ? "text-gray-300" : "text-gray-600")}>
                    Plus
                  </span>
                </button>
              );
            }

            return (
              <Link key={item.href} href={item.href}
                className="relative flex flex-col items-center gap-1 px-3 py-1 touch-feedback"
              >
                <div className={cn(
                  "relative flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-200",
                  active ? "scale-110" : "bg-white/[0.04]"
                )}>
                  {active && (
                    <motion.div
                      layoutId="bottomNavActive"
                      className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-600/10"
                    />
                  )}
                  <Icon className={cn("relative z-10 h-5 w-5 transition-all duration-200",
                    active ? item.color : "text-gray-600"
                  )} />
                </div>
                <span className={cn("text-[10px] font-medium transition",
                  active ? "text-white" : "text-gray-600"
                )}>
                  {item.label}
                </span>
                {active && (
                  <motion.div layoutId="bottomDot"
                    className="absolute -bottom-1 h-1 w-1 rounded-full bg-amber-400"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    );
  };

  /* ── "More" drawer (slides up from bottom) ────────────── */
  const MoreDrawer = () => (
    <AnimatePresence>
      {moreOpen && (
        <>
          <motion.div
            key="more-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setMoreOpen(false)}
            className="fixed inset-0 z-40 lg:hidden"
          />
          <motion.div
            key="more-sheet"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 400 }}
            className="fixed bottom-[76px] left-0 right-0 z-50 lg:hidden"
          >
            <div className="mx-3 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0d1528]/98 backdrop-blur-2xl shadow-2xl">
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="h-1 w-10 rounded-full bg-white/20" />
              </div>
              <p className="px-4 pb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-600">
                Plus d'options
              </p>
              <div className="grid grid-cols-3 gap-2 p-3 pt-0">
                {extraItems.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <motion.div key={item.href}
                      initial={{ opacity: 0, y: 12, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: i * 0.06 }}
                    >
                      <Link href={item.href}
                        className="flex flex-col items-center gap-2 rounded-2xl p-3 touch-feedback hover:bg-white/[0.04]"
                      >
                        <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br", item.color)}>
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-center text-[12px] font-medium text-gray-300 leading-tight">
                          {item.label}
                        </span>
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
    <div className="min-h-screen bg-[#080d1a]">
      {/* Desktop sidebar */}
      <DesktopSidebar />

      {/* Mobile sidebar drawer */}
      <MobileSidebar />

      {/* Mobile top header */}
      <MobileHeader />

      {/* Bottom nav + more drawer (mobile) */}
      <BottomNav />
      <MoreDrawer />

      {/* Main content */}
      <main className={cn(
        "min-h-screen transition-all duration-300",
        /* mobile: space for top header + bottom nav */
        "pt-16 pb-28 lg:pt-0 lg:pb-0",
        /* desktop: space for sidebar */
        collapsed ? "lg:pl-20" : "lg:pl-72"
      )}>
        {children}
      </main>
    </div>
  );
}
