"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  GraduationCap,
  MessageSquareWarning,
  ReceiptText,
  RefreshCw,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  downloadProtectedFile,
  schoolApi,
  type CreateParentReportInput,
  type Grade,
  type ParentDashboardData,
  type SchoolDocument,
  type Student,
} from "@/lib/school-api";
import { cn } from "@/lib/utils";

const reportTypes: Array<{ value: CreateParentReportInput["type"]; label: string }> = [
  { value: "PLAINTE", label: "Plainte" },
  { value: "ABSENCE", label: "Absence" },
  { value: "MALADIE", label: "Maladie" },
  { value: "URGENCE", label: "Urgence" },
];

export type ParentPortalView = "dashboard" | "children" | "grades" | "payments" | "reports";

const pageCopy: Record<ParentPortalView, { title: string; description: string }> = {
  dashboard: {
    title: "Suivi de mes enfants",
    description: "Notes, bulletins, documents et reçus sont consultables uniquement en lecture. Les plaintes sont envoyées à la direction et aux enseignants.",
  },
  children: {
    title: "Mes enfants",
    description: "Consultez le dossier, la classe, les documents et les présences liées à chaque enfant.",
  },
  grades: {
    title: "Bulletins et notes",
    description: "Retrouvez les notes publiées par l’école et ouvrez les bulletins PDF disponibles.",
  },
  payments: {
    title: "Reçus et frais scolaires",
    description: "Suivez les factures, les montants restants et les reçus de paiement de vos enfants.",
  },
  reports: {
    title: "Plaintes et signalements",
    description: "Envoyez une demande à l’école et suivez l’historique de vos messages transmis.",
  },
};

function formatDate(value?: string | Date | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("fr-FR");
}

function formatMoney(value?: number | null, currency = "XOF") {
  if (value === null || value === undefined) return "—";
  return `${new Intl.NumberFormat("fr-FR").format(value)} ${currency}`;
}

function studentName(student: Student) {
  return `${student.firstName} ${student.lastName}`.trim();
}

function gradeValue(grade: Grade) {
  const score = grade.score ?? grade.value ?? 0;
  const max = grade.maxScore ?? 20;
  return max ? (score / max) * 20 : score;
}

function periodName(grade: Grade) {
  if (typeof grade.period === "string") return grade.period;
  return grade.period?.name || "Période";
}

function periodId(grade: Grade) {
  if (typeof grade.period === "object") return grade.period?.id;
  return grade.periodId;
}

function studentFinance(student: Student) {
  const invoices = student.invoices || [];
  const total = invoices.reduce((sum, invoice) => sum + (invoice.totalAmount ?? invoice.amount ?? 0), 0);
  const paid = invoices.reduce((sum, invoice) => sum + (invoice.paidAmount ?? 0), 0);
  const due = invoices.reduce((sum, invoice) => sum + Math.max((invoice.totalAmount ?? invoice.amount ?? 0) - (invoice.paidAmount ?? 0), 0), 0);
  const tuitionInvoices = invoices.filter((invoice) => {
    const label = `${invoice.type || ""} ${invoice.title || ""} ${invoice.description || ""}`;
    return invoice.type === "TUITION" || /scolarit|scolaire|frais/i.test(label);
  });
  const schoolFee = (tuitionInvoices.length ? tuitionInvoices : invoices).reduce((sum, invoice) => sum + (invoice.totalAmount ?? invoice.amount ?? 0), 0);
  return { total, paid, due, schoolFee, count: invoices.length };
}

function getPortalView(pathname: string): ParentPortalView {
  if (pathname.includes("/parent/enfants")) return "children";
  if (pathname.includes("/parent/bulletins")) return "grades";
  if (pathname.includes("/parent/paiements")) return "payments";
  if (pathname.includes("/parent/plaintes")) return "reports";
  return "dashboard";
}

