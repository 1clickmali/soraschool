"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  GraduationCap,
  MessageSquareWarning,
  ReceiptText,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import {
  downloadProtectedFile,
  schoolApi,
  type AttendanceRecord,
  type CreateParentReportInput,
  type Grade,
  type ParentDashboardData,
  type SchoolDocument,
  type Student,
} from "@/lib/school-api";
import { cn } from "@/lib/utils";

/* ── Helpers ─────────────────────────────────────────────── */
const reportTypes: Array<{ value: CreateParentReportInput["type"]; label: string }> = [
  { value: "PLAINTE", label: "Plainte" },
  { value: "ABSENCE", label: "Signaler absence" },
  { value: "MALADIE", label: "Maladie" },
  { value: "URGENCE", label: "Urgence" },
];

export type ParentPortalView = "dashboard" | "children" | "grades" | "payments" | "reports";

function getPortalView(p: string): ParentPortalView {
  if (p.includes("/parent/enfants"))   return "children";
  if (p.includes("/parent/bulletins")) return "grades";
  if (p.includes("/parent/paiements")) return "payments";
  if (p.includes("/parent/plaintes"))  return "reports";
  return "dashboard";
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5)  return { text: "Bonne nuit",    emoji: "🌙" };
  if (h < 12) return { text: "Bonjour",        emoji: "👋" };
  if (h < 18) return { text: "Bon après-midi", emoji: "☀️" };
  return             { text: "Bonsoir",         emoji: "🌆" };
}

function formatDate(v?: string | Date | null) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatMoney(v?: number | null, currency = "XOF") {
  if (v === null || v === undefined) return "—";
  return `${new Intl.NumberFormat("fr-FR").format(v)} ${currency}`;
}

function studentName(s: Student) { return `${s.firstName} ${s.lastName}`.trim(); }

function gradeValue(g: Grade) {
  const score = g.score ?? g.value ?? 0;
  const max   = g.maxScore ?? 20;
  return max ? (score / max) * 20 : score;
}

function periodName(g: Grade) {
  if (typeof g.period === "string") return g.period;
  return g.period?.name || "Période";
}
function periodId(g: Grade) {
  if (typeof g.period === "object") return g.period?.id;
  return g.periodId;
}

function gradeColor(v: number) {
  if (v >= 16) return { text: "text-emerald-400", bg: "bg-emerald-400/10", bar: "bg-emerald-400", label: "Excellent" };
  if (v >= 14) return { text: "text-lime-400",    bg: "bg-lime-400/10",    bar: "bg-lime-400",    label: "Bien" };
  if (v >= 12) return { text: "text-yellow-400",  bg: "bg-yellow-400/10",  bar: "bg-yellow-400",  label: "Assez bien" };
  if (v >= 10) return { text: "text-orange-400",  bg: "bg-orange-400/10",  bar: "bg-orange-400",  label: "Passable" };
  return              { text: "text-red-400",      bg: "bg-red-400/10",     bar: "bg-red-400",     label: "Insuffisant" };
}

function studentFinance(s: Student) {
  const invoices = s.invoices || [];
  const total = invoices.reduce((sum, i) => sum + (i.totalAmount ?? i.amount ?? 0), 0);
  const paid  = invoices.reduce((sum, i) => sum + (i.paidAmount ?? 0), 0);
  const due   = invoices.reduce((sum, i) => sum + Math.max((i.totalAmount ?? i.amount ?? 0) - (i.paidAmount ?? 0), 0), 0);
  return { total, paid, due, count: invoices.length, pct: total > 0 ? Math.round((paid / total) * 100) : 0 };
}

function avgGrade(s: Student) {
  const grades = (s.grades || []).map(gradeValue);
  if (!grades.length) return null;
  return grades.reduce((a, b) => a + b, 0) / grades.length;
}

/* ── Animated counter ────────────────────────────────────── */
function AnimatedNumber({ to, decimals = 0 }: { to: number; decimals?: number }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => v.toFixed(decimals));
  useEffect(() => {
    const ctrl = animate(mv, to, { duration: 1.2, ease: [0.16, 1, 0.3, 1] });
    return ctrl.stop;
  }, [to, mv]);
  return <motion.span>{rounded}</motion.span>;
}

/* ── Stagger variants ─────────────────────────────────────── */
const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  show:   { opacity: 1, y: 0,  scale: 1, transition: { type: "spring", damping: 20, stiffness: 260 } },
};

/* ── Loading skeleton ─────────────────────────────────────── */
function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("animate-shimmer rounded-3xl border border-white/[0.05]", className)} />
  );
}

