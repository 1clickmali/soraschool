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
  CreditCard,
  Clock,
  BarChart2,
  Globe,
  CalendarCheck,
  AlertTriangle,
  Lock,
  RefreshCw,
  Users,
  QrCode,
  Briefcase,
  FileSignature,
  UserCog,
  WalletCards,
  ClipboardCheck,
} from "lucide-react";
import { isSchoolAuthenticated, removeSchoolTokens } from "@/lib/school-auth";
import { schoolAuthApi, type SchoolUser, type SchoolInstitution, schoolApiRequest } from "@/lib/school-api";
import { schoolApi } from "@/lib/school-api";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useUiLanguage, uiText, type UiLanguage } from "@/lib/ui-language";

interface NavItem {
  id?: string;
  label: string;
  href?: string;
  icon?: React.ElementType;
  separator?: boolean;
  sectionLabel?: string;
  roles?: string[];
}

// Routes always accessible even when school year is expired
const YEAR_EXEMPT_PATHS = [
  "/rapports",
  "/abonnement",
  "/abonnement-annees",
  "/notifications",
];

function isYearExemptPath(pathname: string): boolean {
  return YEAR_EXEMPT_PATHS.some((p) => pathname.includes(p));
}

function buildNavItems(slug: string, language: UiLanguage): NavItem[] {
  const t = (fr: string, en: string) => uiText(language, fr, en);
  return [
    { id: "dashboard", label: t("Tableau de bord", "Dashboard"), href: `/${slug}/dashboard`, icon: LayoutDashboard },
    { id: "campuses", label: t("Mes établissements", "My campuses"), href: `/${slug}/etablissements`, icon: Building2, roles: ["CENTRAL_ADMIN"] },
    { separator: true, label: "", sectionLabel: t("ACADÉMIQUE", "ACADEMICS") },
    { id: "students", label: t("Apprenants", "Learners"), href: `/${slug}/students`, icon: GraduationCap },
    {
      id: "teachers", label: t("Enseignants", "Teachers"), href: `/${slug}/teachers`, icon: BookOpen,
      roles: ["DIRECTOR", "ADMINISTRATION"],
    },
    { id: "structure", label: t("Structure académique", "Academic structure"), href: `/${slug}/classes`, icon: LayoutGrid },
    {
      id: "programs", label: t("Programmes & matières", "Programs & subjects"), href: `/${slug}/subjects`, icon: Library,
      roles: ["DIRECTOR", "ADMINISTRATION"],
    },
    { id: "schedule", label: t("Emploi du temps", "Timetable"), href: `/${slug}/schedule`, icon: Calendar },
    { id: "calendar", label: t("Calendrier scolaire", "School calendar"), href: `/${slug}/calendar`, icon: CalendarDays },
    { id: "attendance", label: t("Assiduité", "Attendance"), href: `/${slug}/attendance`, icon: CheckSquare },
    { id: "grades", label: t("Évaluations", "Assessments"), href: `/${slug}/grades`, icon: Star },
    {
      id: "discipline", label: t("Vie scolaire", "Student life"), href: `/${slug}/discipline`, icon: Shield,
      roles: ["DIRECTOR", "ADMINISTRATION"],
    },
    { separator: true, label: "", sectionLabel: t("FINANCE", "FINANCE") },
    {
      id: "finance", label: t("Finance", "Finance"), href: `/${slug}/payments`, icon: DollarSign,
      roles: ["DIRECTOR", "ADMINISTRATION"],
    },
    {
      id: "budget", label: t("Budget", "Budget"), href: `/${slug}/budget`, icon: WalletCards,
      roles: ["DIRECTOR", "ACCOUNTANT", "ADMINISTRATION"],
    },
    {
      id: "stock", label: t("Stock & fournitures", "Stock & supplies"), href: `/${slug}/shop`, icon: ShoppingBag,
      roles: ["DIRECTOR", "ADMINISTRATION", "ACCOUNTANT", "STOCK_MANAGER", "SECRETARIAT"],
    },
    { separator: true, label: "", sectionLabel: t("SERVICES", "SERVICES") },
    { id: "documents", label: t("Documents officiels", "Official documents"), href: `/${slug}/documents`, icon: FileText },
    { id: "communication", label: t("Communication", "Communication"), href: `/${slug}/messages`, icon: MessageSquare },
    { separator: true, label: "", sectionLabel: t("RH & PERSONNEL", "HR & STAFF") },
    {
      id: "staff", label: t("Personnel", "Staff"), href: `/${slug}/personnel`, icon: Users,
      roles: ["DIRECTOR", "ADMINISTRATION"],
    },
    {
      id: "staff-attendance", label: t("Pointage du personnel", "Staff check-in"), href: `/${slug}/pointage-personnel`, icon: Clock,
      roles: ["DIRECTOR", "ADMINISTRATION", "SECRETARIAT", "ACCOUNTANT"],
    },
    {
      id: "tablet-checkin", label: t("Pointage tablette", "Tablet check-in"), href: `/${slug}/pointage-tablette`, icon: QrCode,
      roles: ["DIRECTOR"],
    },
    {
      id: "justifications", label: t("Justifications RH", "HR justifications"), href: `/${slug}/justifications-personnel`, icon: AlertTriangle,
      roles: ["DIRECTOR", "ADMINISTRATION"],
    },
    {
      id: "payroll", label: t("Paie du personnel", "Staff payroll"), href: `/${slug}/paie-personnel`, icon: Briefcase,
      roles: ["DIRECTOR", "ACCOUNTANT"],
    },
    {
      id: "contracts", label: t("Contrats du personnel", "Staff contracts"), href: `/${slug}/contrats-personnel`, icon: FileSignature,
      roles: ["DIRECTOR", "ADMINISTRATION", "ACCOUNTANT"],
    },
    {
      id: "roles", label: t("Rôles & permissions", "Roles & permissions"), href: `/${slug}/roles-personnel`, icon: UserCog,
      roles: ["DIRECTOR"],
    },
    { separator: true, label: "", sectionLabel: t("ADMIN", "ADMIN") },
    {
      id: "reports", label: t("Rapports & statistiques", "Reports & analytics"), href: `/${slug}/rapports`, icon: BarChart2,
      roles: ["DIRECTOR", "CENTRAL_ADMIN", "ACCOUNTANT", "SECRETARIAT", "ADMINISTRATION", "TEACHER"],
    },
    {
      id: "admissions", label: t("Admissions & décisions", "Admissions & decisions"), href: `/${slug}/decisions-annuelles`, icon: CalendarCheck,
      roles: ["DIRECTOR", "CENTRAL_ADMIN", "ADMINISTRATION", "SECRETARIAT"],
    },
    {
      id: "enrollment-review", label: t("Inscriptions à valider", "Enrollment review"), href: `/${slug}/inscriptions-validation`, icon: ClipboardCheck,
      roles: ["DIRECTOR", "CENTRAL_ADMIN", "ADMINISTRATION"],
    },
    {
      id: "year-subscription", label: t("Abonnement scolaire", "School-year subscription"), href: `/${slug}/abonnement-annees`, icon: CalendarDays,
      roles: ["DIRECTOR", "CENTRAL_ADMIN"],
    },
    {
      id: "country-config", label: t("Pays & programmes", "Countries & programs"), href: `/${slug}/config-pays`, icon: Globe,
      roles: ["SUPER_ADMIN"],
    },
    {
      id: "subscription", label: t("Mon abonnement", "My subscription"), href: `/${slug}/abonnement`, icon: CreditCard,
      roles: ["DIRECTOR"],
    },
    {
      id: "settings", label: t("Configuration", "Settings"), href: `/${slug}/settings`, icon: Settings,
      roles: ["DIRECTOR", "ADMINISTRATION"],
    },
  ];
}