export default function ParentDashboardPage() {
  const pathname = usePathname();
  const view = getPortalView(pathname);
  const [data, setData] = useState<ParentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [reportForm, setReportForm] = useState<CreateParentReportInput>({
    type: "PLAINTE",
    childId: "",
    message: "",
  });

  const loadDashboard = async () => {
    setLoading(true);
    const { data: dashboard, error } = await schoolApi.parentDashboard();
    if (error) setMessage(error);
    setData(dashboard);
    setLoading(false);
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const children = useMemo(() => data?.parent.students?.map((link) => link.student) || [], [data]);
  const documentsByOwner = useMemo(() => {
    const map = new Map<string, SchoolDocument[]>();
    for (const doc of data?.documents || []) {
      map.set(doc.ownerId, [...(map.get(doc.ownerId) || []), doc]);
    }
    return map;
  }, [data]);

  const firstChild = children[0];
  useEffect(() => {
    if (!reportForm.childId && firstChild) setReportForm((prev) => ({ ...prev, childId: firstChild.id }));
  }, [firstChild, reportForm.childId]);

  const stats = useMemo(() => {
    const invoices = children.flatMap((child) => child.invoices || []);
    const payments = invoices.flatMap((invoice) => invoice.payments || []);
    const grades = children.flatMap((child) => child.grades || []);
    const absences = children.flatMap((child) => child.attendances || []).filter((item) => item.status === "ABSENT" || item.status === "LATE");
    return { invoices: invoices.length, payments: payments.length, grades: grades.length, absences: absences.length };
  }, [children]);

  const openDocument = async (doc: SchoolDocument) => {
    const error = await downloadProtectedFile(doc.fileUrl, doc.title, "open");
    if (error) setMessage(error);
  };

  const openReceipt = async (paymentId: string, receiptNumber?: string) => {
    const error = await downloadProtectedFile(`/api/payments/${paymentId}/receipt`, `recu-${receiptNumber || paymentId}.pdf`, "open");
    if (error) setMessage(error);
  };

  const openReportCard = async (student: Student, grade: Grade) => {
    const id = periodId(grade);
    if (!id) {
      setMessage("Impossible de trouver la période du bulletin.");
      return;
    }
    const error = await downloadProtectedFile(`/api/grades/report-cards/${student.id}/${id}/pdf`, `bulletin-${student.matricule || student.id}-${periodName(grade)}.pdf`, "open");
    if (error) setMessage(error);
  };

  const openStudentPdf = async (student: Student, kind: "enrollment-form" | "card" | "dossier") => {
    const names = {
      "enrollment-form": `fiche-inscription-${student.matricule || student.id}.pdf`,
      card: `carte-identite-scolaire-${student.matricule || student.id}.pdf`,
      dossier: `dossier-eleve-${student.matricule || student.id}.pdf`,
    };
    const error = await downloadProtectedFile(`/api/students/${student.id}/${kind}`, names[kind], "open");
    if (error) setMessage(error);
  };

  const submitReport = async () => {
    if (!reportForm.childId) {
      setMessage("Choisissez l’enfant concerné.");
      return;
    }
    if (!reportForm.message.trim()) {
      setMessage("Écrivez le message de la plainte ou du signalement.");
      return;
    }
    setSending(true);
    setMessage(null);
    const { error } = await schoolApi.createParentReport({ ...reportForm, message: reportForm.message.trim() });
    setSending(false);
    if (error) {
      setMessage(error);
      return;
    }
    setReportForm((prev) => ({ ...prev, message: "" }));
    setMessage("Plainte envoyée à la direction et aux enseignants.");
    await loadDashboard();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-amber-300" />
      </div>
    );
  }

  const page = pageCopy[view];
  const showStats = view === "dashboard";
  const showReportsColumn = view === "dashboard";
  const showReportsPage = view === "reports";
  const reportFormPanel = (
    <Panel title="Porter plainte / signaler" icon={MessageSquareWarning}>
      <div className="space-y-3">
        <select value={reportForm.childId || ""} onChange={(e) => setReportForm({ ...reportForm, childId: e.target.value })} className={fieldClass}>
          <option value="">Choisir l’enfant</option>
          {children.map((child) => <option key={child.id} value={child.id}>{studentName(child)}</option>)}
        </select>
        <select value={reportForm.type} onChange={(e) => setReportForm({ ...reportForm, type: e.target.value as CreateParentReportInput["type"] })} className={fieldClass}>
          {reportTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
        </select>
        <textarea value={reportForm.message} onChange={(e) => setReportForm({ ...reportForm, message: e.target.value })} placeholder="Expliquez le problème, la demande ou l’urgence..." className={cn(fieldClass, "min-h-32 resize-none")} />
        <button onClick={submitReport} disabled={sending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-60">
          {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Envoyer à l’école
        </button>
      </div>
    </Panel>
  );
  const reportsListPanel = (
    <Panel title="Mes plaintes envoyées" icon={UserRound}>
      {!data?.reports?.length ? (
        <SmallEmpty text="Aucune plainte envoyée." />
      ) : (
        <div className="space-y-3">
          {data.reports.slice(0, showReportsPage ? 20 : 6).map((report) => (
            <div key={report.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
              <p className="text-sm font-semibold text-white">{report.title || "Plainte parent"}</p>
              <p className="mt-1 line-clamp-3 text-xs leading-5 text-gray-400">{report.messages?.[0]?.body || "Message envoyé"}</p>
              <p className="mt-2 text-xs text-gray-600">{formatDate(report.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6 overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-amber-500/14 via-emerald-500/8 to-white/[0.03] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
              <ShieldCheck className="h-3.5 w-3.5" />
              Espace parent sécurisé
            </p>
            <h1 className="font-heading text-2xl font-bold text-white sm:text-3xl">{page.title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-300">
              {page.description}
            </p>
          </div>
          <button onClick={loadDashboard} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.09]">
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </button>
        </div>

        {showStats && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={GraduationCap} label="Enfants suivis" value={String(children.length)} />
            <Stat icon={BookOpen} label="Notes enregistrées" value={String(stats.grades)} />
            <Stat icon={ReceiptText} label="Reçus disponibles" value={String(stats.payments)} />
            <Stat icon={AlertTriangle} label="Retards / absences" value={String(stats.absences)} />
          </div>
        )}
      </motion.div>

      {message && (
        <div className="mb-5 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-gray-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          {message}
        </div>
      )}

      {showReportsPage ? (
        <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          {reportFormPanel}
          {reportsListPanel}
        </section>
      ) : (
        <section className={cn("grid gap-5", showReportsColumn && "xl:grid-cols-[1.35fr_0.65fr]")}>
          <div className="space-y-5">
            {children.length === 0 ? (
              <Empty title="Aucun enfant lié" text="Demandez à l’administration de lier votre numéro parent au dossier de l’élève." />
            ) : (
              children.map((child) => {
                const childDocs = documentsByOwner.get(child.id) || [];
                const grades = child.grades || [];
                const periods = grades.filter((grade, index, list) => periodId(grade) && list.findIndex((item) => periodId(item) === periodId(grade)) === index);
                const invoices = child.invoices || [];
                const finance = studentFinance(child);
                const attendanceAlerts = (child.attendances || []).filter((item) => item.status === "ABSENT" || item.status === "LATE");
                const showChildDetails = view === "children";
                const showGrades = view === "dashboard" || view === "grades";
                const showDocuments = view === "dashboard" || view === "children";
                const showPayments = view === "dashboard" || view === "children" || view === "payments";
                const gridColumns = showChildDetails && showDocuments ? "lg:grid-cols-2" : showGrades && showDocuments ? "lg:grid-cols-2" : "";

                return (
                  <motion.article key={child.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.035]">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] p-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-amber-500 text-sm font-bold text-white">
                          {child.firstName?.[0]}{child.lastName?.[0]}
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-white">{studentName(child)}</h2>
                          <p className="text-sm text-gray-400">{child.classroom?.name || "Classe non affectée"} · {child.matricule || "Matricule non défini"}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => openStudentPdf(child, "enrollment-form")}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-gray-100 transition hover:bg-white/[0.1]"
                        >
                          <FileText className="h-4 w-4" />
                          Fiche d'inscription
                        </button>
                        <button
                          onClick={() => openStudentPdf(child, "card")}
                          className="inline-flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20"
                        >
                          <CreditCard className="h-4 w-4" />
                          Carte d'identité scolaire
                        </button>
                        <button
                          onClick={() => downloadProtectedFile(`/api/grades/certificates/${child.id}/pdf?type=SCHOOL_CERTIFICATE`, `attestation-${child.matricule || child.id}.pdf`, "open")}
                          className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
                        >
                          <FileText className="h-4 w-4" />
                          Attestation
                        </button>
                      </div>
                    </div>

                    {(showChildDetails || showGrades || showDocuments) && (
                      <div className={cn("grid gap-4 p-5", gridColumns)}>
                        {showChildDetails && (
                          <Panel title="Dossier de l’enfant" icon={UserRound}>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <InfoItem label="Classe" value={child.classroom?.name || "Non affectée"} />
                              <InfoItem label="Matricule" value={child.matricule || "Non défini"} />
                              <InfoItem label="Date de naissance" value={formatDate(child.birthDate || child.dateOfBirth)} />
                              <InfoItem label="Téléphone parent" value={child.parentPhone || data?.parent.phone || "Non renseigné"} />
                              <InfoItem label="Adresse" value={child.address || child.city || "Non renseignée"} />
                              <InfoItem label="Statut" value={child.status || "Actif"} />
                            </div>
                          </Panel>
                        )}

                        {showChildDetails && (
                          <Panel title="Présences et retards" icon={AlertTriangle}>
                            {attendanceAlerts.length === 0 ? (
                              <SmallEmpty text="Aucun retard ou absence signalé." />
                            ) : (
                              <div className="space-y-2">
                                {attendanceAlerts.slice(0, 8).map((attendance) => (
                                  <div key={attendance.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
                                    <span className="text-sm font-medium text-white">{attendance.status === "LATE" ? "Retard" : "Absence"}</span>
                                    <span className="text-xs text-gray-500">{formatDate(attendance.date)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </Panel>
                        )}

                        {showGrades && (
                          <Panel title="Notes et bulletins" icon={BookOpen}>
                            {grades.length === 0 ? (
                              <SmallEmpty text="Aucune note publiée pour le moment." />
                            ) : (
                              <div className="space-y-3">
                                <div className="flex flex-wrap gap-2">
                                  {periods.map((grade) => (
                                    <button key={periodId(grade)} onClick={() => openReportCard(child, grade)} className="inline-flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20">
                                      <Download className="h-3.5 w-3.5" />
                                      Bulletin {periodName(grade)}
                                    </button>
                                  ))}
                                </div>
                                <div className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.06]">
                                  {grades.slice(0, view === "grades" ? grades.length : 6).map((grade) => (
                                    <div key={grade.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-white">{grade.subject?.name || "Matière"}</p>
                                        <p className="text-xs text-gray-500">{periodName(grade)} · {grade.appreciation || grade.comment || "Pas d’appréciation"}</p>
                                      </div>
                                      <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-sm font-bold text-emerald-300">{gradeValue(grade).toFixed(1)}/20</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </Panel>
                        )}

                        {showDocuments && (
                          <Panel title="Documents de l’enfant" icon={FileText}>
                            {childDocs.length === 0 ? (
                              <SmallEmpty text="Aucun document disponible." />
                            ) : (
                              <div className="space-y-2">
                                {childDocs.slice(0, view === "children" ? childDocs.length : 6).map((doc) => (
                                  <button key={doc.id} onClick={() => openDocument(doc)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-left transition hover:bg-white/[0.07]">
                                    <span className="min-w-0">
                                      <span className="block truncate text-sm font-medium text-white">{doc.title}</span>
                                      <span className="text-xs text-gray-500">{doc.type} · {formatDate(doc.createdAt)}</span>
                                    </span>
                                    <Download className="h-4 w-4 shrink-0 text-amber-300" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </Panel>
                        )}
                      </div>
                    )}

                    {showPayments && (
                      <div className={cn("p-5", (showChildDetails || showGrades || showDocuments) && "border-t border-white/[0.06]")}>
                        <Panel title="Factures et reçus de paiement" icon={ReceiptText}>
                          <FinanceSummary finance={finance} />
                          {invoices.length === 0 ? (
                            <SmallEmpty text="Aucune facture disponible." />
                          ) : (
                            <div className="grid gap-3 md:grid-cols-2">
                              {invoices.map((invoice) => {
                                const total = invoice.totalAmount ?? invoice.amount ?? 0;
                                const balance = Math.max(total - (invoice.paidAmount ?? 0), 0);
                                return (
                                  <div key={invoice.id} className="rounded-2xl border border-white/[0.06] bg-[#0b1220] p-4">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-sm font-semibold text-white">{invoice.title || invoice.number || "Facture"}</p>
                                        <p className="mt-1 text-xs text-gray-500">Total : {formatMoney(total)} · Payé : {formatMoney(invoice.paidAmount ?? 0)}</p>
                                        <p className="mt-1 text-xs text-amber-200">Reste dû : {formatMoney(balance)}</p>
                                      </div>
                                      <span className={cn("rounded-full px-2 py-1 text-xs font-semibold", invoice.status === "PAID" ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300")}>{invoice.status}</span>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <button onClick={() => downloadProtectedFile(`/api/payments/invoices/${invoice.id}/pdf`, `facture-${invoice.number || invoice.id}.pdf`, "open")} className="rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-gray-200 transition hover:bg-white/[0.1]">
                                        Facture
                                      </button>
                                      {(invoice.payments || []).map((payment) => (
                                        <button key={payment.id} onClick={() => openReceipt(payment.id, payment.receiptNumber)} className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20">
                                          Reçu {payment.receiptNumber || ""}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </Panel>
                      </div>
                    )}
                  </motion.article>
                );
              })
            )}
          </div>

          {showReportsColumn && (
            <aside className="space-y-5">
              {reportFormPanel}
              {reportsListPanel}
            </aside>
          )}
        </section>
      )}
    </div>
  );
}

const fieldClass = "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-amber-400/50 [&>option]:bg-soraCard";

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.05] p-4">
      <Icon className="mb-3 h-5 w-5 text-amber-300" />
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-amber-300" />
        <h3 className="font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function FinanceSummary({ finance }: { finance: ReturnType<typeof studentFinance> }) {
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-4">
      <InfoItem label="Frais scolaires" value={formatMoney(finance.schoolFee)} />
      <InfoItem label="Montant total" value={formatMoney(finance.total)} />
      <InfoItem label="Déjà payé" value={formatMoney(finance.paid)} />
      <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2.5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-amber-200/70">Montant dû</p>
        <p className="mt-1 text-sm font-bold text-amber-100">{formatMoney(finance.due)}</p>
        <p className="mt-1 text-[11px] text-amber-200/60">{finance.count} facture{finance.count > 1 ? "s" : ""}</p>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-[0.16em] text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
      <GraduationCap className="mx-auto mb-3 h-10 w-10 text-gray-600" />
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <p className="mt-2 text-sm text-gray-400">{text}</p>
    </div>
  );
}

function SmallEmpty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-sm text-gray-500">{text}</p>;
}