/* ── MAIN PAGE ─────────────────────────────────────────────── */
export default function ParentDashboardPage() {
  const pathname  = usePathname();
  const view      = getPortalView(pathname);

  const [data, setData]       = useState<ParentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);
  const [sending, setSending] = useState(false);
  const [reportForm, setReportForm] = useState<CreateParentReportInput>({ type: "PLAINTE", childId: "", message: "" });
  const [justifyModal, setJustifyModal] = useState<{ attendanceId: string; date: string } | null>(null);
  const [justifyReason, setJustifyReason] = useState("");

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const load = async () => {
    setLoading(true);
    const { data: d, error } = await schoolApi.parentDashboard();
    if (error) showToast(error, false);
    setData(d);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const children  = useMemo(() => data?.parent.students?.map((l) => l.student) || [], [data]);
  const docsByOwner = useMemo(() => {
    const map = new Map<string, SchoolDocument[]>();
    for (const doc of data?.documents || []) map.set(doc.ownerId, [...(map.get(doc.ownerId) || []), doc]);
    return map;
  }, [data]);

  const firstChild = children[0];
  useEffect(() => {
    if (!reportForm.childId && firstChild) setReportForm((p) => ({ ...p, childId: firstChild.id }));
  }, [firstChild, reportForm.childId]);

  const stats = useMemo(() => {
    const grades    = children.flatMap((c) => c.grades || []);
    const absences  = children.flatMap((c) => c.attendances || []).filter((a) => a.status === "ABSENT" || a.status === "LATE");
    const invoices  = children.flatMap((c) => c.invoices || []);
    const payments  = invoices.flatMap((i) => i.payments || []);
    const totalDue  = invoices.reduce((s, i) => s + Math.max((i.totalAmount ?? i.amount ?? 0) - (i.paidAmount ?? 0), 0), 0);
    return { children: children.length, grades: grades.length, absences: absences.length, payments: payments.length, totalDue };
  }, [children]);

  const openDocument = async (doc: SchoolDocument) => {
    const err = await downloadProtectedFile(doc.fileUrl, doc.title, "open");
    if (err) showToast(err, false);
  };
  const openReceipt = async (id: string, num?: string) => {
    const err = await downloadProtectedFile(`/api/payments/${id}/receipt`, `recu-${num || id}.pdf`, "open");
    if (err) showToast(err, false);
  };
  const openReportCard = async (s: Student, g: Grade) => {
    const id = periodId(g);
    if (!id) { showToast("Impossible de trouver la période.", false); return; }
    const err = await downloadProtectedFile(`/api/grades/report-cards/${s.id}/${id}/pdf`, `bulletin-${s.matricule || s.id}-${periodName(g)}.pdf`, "open");
    if (err) showToast(err, false);
  };
  const openStudentPdf = async (s: Student, kind: "enrollment-form" | "dossier") => {
    const names = {
      "enrollment-form": `fiche-inscription-${s.matricule || s.id}.pdf`,
      dossier: `dossier-${s.matricule || s.id}.pdf`,
    };
    const err = await downloadProtectedFile(`/api/students/${s.id}/${kind}`, names[kind], "open");
    if (err) showToast(err, false);
  };
  const submitReport = async () => {
    if (!reportForm.childId) { showToast("Choisissez l'enfant concerné.", false); return; }
    if (!reportForm.message.trim()) { showToast("Écrivez votre message.", false); return; }
    setSending(true);
    const { error } = await schoolApi.createParentReport({ ...reportForm, message: reportForm.message.trim() });
    setSending(false);
    if (error) { showToast(error, false); return; }
    setReportForm((p) => ({ ...p, message: "" }));
    showToast("Plainte envoyée à la direction et aux enseignants.");
    await load();
  };

  const submitJustification = async () => {
    if (!justifyModal || !justifyReason.trim()) return;
    setSending(true);
    const { error } = await schoolApi.createJustification({
      attendanceId: justifyModal.attendanceId,
      reason: justifyReason.trim(),
    });
    setSending(false);
    if (error) { showToast(error, false); return; }
    setJustifyModal(null);
    setJustifyReason("");
    showToast("Justification envoyée, en attente de validation.");
    await load();
  };

  const greeting = getGreeting();

  /* ────────────────────────────── LOADING ───────────────── */
  if (loading) {
    return (
      <div className="px-4 py-6 space-y-4 sm:px-6">
        <SkeletonCard className="h-44" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} className="h-24" />)}
        </div>
        <SkeletonCard className="h-64" />
        <SkeletonCard className="h-48" />
      </div>
    );
  }

  /* ────────────────────────────── RENDER ────────────────── */
  return (
    <div className="relative min-h-screen">

      {/* ── Toast ──────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={cn(
              "fixed top-20 left-1/2 z-[100] -translate-x-1/2 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur-xl border max-w-xs w-[90vw]",
              toast.ok
                ? "bg-emerald-500/15 border-emerald-500/20 text-emerald-200"
                : "bg-red-500/15 border-red-500/20 text-red-200"
            )}
          >
            {toast.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
            <span className="flex-1">{toast.msg}</span>
            <button onClick={() => setToast(null)}><X className="h-3.5 w-3.5" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal justification absence ──────────────────────── */}
      <AnimatePresence>
        {justifyModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setJustifyModal(null)}
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-sm bg-[#0d1528] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
                  <div>
                    <h2 className="text-sm font-semibold text-white">Justifier une absence</h2>
                    <p className="text-xs text-gray-500 mt-0.5">{new Date(justifyModal.date).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" })}</p>
                  </div>
                  <button onClick={() => setJustifyModal(null)} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs text-gray-500 font-medium mb-1.5 uppercase tracking-wide">Motif de justification</label>
                    <textarea
                      rows={4}
                      value={justifyReason}
                      onChange={(e) => setJustifyReason(e.target.value)}
                      placeholder="Maladie, rendez-vous médical, événement familial…"
                      className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 transition-all resize-none"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setJustifyModal(null)}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.09] text-gray-300 text-sm font-medium transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={submitJustification}
                      disabled={!justifyReason.trim() || sending}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold transition-all"
                    >
                      {sending ? "Envoi…" : "Envoyer"}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="px-4 py-5 space-y-5 sm:px-6 lg:px-8 lg:py-8"
      >

        {/* ══ HERO ════════════════════════════════════════════ */}
        <motion.div variants={itemVariants}>
          <div className="relative overflow-hidden rounded-3xl p-6 sm:p-7">
            {/* Gradient bg */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-[#0d1528] to-emerald-500/10" />
            <div className="absolute inset-0 bg-hero-mesh" />
            {/* Animated orb */}
            <div className="animate-orb pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gradient-to-br from-amber-400/15 to-transparent blur-3xl" />
            <div className="animate-orb delay-300 pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-gradient-to-tr from-emerald-400/10 to-transparent blur-3xl" />
            {/* Border */}
            <div className="absolute inset-0 rounded-3xl border border-amber-500/15" />

            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div>
                <motion.div
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
                  className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-200"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Espace parent sécurisé
                </motion.div>
                <motion.h1
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                  className="font-heading text-2xl font-bold text-white sm:text-3xl"
                >
                  {greeting.text}&nbsp;
                  <span className="animate-wave inline-block">{greeting.emoji}</span>
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
                  className="mt-2 text-sm text-gray-300/80 max-w-sm"
                >
                  {view === "dashboard" && "Suivez la scolarité de vos enfants en temps réel."}
                  {view === "children" && "Dossier, présences et documents de chaque enfant."}
                  {view === "grades" && "Évaluations publiées et bulletins PDF disponibles."}
                  {view === "payments" && "Factures, reçus et suivi des paiements scolaires."}
                  {view === "reports" && "Envoyez un signalement ou une demande à l'école."}
                </motion.p>
              </div>

              <button onClick={load}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.1] touch-feedback backdrop-blur"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="hidden sm:inline">Actualiser</span>
              </button>
            </div>

            {/* Stats row */}
            {view === "dashboard" && (
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
              >
                <HeroStat icon={GraduationCap} label="Enfants suivis" value={stats.children} color="text-amber-400" iconBg="bg-amber-400/15" />
                <HeroStat icon={BookOpen} label="Évaluations publiées" value={stats.grades} color="text-blue-400" iconBg="bg-blue-400/15" />
                <HeroStat icon={ReceiptText} label="Reçus payés" value={stats.payments} color="text-emerald-400" iconBg="bg-emerald-400/15" />
                <HeroStat icon={AlertTriangle} label="Abs. / retards" value={stats.absences} color="text-rose-400" iconBg="bg-rose-400/15" />
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* ══ REPORTS PAGE ═══════════════════════════════════ */}
        {view === "reports" && (
          <div className="grid gap-5 lg:grid-cols-2">
            <motion.div variants={itemVariants}><ReportForm form={reportForm} setForm={setReportForm} children={children} sending={sending} onSubmit={submitReport} /></motion.div>
            <motion.div variants={itemVariants}><ReportsList reports={data?.reports} /></motion.div>
          </div>
        )}

        {/* ══ GRADES PAGE ════════════════════════════════════ */}
        {view === "grades" && (
          <div className="space-y-5">
            {children.length === 0 ? <EmptyState title="Aucun enfant lié" text="Demandez à l'administration de lier votre compte au dossier de l'élève." /> : (
              children.map((child, i) => (
                <motion.div key={child.id} variants={itemVariants} custom={i}>
                  <GradesCard child={child} onOpenReportCard={openReportCard} />
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* ══ PAYMENTS PAGE ══════════════════════════════════ */}
        {view === "payments" && (
          <div className="space-y-5">
            {children.length === 0 ? <EmptyState title="Aucun enfant lié" text="Demandez à l'administration de lier votre compte au dossier de l'élève." /> : (
              children.map((child, i) => (
                <motion.div key={child.id} variants={itemVariants} custom={i}>
                  <PaymentsCard child={child} onOpenReceipt={openReceipt} onDownloadPdf={(id, n) => downloadProtectedFile(`/api/payments/invoices/${id}/pdf`, `facture-${n || id}.pdf`, "open")} />
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* ══ DASHBOARD + CHILDREN VIEWS ═════════════════════ */}
        {(view === "dashboard" || view === "children") && (
          <>
            {children.length === 0 ? (
              <motion.div variants={itemVariants}>
                <EmptyState
                  title="Aucun enfant lié à ce compte"
                  text="Contactez l'administration de l'établissement pour lier votre numéro de téléphone au dossier de votre enfant."
                />
              </motion.div>
            ) : (
              <div className={cn("grid gap-5", view === "dashboard" && children.length === 1 && "lg:grid-cols-[1.4fr_0.6fr]")}>
                {/* Children cards */}
                <div className="space-y-5">
                  {children.map((child, i) => (
                    <motion.div key={child.id} variants={itemVariants} custom={i}>
                      <ChildCard
                        child={child}
                        docs={docsByOwner.get(child.id) || []}
                        showDetail={view === "children"}
                        onOpenStudentPdf={openStudentPdf}
                        onOpenDocument={openDocument}
                        onOpenReportCard={openReportCard}
                        onJustify={(a) => { setJustifyModal({ attendanceId: a.id, date: a.date }); setJustifyReason(""); }}
                      />
                    </motion.div>
                  ))}
                </div>

                {/* Right column on dashboard (lg) */}
                {view === "dashboard" && (
                  <div className="space-y-5">
                    <motion.div variants={itemVariants}><ReportForm form={reportForm} setForm={setReportForm} children={children} sending={sending} onSubmit={submitReport} compact /></motion.div>
                    <motion.div variants={itemVariants}><ReportsList reports={data?.reports} compact /></motion.div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   HERO STAT CARD
════════════════════════════════════════════════════════════ */
function HeroStat({ icon: Icon, label, value, color, iconBg }: {
  icon: React.ElementType; label: string; value: number; color: string; iconBg: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.05] p-3 backdrop-blur">
      <div className={cn("mb-2 flex h-8 w-8 items-center justify-center rounded-xl", iconBg)}>
        <Icon className={cn("h-4 w-4", color)} />
      </div>
      <p className={cn("text-2xl font-bold tabular-nums", color)}>
        <AnimatedNumber to={value} />
      </p>
      <p className="mt-0.5 text-[11px] text-gray-500">{label}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CHILD CARD
════════════════════════════════════════════════════════════ */
function ChildCard({ child, docs, showDetail, onOpenStudentPdf, onOpenDocument, onOpenReportCard, onJustify }: {
  child: Student;
  docs: SchoolDocument[];
  showDetail: boolean;
  onOpenStudentPdf: (s: Student, k: "enrollment-form" | "dossier") => void;
  onOpenDocument: (d: SchoolDocument) => void;
  onOpenReportCard: (s: Student, g: Grade) => void;
  onJustify: (a: AttendanceRecord) => void;
}) {
  const finance = studentFinance(child);
  const avg     = avgGrade(child);
  const avgC    = avg !== null ? gradeColor(avg) : null;
  const grades  = child.grades || [];
  const invoices = child.invoices || [];
  const absences = (child.attendances || []).filter((a) => a.status === "ABSENT" || a.status === "LATE");
  const periods = grades.filter((g, i, l) => periodId(g) && l.findIndex((x) => periodId(x) === periodId(g)) === i);

  return (
    <div className="overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.025]">

      {/* Header */}
      <div className="relative overflow-hidden p-5 pb-4">
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="relative">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-amber-500 text-lg font-bold text-white shadow-lg shadow-emerald-500/20">
                {child.firstName?.[0]}{child.lastName?.[0]}
              </div>
              {avg !== null && avgC && (
                <div className={cn("absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#0d1528]", avgC.bg)}>
                  <Star className={cn("h-2.5 w-2.5", avgC.text)} />
                </div>
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">{studentName(child)}</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {child.classroom?.name || "Classe non affectée"}
                {child.matricule && <span className="ml-2 font-mono text-xs text-gray-600">#{child.matricule}</span>}
              </p>
            </div>
          </div>

          {/* Avg + Finance badges */}
          <div className="flex flex-wrap gap-2">
            {avg !== null && avgC && (
              <div className={cn("flex items-center gap-1.5 rounded-2xl border px-3 py-1.5", avgC.bg, "border-current/10")}>
                <TrendingUp className={cn("h-3.5 w-3.5", avgC.text)} />
                <span className={cn("text-sm font-bold", avgC.text)}>{avg.toFixed(1)}/20</span>
                <span className="text-[10px] text-gray-500 hidden sm:block">{avgC.label}</span>
              </div>
            )}
            {finance.count > 0 && (
              <div className={cn(
                "flex items-center gap-1.5 rounded-2xl border px-3 py-1.5",
                finance.due > 0 ? "bg-amber-500/10 border-amber-500/20" : "bg-emerald-500/10 border-emerald-500/20"
              )}>
                <ReceiptText className={cn("h-3.5 w-3.5", finance.due > 0 ? "text-amber-400" : "text-emerald-400")} />
                <span className={cn("text-sm font-bold", finance.due > 0 ? "text-amber-300" : "text-emerald-300")}>
                  {finance.due > 0 ? `${finance.pct}%` : "✓"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Payment progress bar */}
        {finance.count > 0 && finance.total > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs text-gray-500">
              <span>Scolarité payée : {finance.pct}%</span>
              <span>{formatMoney(finance.paid)} / {formatMoney(finance.total)}</span>
            </div>
            <div className="progress-bar-track">
              <motion.div
                className={cn("progress-bar-fill", finance.pct >= 100 ? "bg-emerald-400" : finance.pct >= 60 ? "bg-amber-400" : "bg-red-400")}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(finance.pct, 100)}%` }}
                transition={{ duration: 1.2, delay: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 overflow-x-auto px-5 pb-4 scrollbar-none">
        <ActionChip icon={FileText} label="Fiche inscription" onClick={() => onOpenStudentPdf(child, "enrollment-form")} />
        <ActionChip icon={FileText} label="Attestation" onClick={() => downloadProtectedFile(`/api/grades/certificates/${child.id}/pdf?type=SCHOOL_CERTIFICATE`, `attestation-${child.matricule || child.id}.pdf`, "open")} variant="green" />
      </div>

      {/* Grades */}
      {grades.length > 0 && (
        <div className="border-t border-white/[0.05] px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">Évaluations & bulletins</h3>
            </div>
            {periods.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {periods.map((g) => (
                  <button key={periodId(g)} onClick={() => onOpenReportCard(child, g)}
                    className="inline-flex items-center gap-1 rounded-xl bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/20 transition touch-feedback"
                  >
                    <Download className="h-3 w-3" />
                    {periodName(g)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            {grades.slice(0, 5).map((grade) => {
              const v = gradeValue(grade);
              const c = gradeColor(v);
              return (
                <motion.div key={grade.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="truncate text-sm font-medium text-gray-200">{grade.subject?.name || "Matière"}</span>
                      <span className={cn("ml-2 shrink-0 text-sm font-bold tabular-nums", c.text)}>{v.toFixed(1)}</span>
                    </div>
                    <div className="progress-bar-track">
                      <motion.div
                        className={cn("progress-bar-fill", c.bar)}
                        initial={{ width: 0 }}
                        animate={{ width: `${(v / 20) * 100}%` }}
                        transition={{ duration: 0.9, delay: 0.1, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail (children view) */}
      {showDetail && (
        <div className="grid gap-4 border-t border-white/[0.05] p-5 sm:grid-cols-2">
          <InfoPanel title="Dossier" icon={UserRound}>
            <div className="space-y-2">
              <InfoRow label="Classe"      value={child.classroom?.name || "—"} />
              <InfoRow label="Matricule"   value={child.matricule || "—"} />
              <InfoRow label="Né(e) le"   value={formatDate(child.birthDate || child.dateOfBirth)} />
              <InfoRow label="Tél. parent" value={child.parentPhone || "—"} />
              <InfoRow label="Statut"      value={child.status || "Actif"} />
            </div>
          </InfoPanel>
          <InfoPanel title="Absences & retards" icon={AlertTriangle}>
            {absences.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                </div>
                <p className="text-sm text-gray-500">Aucun retard ou absence signalé.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {absences.slice(0, 6).map((a) => {
                  const justif = a.justification;
                  const canJustify = !justif && (a.status === "ABSENT" || a.status === "LATE");
                  return (
                    <div key={a.id} className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2 gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className={cn("h-2 w-2 rounded-full flex-shrink-0", a.status === "LATE" ? "bg-amber-400" : "bg-red-400")} />
                        <span className="text-sm text-gray-300">{a.status === "LATE" ? "Retard" : "Absence"}</span>
                        <span className="text-xs text-gray-600">{formatDate(a.date)}</span>
                      </div>
                      <div className="flex-shrink-0">
                        {justif ? (
                          <span className={cn(
                            "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
                            justif.status === "PENDING"  && "bg-amber-500/10 text-amber-300 border-amber-500/20",
                            justif.status === "APPROVED" && "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
                            justif.status === "REJECTED" && "bg-red-500/10 text-red-300 border-red-500/20",
                          )}>
                            {justif.status === "PENDING" ? "En attente" : justif.status === "APPROVED" ? "Acceptée" : "Refusée"}
                          </span>
                        ) : canJustify ? (
                          <button
                            onClick={() => onJustify(a)}
                            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                          >
                            <Clock className="h-3 w-3" />
                            Justifier
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </InfoPanel>
        </div>
      )}

      {/* Documents */}
      {docs.length > 0 && (
        <div className="border-t border-white/[0.05] px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-white">Documents disponibles</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {docs.slice(0, showDetail ? docs.length : 4).map((doc) => (
              <button key={doc.id} onClick={() => onOpenDocument(doc)}
                className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition hover:bg-white/[0.05] touch-feedback"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/10">
                  <FileText className="h-4 w-4 text-purple-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-200">{doc.title}</p>
                  <p className="text-[11px] text-gray-600">{formatDate(doc.createdAt)}</p>
                </div>
                <Download className="h-4 w-4 shrink-0 text-amber-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Payments (compact) */}
      {invoices.length > 0 && !showDetail && (
        <div className="border-t border-white/[0.05] px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Dernières factures</h3>
          </div>
          <div className="space-y-2">
            {invoices.slice(0, 3).map((inv) => {
              const total = inv.totalAmount ?? inv.amount ?? 0;
              const balance = Math.max(total - (inv.paidAmount ?? 0), 0);
              return (
                <div key={inv.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-200">{inv.title || inv.number || "Facture"}</p>
                    <p className="text-[11px] text-gray-600 mt-0.5">Reste : {formatMoney(balance)}</p>
                  </div>
                  <span className={cn("shrink-0 rounded-xl px-2.5 py-1 text-[11px] font-bold",
                    inv.status === "PAID" ? "bg-emerald-500/15 text-emerald-300" :
                    inv.status === "PARTIALLY_PAID" ? "bg-amber-500/15 text-amber-300" :
                    "bg-rose-500/15 text-rose-300"
                  )}>
                    {inv.status === "PAID" ? "Payé" : inv.status === "PARTIALLY_PAID" ? "Partiel" : "En attente"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   GRADES CARD (grades page)
════════════════════════════════════════════════════════════ */
function GradesCard({ child, onOpenReportCard }: { child: Student; onOpenReportCard: (s: Student, g: Grade) => void }) {
  const grades  = child.grades || [];
  const avg     = avgGrade(child);
  const avgC    = avg !== null ? gradeColor(avg) : null;
  const periods = grades.filter((g, i, l) => periodId(g) && l.findIndex((x) => periodId(x) === periodId(g)) === i);

  return (
    <div className="overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.025]">
      <div className="flex items-center justify-between border-b border-white/[0.05] p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-amber-500 text-sm font-bold text-white">
            {child.firstName?.[0]}{child.lastName?.[0]}
          </div>
          <div>
            <p className="font-bold text-white">{studentName(child)}</p>
            <p className="text-sm text-gray-500">{child.classroom?.name || "Classe non affectée"}</p>
          </div>
        </div>
        {avg !== null && avgC && (
          <div className={cn("flex items-center gap-2 rounded-2xl border px-3 py-2", avgC.bg, "border-current/10")}>
            <Zap className={cn("h-4 w-4", avgC.text)} />
            <span className={cn("text-base font-bold tabular-nums", avgC.text)}>{avg.toFixed(2)}/20</span>
          </div>
        )}
      </div>

      {periods.length > 0 && (
        <div className="flex flex-wrap gap-2 border-b border-white/[0.05] px-5 py-3">
          <p className="w-full text-[11px] font-semibold uppercase tracking-wider text-gray-600 mb-1">Télécharger bulletins</p>
          {periods.map((g) => (
            <button key={periodId(g)} onClick={() => onOpenReportCard(child, g)}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition touch-feedback"
            >
              <Download className="h-3.5 w-3.5" />
              Bulletin — {periodName(g)}
            </button>
          ))}
        </div>
      )}

      <div className="p-5 space-y-3">
        {grades.length === 0 ? (
          <EmptyState title="Aucune note publiée" text="Les notes seront visibles dès leur publication par l'école." small />
        ) : (
          grades.map((grade) => {
            const v = gradeValue(grade);
            const c = gradeColor(v);
            return (
              <div key={grade.id} className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{grade.subject?.name || "Matière"}</p>
                    <p className="text-[11px] text-gray-600">{periodName(grade)} {grade.appreciation ? `· ${grade.appreciation}` : ""}</p>
                  </div>
                  <div className={cn("flex shrink-0 items-center gap-1.5 rounded-2xl px-3 py-1.5 border", c.bg, "border-current/10")}>
                    <span className={cn("text-base font-bold tabular-nums", c.text)}>{v.toFixed(1)}</span>
                    <span className="text-gray-600 text-xs">/20</span>
                  </div>
                </div>
                <div className="progress-bar-track">
                  <motion.div
                    className={cn("progress-bar-fill", c.bar)}
                    initial={{ width: 0 }}
                    animate={{ width: `${(v / 20) * 100}%` }}
                    transition={{ duration: 0.9, ease: "easeOut" }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAYMENTS CARD (payments page)
════════════════════════════════════════════════════════════ */
function PaymentsCard({ child, onOpenReceipt, onDownloadPdf }: {
  child: Student;
  onOpenReceipt: (id: string, num?: string) => void;
  onDownloadPdf: (id: string, n?: string) => void;
}) {
  const finance  = studentFinance(child);
  const invoices = child.invoices || [];

  return (
    <div className="overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.025]">
      <div className="p-5 border-b border-white/[0.05]">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-amber-500 text-sm font-bold text-white">
            {child.firstName?.[0]}{child.lastName?.[0]}
          </div>
          <div>
            <p className="font-bold text-white">{studentName(child)}</p>
            <p className="text-sm text-gray-500">{child.classroom?.name}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
            <p className="text-[11px] text-gray-600 mb-1">Total</p>
            <p className="text-sm font-bold text-white tabular-nums">{formatMoney(finance.total)}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
            <p className="text-[11px] text-emerald-600 mb-1">Payé</p>
            <p className="text-sm font-bold text-emerald-300 tabular-nums">{formatMoney(finance.paid)}</p>
          </div>
          <div className={cn("rounded-2xl border p-3 text-center", finance.due > 0 ? "border-amber-500/20 bg-amber-500/5" : "border-emerald-500/20 bg-emerald-500/5")}>
            <p className={cn("text-[11px] mb-1", finance.due > 0 ? "text-amber-600" : "text-emerald-600")}>Reste dû</p>
            <p className={cn("text-sm font-bold tabular-nums", finance.due > 0 ? "text-amber-300" : "text-emerald-300")}>{formatMoney(finance.due)}</p>
          </div>
        </div>
        {finance.total > 0 && (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[11px] text-gray-600">
              <span>Progression</span><span>{finance.pct}%</span>
            </div>
            <div className="progress-bar-track">
              <motion.div
                className={cn("progress-bar-fill", finance.pct >= 100 ? "bg-emerald-400" : finance.pct >= 60 ? "bg-amber-400" : "bg-red-400")}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(finance.pct, 100)}%` }}
                transition={{ duration: 1.2, delay: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="p-5 space-y-3">
        {invoices.length === 0 ? (
          <EmptyState title="Aucune facture" text="Aucune facture disponible pour le moment." small />
        ) : (
          invoices.map((inv) => {
            const total = inv.totalAmount ?? inv.amount ?? 0;
            const balance = Math.max(total - (inv.paidAmount ?? 0), 0);
            const pct = total > 0 ? Math.round(((inv.paidAmount ?? 0) / total) * 100) : 0;
            return (
              <div key={inv.id} className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.025]">
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{inv.title || inv.number || "Facture"}</p>
                    <p className="text-[11px] text-gray-600 mt-0.5">Total : {formatMoney(total)} · Reste : {formatMoney(balance)}</p>
                    <div className="mt-2 progress-bar-track">
                      <motion.div className={cn("progress-bar-fill", pct >= 100 ? "bg-emerald-400" : "bg-amber-400")}
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.9, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                  <span className={cn("shrink-0 rounded-xl px-2.5 py-1 text-[11px] font-bold",
                    inv.status === "PAID" ? "bg-emerald-500/15 text-emerald-300" :
                    inv.status === "PARTIALLY_PAID" ? "bg-amber-500/15 text-amber-300" :
                    "bg-rose-500/15 text-rose-300"
                  )}>
                    {inv.status === "PAID" ? "Payé" : inv.status === "PARTIALLY_PAID" ? "Partiel" : "En attente"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-white/[0.05] px-4 py-3">
                  <button onClick={() => onDownloadPdf(inv.id, inv.number)}
                    className="rounded-xl bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/[0.1] transition touch-feedback"
                  >
                    Facture PDF
                  </button>
                  {(inv.payments || []).map((p) => (
                    <button key={p.id} onClick={() => onOpenReceipt(p.id, p.receiptNumber)}
                      className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/15 transition touch-feedback"
                    >
                      Reçu {p.receiptNumber || ""}
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   REPORT FORM
════════════════════════════════════════════════════════════ */
function ReportForm({ form, setForm, children, sending, onSubmit, compact = false }: {
  form: CreateParentReportInput;
  setForm: React.Dispatch<React.SetStateAction<CreateParentReportInput>>;
  children: Student[];
  sending: boolean;
  onSubmit: () => void;
  compact?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.025]">
      <div className="flex items-center gap-3 border-b border-white/[0.05] p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-500/10">
          <MessageSquareWarning className="h-4 w-4 text-amber-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white">Porter plainte / signaler</h3>
          {!compact && <p className="text-[11px] text-gray-500">Votre message sera transmis à la direction</p>}
        </div>
      </div>
      <div className="space-y-3 p-4">
        <select value={form.childId || ""} onChange={(e) => setForm({ ...form, childId: e.target.value })}
          className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-amber-400/40 [&>option]:bg-[#111827]"
        >
          <option value="">— Choisir l'enfant —</option>
          {children.map((c) => <option key={c.id} value={c.id}>{studentName(c)}</option>)}
        </select>
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CreateParentReportInput["type"] })}
          className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white focus:border-amber-400/40 [&>option]:bg-[#111827]"
        >
          {reportTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
          placeholder="Expliquez le problème, la demande ou l'urgence…"
          rows={compact ? 3 : 4}
          className="w-full resize-none rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-amber-400/40"
        />
        <button onClick={onSubmit} disabled={sending}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 py-3 text-sm font-bold text-black shadow-lg shadow-amber-500/20 transition hover:from-amber-400 hover:to-amber-300 disabled:opacity-50 touch-feedback"
        >
          {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {sending ? "Envoi en cours…" : "Envoyer à l'école"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   REPORTS LIST
════════════════════════════════════════════════════════════ */
function ReportsList({ reports, compact = false }: { reports?: any[]; compact?: boolean }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.025]">
      <div className="flex items-center gap-3 border-b border-white/[0.05] p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-500/10">
          <Sparkles className="h-4 w-4 text-blue-400" />
        </div>
        <h3 className="text-sm font-bold text-white">Plaintes envoyées</h3>
      </div>
      <div className="p-4">
        {!reports?.length ? (
          <div className="py-6 text-center">
            <p className="text-sm text-gray-600">Aucune plainte envoyée.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.slice(0, compact ? 4 : 20).map((r, i) => (
              <motion.div key={r.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3"
              >
                <p className="text-sm font-semibold text-white">{r.title || "Signalement"}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{r.messages?.[0]?.body || "Message transmis"}</p>
                <p className="mt-1.5 text-[11px] text-gray-700">{formatDate(r.createdAt)}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SMALL COMPONENTS
════════════════════════════════════════════════════════════ */
function ActionChip({ icon: Icon, label, onClick, variant = "default" }: {
  icon: React.ElementType; label: string; onClick: () => void; variant?: "default" | "gold" | "green";
}) {
  const styles = {
    default: "bg-white/[0.05] border-white/[0.08] text-gray-300",
    gold:    "bg-amber-500/10 border-amber-500/20 text-amber-200",
    green:   "bg-emerald-500/10 border-emerald-500/20 text-emerald-200",
  };
  return (
    <button onClick={onClick}
      className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-semibold transition hover:opacity-80 touch-feedback", styles[variant])}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function InfoPanel({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-amber-400" />
        <h4 className="text-sm font-semibold text-white">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-white/[0.04] last:border-0">
      <span className="text-[11px] text-gray-600 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-gray-200 font-medium">{value}</span>
    </div>
  );
}

function EmptyState({ title, text, small = false }: { title: string; text: string; small?: boolean }) {
  if (small) {
    return (
      <div className="rounded-2xl border border-dashed border-white/[0.08] py-6 text-center">
        <p className="text-sm text-gray-600">{text}</p>
      </div>
    );
  }
  return (
    <div className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-white/[0.04]">
        <GraduationCap className="h-8 w-8 text-gray-600" />
      </div>
      <h2 className="text-base font-bold text-white">{title}</h2>
      <p className="mt-2 text-sm text-gray-500 max-w-xs mx-auto">{text}</p>
    </div>
  );
}