function filterNavByRole(items: NavItem[], role: string): NavItem[] {
  const adminRoles = ["CENTRAL_ADMIN", "DIRECTOR", "ADMINISTRATION"];
  const teacherItems = [
    "dashboard", "students", "structure", "calendar", "attendance", "grades", "reports", "communication",
  ];
  const parentItems = [
    "dashboard", "calendar", "communication",
  ];

  if (adminRoles.includes(role)) return items.filter((item) => !item.roles || item.roles.includes(role));

  if (role === "TEACHER") {
    return items.filter((item) => {
      if (item.separator) return true;
      if (!item.label) return true;
      return item.id ? teacherItems.includes(item.id) : false;
    });
  }

  if (role === "PARENT") {
    return items.filter((item) => {
      if (item.separator) return true;
      if (!item.label) return true;
      return item.id ? parentItems.includes(item.id) : false;
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
    ACCOUNTANT: "Comptable",
    SECRETARIAT: "Secrétariat",
  };
  const colors: Record<string, string> = {
    DIRECTOR: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    CENTRAL_ADMIN: "bg-amber-500/15 text-amber-300 border-amber-500/25",
    ADMINISTRATION: "bg-blue-500/15 text-blue-400 border-blue-500/25",
    TEACHER: "bg-purple-500/15 text-purple-400 border-purple-500/25",
    PARENT: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    SUPER_ADMIN: "bg-red-500/15 text-red-400 border-red-500/25",
    ACCOUNTANT: "bg-teal-500/15 text-teal-400 border-teal-500/25",
    SECRETARIAT: "bg-sky-500/15 text-sky-400 border-sky-500/25",
  };
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", colors[role] || "bg-gray-500/15 text-gray-400 border-gray-500/25")}>
      {labels[role] || role}
    </span>
  );
}

interface SubscriptionYearSummary {
  total: number;
  isCurrentlyActive: boolean;
  activeYear: { id: string; schoolYearLabel: string; yearLabel?: string; endsAt: string } | null;
  nextYear: { id: string; schoolYearLabel: string; yearLabel?: string; status: string } | null;
  expiredYear: { id: string; schoolYearLabel: string; yearLabel?: string; endsAt: string } | null;
}

export default function SchoolLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const slug = params.slug as string;
  const { language } = useUiLanguage();

  const [user, setUser] = useState<SchoolUser | null>(null);
  const [institution, setInstitution] = useState<SchoolInstitution | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [yearExpired, setYearExpired] = useState(false);
  const [expiredLabel, setExpiredLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!isSchoolAuthenticated()) {
      router.replace(`/${slug}/login`);
      return;
    }

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

    schoolAuthApi.getInstitutionBySlug(slug).then(({ data }) => {
      if (data?.institution) {
        setInstitution(data.institution);
        if (["EXPIRED", "PENDING_PAYMENT"].includes(data.institution.status)) {
          setYearExpired(true);
          setExpiredLabel(data.institution.activeAcademicYearName ?? null);
        }
      }
    });

    // Check if school year is expired
    schoolApiRequest<{ summary: SubscriptionYearSummary }>("/api/subscription-years/summary").then((res) => {
      if (!res.error && res.data) {
        const { summary } = res.data;
        // Has subscription years but none currently active → blocked
        if (summary.total > 0 && !summary.isCurrentlyActive) {
          setYearExpired(true);
          setExpiredLabel(summary.expiredYear?.schoolYearLabel ?? summary.expiredYear?.yearLabel ?? null);
        }
      }
    });

    const loadUnread = () =>
      schoolApi.notifications(true).then(({ data }) => {
        if (data) setUnreadCount(data.unreadCount);
      });
    loadUnread();
    const interval = setInterval(loadUnread, 60_000);
    return () => clearInterval(interval);
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

  const allNavItems = buildNavItems(slug, language);
  const navItems = filterNavByRole(allNavItems, user.role);
  const schoolName = institution?.name || slug.toUpperCase();
  const schoolInitials = institution?.name ? getInitials(institution.name) : slug.slice(0, 2).toUpperCase();

  const SidebarContent = () => (
    <>
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none" />

      {/* Logo / School name */}
      <div className="relative flex items-center h-16 px-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.3)]",
            yearExpired
              ? "bg-gradient-to-br from-amber-600 to-amber-800"
              : "bg-gradient-to-br from-emerald-500 to-emerald-700"
          )}>
            {yearExpired
              ? <Lock className="w-4 h-4 text-white" />
              : <span className="text-white font-bold text-xs">{schoolInitials}</span>
            }
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
                <p className={cn("text-xs mt-0.5", yearExpired ? "text-amber-500/80" : "text-emerald-500/70")}>
                  {yearExpired ? "Accès restreint" : user?.role === "CENTRAL_ADMIN" ? "Administration Centrale" : "Portail École"}
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

        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:text-gray-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Year-expired mini banner in sidebar */}
      {yearExpired && !collapsed && (
        <div className="mx-3 mt-3 mb-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="text-xs font-semibold text-amber-300">Accès restreint</span>
          </div>
          <p className="text-[10px] text-amber-400/80 leading-tight">
            {expiredLabel ? `Année ${expiredLabel} terminée.` : "Année scolaire terminée."}
            {" "}Renouvelez pour débloquer.
          </p>
          <Link
            href={`/${slug}/abonnement-annees`}
            className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-amber-300 hover:text-amber-200 transition-colors"
          >
            <RefreshCw className="w-2.5 h-2.5" /> Renouveler maintenant
          </Link>
        </div>
      )}

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

          const isBlocked = yearExpired && !isYearExemptPath(item.href);

          if (isBlocked) {
            return (
              <div
                key={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "relative flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl text-sm cursor-not-allowed select-none group",
                  "text-gray-700 opacity-40"
                )}
              >
                <div className="relative">
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && (
                    <Lock className="absolute -right-1 -bottom-1 w-2 h-2 text-amber-500" />
                  )}
                </div>
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -5 }}
                      transition={{ duration: 0.15 }}
                      className="font-medium truncate flex-1 line-through decoration-amber-600/40"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {collapsed && (
                  <div className="absolute left-full ml-3 px-3 py-1.5 bg-soraDark border border-amber-500/20 rounded-lg text-xs text-amber-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-xl z-50">
                    🔒 {item.label} — Année scolaire expirée
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
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
    <div className="sora-academy-shell flex min-h-screen bg-[#080d1a] lg:h-screen lg:overflow-hidden">

      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="sora-academy-sidebar relative hidden lg:flex flex-col h-screen bg-soraSidebar border-r border-white/[0.06] overflow-hidden flex-shrink-0"
      >
        <SidebarContent />
      </motion.aside>

      {/* Mobile Sidebar drawer */}
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
              className="sora-academy-sidebar fixed left-0 top-0 bottom-0 w-72 flex flex-col bg-soraSidebar z-50 lg:hidden shadow-2xl"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 lg:overflow-hidden">

        {/* Year-expired banner — top of content */}
        <AnimatePresence>
          {yearExpired && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 lg:px-6 py-3 bg-amber-500/10 border-b border-amber-500/25">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <p className="flex-1 text-sm text-amber-300">
                  <span className="font-semibold">L’année scolaire est terminée.</span>
                  {" "}Veuillez renouveler votre abonnement pour continuer à utiliser SoraSchool.
                  Les rapports restent disponibles.
                </p>
                <Link
                  href={`/${slug}/abonnement-annees`}
                  className="flex items-center gap-1.5 text-xs font-semibold text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                >
                  <RefreshCw className="w-3 h-3" />
                  Renouveler
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <header className="sora-academy-header sticky top-0 z-30 flex items-center h-16 px-4 lg:px-6 border-b border-white/[0.06] bg-[#080d1a]/90 backdrop-blur-xl shrink-0">

          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-gray-400 hover:text-white hover:bg-white/[0.08] transition-all mr-3 touch-feedback"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-xs font-bold text-white shadow-[0_0_12px_rgba(16,185,129,0.25)] lg:hidden">
              {schoolInitials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate leading-none">{schoolName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {user && <RoleBadge role={user.role} />}
                {yearExpired && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-400 font-medium">
                    <Lock className="w-2.5 h-2.5" /> Accès restreint
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <LanguageSwitcher compact />
            <Link href={`/${slug}/notifications`} className="relative flex h-9 w-9 items-center justify-center rounded-2xl text-gray-500 hover:bg-white/[0.06] hover:text-white transition-all touch-feedback">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
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
