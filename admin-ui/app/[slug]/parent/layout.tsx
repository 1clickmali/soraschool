"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  CalendarDays,
  CalendarOff,
  FileText,
  GraduationCap,
  Home,
  LogOut,
  Menu,
  MessageSquareWarning,
  ReceiptText,
  Shield,
  X,
} from "lucide-react";
import { isSchoolAuthenticated, removeSchoolTokens } from "@/lib/school-auth";
import { schoolAuthApi, type SchoolInstitution, type SchoolUser } from "@/lib/school-api";
import { useBranding } from "@/lib/branding";
import { cn } from "@/lib/utils";

const navItems = (slug: string) => [
  { label: "Accueil parent", href: `/${slug}/parent/dashboard`, icon: Home },
  { label: "Enfants", href: `/${slug}/parent/enfants`, icon: GraduationCap },
  { label: "Calendrier", href: `/${slug}/parent/calendrier`, icon: CalendarDays },
  { label: "Vacances / Congés", href: `/${slug}/parent/conges`, icon: CalendarOff },
  { label: "Bulletins & notes", href: `/${slug}/parent/bulletins`, icon: FileText },
  { label: "Reçus de paiement", href: `/${slug}/parent/paiements`, icon: ReceiptText },
  { label: "Plaintes", href: `/${slug}/parent/plaintes`, icon: MessageSquareWarning },
];

function getInitials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || "PA";
}

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const slug = params.slug as string;

  const [user, setUser] = useState<SchoolUser | null>(null);
  const [institution, setInstitution] = useState<SchoolInstitution | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
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
      if (data.role !== "PARENT") {
        const nextPath =
          data.role === "TEACHER"
            ? `/${slug}/teacher/dashboard`
            : `/${slug}/dashboard`;
        router.replace(nextPath);
        return;
      }
      setUser(data);
      setAuthChecked(true);
    });

    schoolAuthApi.getInstitutionBySlug(slug).then(({ data }) => {
      if (data?.institution) setInstitution(data.institution);
    });
  }, [router, slug]);

  const handleLogout = () => {
    removeSchoolTokens();
    router.push(`/${slug}/login`);
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-soraDark flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-soraDark flex items-center justify-center p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/15">
            <Shield className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="mb-2 font-heading text-xl font-bold text-white">Accès refusé</h1>
          <p className="mb-6 text-sm text-gray-400">Cet espace est réservé aux parents d’élèves.</p>
          <p className="mb-6 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-gray-400">
            Besoin d’aide ? Contact support : {branding.supportEmail} · {branding.supportPhone}
          </p>
          <button onClick={handleLogout} className="rounded-xl bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15">
            Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  const displayName = user?.name || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Parent";
  const initials = getInitials(user?.firstName, user?.lastName);
  const items = navItems(slug);

  const Sidebar = () => (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-amber-500/10 to-transparent" />
      <div className="relative flex h-16 items-center border-b border-white/[0.06] px-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-emerald-600 text-sm font-bold text-white shadow-[0_0_16px_rgba(245,158,11,0.25)]">
            {initials}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="min-w-0">
                <p className="truncate text-xs font-bold text-white">{institution?.name || "Portail parent"}</p>
                <p className="truncate text-xs text-amber-300/80">Espace parent</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button onClick={() => setCollapsed(!collapsed)} className="hidden rounded-lg p-1.5 text-gray-500 transition hover:bg-white/8 hover:text-gray-300 lg:flex">
          <motion.div animate={{ rotate: collapsed ? 180 : 0 }}>
            <ChevronLeft className="h-4 w-4" />
          </motion.div>
        </button>
        <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 text-gray-500 transition hover:bg-white/8 hover:text-gray-300 lg:hidden">
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="relative flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                active ? "bg-amber-500/12 text-white" : "text-gray-400 hover:bg-white/[0.04] hover:text-white"
              )}
            >
              {active && <motion.div layoutId="activeParentNav" className="absolute inset-y-1 left-0 w-1 rounded-r-full bg-amber-400" />}
              <Icon className={cn("h-5 w-5 shrink-0", active ? "text-amber-300" : "text-gray-500 group-hover:text-amber-300")} />
              <AnimatePresence>{!collapsed && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{item.label}</motion.span>}</AnimatePresence>
            </Link>
          );
        })}
      </nav>

      <div className="relative border-t border-white/[0.06] p-3">
        {!collapsed && (
          <div className="mb-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
            <p className="truncate text-sm font-semibold text-white">{displayName}</p>
            <p className="mt-0.5 text-xs text-amber-300">Parent lecture seule</p>
          </div>
        )}
        <button onClick={handleLogout} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-gray-400 transition hover:bg-red-500/10 hover:text-red-400", collapsed && "justify-center")}>
          <LogOut className="h-5 w-5" />
          {!collapsed && "Déconnexion"}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-soraDark">
      <button onClick={() => setMobileOpen(true)} className="fixed left-4 top-4 z-40 rounded-xl border border-white/10 bg-soraCard/90 p-2 text-white shadow-xl backdrop-blur lg:hidden">
        <Menu className="h-5 w-5" />
      </button>
      <aside className={cn("fixed inset-y-0 left-0 z-30 hidden border-r border-white/[0.06] bg-[#080d19]/95 backdrop-blur-xl transition-all duration-300 lg:flex lg:flex-col", collapsed ? "w-20" : "w-72")}>
        <Sidebar />
      </aside>
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" />
            <motion.aside initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }} className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/[0.06] bg-[#080d19] lg:hidden">
              <Sidebar />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
      <main className={cn("min-h-screen transition-all duration-300", collapsed ? "lg:pl-20" : "lg:pl-72")}>{children}</main>
    </div>
  );
}
