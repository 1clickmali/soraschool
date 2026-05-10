"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  Home,
  LogOut,
  X,
} from "lucide-react";
import { isSchoolAuthenticated, removeSchoolTokens } from "@/lib/school-auth";
import { schoolAuthApi, type SchoolInstitution, type SchoolUser } from "@/lib/school-api";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/ui/language-switcher";

const navItems = (slug: string) => [
  { label: "Accueil", href: `/${slug}/student/dashboard`, icon: Home },
];

function PremiumLoader() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#080d1a]">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        className="h-12 w-12 rounded-full border-2 border-violet-400/20 border-t-violet-400"
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

function getInitials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "EL";
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const slug = params.slug as string;

  const [user, setUser] = useState<SchoolUser | null>(null);
  const [institution, setInstitution] = useState<SchoolInstitution | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isSchoolAuthenticated()) { router.replace(`/${slug}/login`); return; }
    schoolAuthApi.me().then(({ data }) => {
      if (!data) { removeSchoolTokens(); router.replace(`/${slug}/login`); return; }
      if (data.role !== "STUDENT") {
        if (data.role === "TEACHER") router.replace(`/${slug}/teacher/dashboard`);
        else if (data.role === "PARENT") router.replace(`/${slug}/parent/dashboard`);
        else router.replace(`/${slug}/dashboard`);
        return;
      }
      setUser(data);
      setAuthChecked(true);
    });
    schoolAuthApi.getInstitutionBySlug(slug).then(({ data }) => {
      if (data?.institution) setInstitution(data.institution);
    });
  }, [router, slug]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const handleLogout = () => { removeSchoolTokens(); router.push(`/${slug}/login`); };

  if (!authChecked) return <PremiumLoader />;

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Apprenant";
  const firstName = user?.firstName || displayName.split(" ")[0];
  const initials = getInitials(user?.firstName, user?.lastName);
  const items = navItems(slug);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="sora-academy-shell min-h-screen bg-[#080d1a]">
      {/* Desktop sidebar */}
      <aside className={cn(
        "sora-academy-sidebar fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-white/[0.06] bg-[#080d19]/98 backdrop-blur-xl transition-all duration-300 lg:flex",
        collapsed ? "w-20" : "w-72"
      )}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-violet-500/8 to-transparent" />

        <div className="relative flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.06] px-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-sm font-bold text-white shadow-lg shadow-violet-500/25">
            {institution?.name?.[0]?.toUpperCase() || "E"}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-white leading-tight">{institution?.name || "Portail Apprenant"}</p>
                <p className="text-[11px] text-violet-300/70 mt-0.5">Espace apprenant</p>
              </motion.div>
            )}
          </AnimatePresence>
          <button onClick={() => setCollapsed(!collapsed)} className="ml-auto rounded-xl p-1.5 text-gray-600 transition hover:bg-white/8 hover:text-gray-300">
            <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.3 }}>
              <ChevronLeft className="h-4 w-4" />
            </motion.div>
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 scrollbar-none">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link key={item.label} href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all",
                  active
                    ? "bg-gradient-to-r from-violet-500/15 to-violet-500/5 text-white"
                    : "text-gray-500 hover:bg-white/[0.04] hover:text-white"
                )}
              >
                {active && (
                  <motion.div layoutId="studentActiveSidebar"
                    className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-violet-400"
                  />
                )}
                <Icon className={cn("h-4 w-4 shrink-0 transition",
                  active ? "text-violet-300" : "text-gray-600 group-hover:text-violet-300/70"
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

        <div className="shrink-0 border-t border-white/[0.06] p-3">
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="mb-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-bold text-white">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-white">{displayName}</p>
                    <p className="text-[11px] text-violet-300/60">Apprenant</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {!collapsed && <div className="mb-2"><LanguageSwitcher /></div>}
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

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="sora-academy-sidebar fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-[#080d19] lg:hidden"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-violet-500/10 to-transparent" />
              <div className="relative flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.06] px-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-sm font-bold text-white shadow-lg">
                  {institution?.name?.[0]?.toUpperCase() || "E"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-white">{institution?.name || "Portail Apprenant"}</p>
                  <p className="text-[11px] text-violet-300/70">Espace apprenant</p>
                </div>
                <button onClick={() => setMobileOpen(false)} className="rounded-xl p-1.5 text-gray-500 hover:bg-white/8 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="relative mx-3 mt-3 rounded-2xl bg-gradient-to-r from-violet-500/10 to-purple-500/5 border border-violet-500/15 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-sm font-bold text-white">
                    {initials}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-white">{displayName}</p>
                    <p className="text-[11px] text-violet-300/70">Élève</p>
                  </div>
                </div>
              </div>
              <nav className="mt-3 flex-1 space-y-1 overflow-y-auto px-3 pb-4 scrollbar-none">
                {items.map((item, i) => {
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
                          active ? "bg-violet-500/12 text-white font-semibold" : "text-gray-400 hover:bg-white/[0.04] hover:text-white"
                        )}
                      >
                        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition", active ? "bg-violet-400/15" : "bg-white/[0.04]")}>
                          <Icon className={cn("h-4 w-4", active ? "text-violet-300" : "text-gray-500")} />
                        </div>
                        {item.label}
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>
              <div className="shrink-0 border-t border-white/[0.06] p-3">
                <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-gray-500 transition hover:bg-red-500/10 hover:text-red-400">
                  <LogOut className="h-4 w-4" /> Déconnexion
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Mobile header */}
      <header className="sora-academy-header mobile-header lg:hidden">
        <div className="flex h-full items-center gap-3 px-4">
          <button onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-bold text-white shadow-md touch-feedback"
          >
            {initials}
          </button>
          <div className="flex-1 min-w-0">
            <p className="truncate text-[13px] font-bold text-white">{institution?.name || "Portail élève"}</p>
            <p className="text-[11px] text-violet-300/70">Bonjour, {firstName}</p>
          </div>
          <LanguageSwitcher compact />
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav animate-bottom-nav lg:hidden">
        <div className="flex items-center justify-around px-2 py-2">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href}
                className="relative flex flex-col items-center gap-1 px-2 py-1 touch-feedback"
              >
                <div className={cn("relative flex h-10 w-10 items-center justify-center rounded-2xl transition-all duration-200",
                  active ? "scale-110" : "bg-white/[0.04]"
                )}>
                  {active && (
                    <motion.div layoutId="studentBottomActive"
                      className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-400/20 to-violet-600/10"
                    />
                  )}
                  <Icon className={cn("relative z-10 h-5 w-5 transition-all duration-200",
                    active ? "text-violet-300" : "text-gray-600"
                  )} />
                </div>
                <span className={cn("text-[10px] font-medium transition", active ? "text-white" : "text-gray-600")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <main className={cn(
        "min-h-screen transition-all duration-300",
        "pt-16 pb-28 lg:pt-0 lg:pb-0",
        collapsed ? "lg:pl-20" : "lg:pl-72"
      )}>
        {children}
      </main>
    </div>
  );
}
