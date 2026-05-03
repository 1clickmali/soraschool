"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign,
  Plus,
  X,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Search,
  TrendingUp,
  Clock,
  AlertTriangle,
  CreditCard,
  FileText,
  Receipt,
} from "lucide-react";
import { downloadProtectedFile, schoolApi, type Invoice, type Student, type Classroom, type CreateInvoiceInput, type RecordPaymentInput } from "@/lib/school-api";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

const INVOICE_STATUS_LABELS: Record<string, string> = {
  PAID: "Payé",
  PENDING: "En attente",
  ISSUED: "Émise",
  OVERDUE: "En retard",
  PARTIAL: "Partiel",
  PARTIALLY_PAID: "Partiel",
  CANCELED: "Annulée",
  DRAFT: "Brouillon",
};
const INVOICE_STATUS_COLORS: Record<string, string> = {
  PAID: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  PENDING: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  ISSUED: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  OVERDUE: "bg-red-500/15 text-red-400 border-red-500/25",
  PARTIAL: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  PARTIALLY_PAID: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  CANCELED: "bg-gray-500/15 text-gray-400 border-gray-500/25",
  DRAFT: "bg-gray-500/15 text-gray-400 border-gray-500/25",
};

const INVOICE_TYPE_LABELS: Record<string, string> = {
  TUITION: "Scolarité",
  ACTIVITY: "Activité",
  TRANSPORT: "Transport",
  CANTEEN: "Cantine",
  OTHER: "Autre",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", INVOICE_STATUS_COLORS[status] || "bg-gray-500/15 text-gray-400 border-gray-500/25")}>
      {INVOICE_STATUS_LABELS[status] || status}
    </span>
  );
}

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-md bg-soraCard border border-white/10 rounded-2xl shadow-2xl my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
                <h2 className="text-base font-semibold font-heading text-white">{title}</h2>
                <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

const inputCls = cn(
  "w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white",
  "placeholder:text-gray-600 focus:border-emerald-500/50 focus:bg-emerald-500/[0.03] transition-all duration-200"
);
const selectCls = cn(inputCls, "[&>option]:bg-soraCard");

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function PaymentsPage() {
  const params = useParams();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");

  const [invoiceModal, setInvoiceModal] = useState(false);
  const [quickPaymentModal, setQuickPaymentModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [invoiceForm, setInvoiceForm] = useState<CreateInvoiceInput>({
    studentId: "",
    amount: 0,
    type: "TUITION",
    dueDate: "",
    description: "",
  });

  const [paymentForm, setPaymentForm] = useState<Partial<RecordPaymentInput>>({
    amount: 0,
    method: "CASH",
    payerName: "",
    note: "",
  });
  const [quickPaymentForm, setQuickPaymentForm] = useState({
    classId: "",
    studentId: "",
    invoiceId: "",
    amount: 0,
    method: "CASH",
    payerName: "",
    note: "",
  });

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    const [invRes, stuRes, classRes] = await Promise.all([
      schoolApi.invoices(search, classFilter || undefined, statusFilter || undefined),
      schoolApi.students(""),
      schoolApi.classes(),
    ]);
    if (invRes.data?.invoices) setInvoices(invRes.data.invoices);
    if (stuRes.data?.students) setStudents(stuRes.data.students);
    if (classRes.data?.classes) setClasses(classRes.data.classes);
    setLoading(false);
  }, [search, classFilter, statusFilter]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  const filtered = invoices.filter((inv) => {
    const q = search.toLowerCase();
    const studentName = inv.student ? `${inv.student.firstName} ${inv.student.lastName}`.toLowerCase() : "";
    const matchSearch = !q || studentName.includes(q);
    const matchStatus = !statusFilter || inv.status === statusFilter;
    return matchSearch && matchStatus;
  }).sort((a, b) => {
    const classA = a.student?.classroom?.name || "";
    const classB = b.student?.classroom?.name || "";
    if (classA !== classB) return classA.localeCompare(classB, "fr");
    const studentA = `${a.student?.lastName || ""} ${a.student?.firstName || ""}`;
    const studentB = `${b.student?.lastName || ""} ${b.student?.firstName || ""}`;
    return studentA.localeCompare(studentB, "fr");
  });

  const invoiceTotal = (invoice: Invoice) => invoice.totalAmount ?? invoice.amount ?? 0;
  const invoiceBalance = (invoice: Invoice) => Math.max(invoiceTotal(invoice) - (invoice.paidAmount ?? 0), 0);
  const paid = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + invoiceTotal(i), 0);
  const pending = invoices.filter((i) => ["PENDING", "ISSUED", "PARTIAL", "PARTIALLY_PAID"].includes(i.status)).reduce((s, i) => s + invoiceBalance(i), 0);
  const overdue = invoices.filter((i) => i.status === "OVERDUE").reduce((s, i) => s + invoiceBalance(i), 0);
  const quickStudents = students.filter((student) => !quickPaymentForm.classId || student.classroomId === quickPaymentForm.classId);
  const quickStudentInvoices = invoices
    .filter((invoice) => invoice.studentId === quickPaymentForm.studentId && invoiceBalance(invoice) > 0 && invoice.status !== "PAID")
    .sort((a, b) => (a.dueDate || a.createdAt || "").localeCompare(b.dueDate || b.createdAt || ""));
  const quickSelectedInvoice = quickStudentInvoices.find((invoice) => invoice.id === quickPaymentForm.invoiceId) || quickStudentInvoices[0];
  const quickTotalDue = quickStudentInvoices.reduce((sum, invoice) => sum + invoiceBalance(invoice), 0);
  const quickSelectedDue = quickSelectedInvoice ? invoiceBalance(quickSelectedInvoice) : 0;

  const resetInvoiceForm = () => {
    setInvoiceForm({ studentId: "", amount: 0, type: "TUITION", dueDate: "", description: "" });
    setFormError(null);
    setFormSuccess(null);
  };

  const openQuickPayment = () => {
    setQuickPaymentForm({
      classId: classFilter,
      studentId: "",
      invoiceId: "",
      amount: 0,
      method: "CASH",
      payerName: "",
      note: "",
    });
    setFormError(null);
    setFormSuccess(null);
    setQuickPaymentModal(true);
  };

  const selectQuickStudent = (studentId: string) => {
    const unpaid = invoices
      .filter((invoice) => invoice.studentId === studentId && invoiceBalance(invoice) > 0 && invoice.status !== "PAID")
      .sort((a, b) => (a.dueDate || a.createdAt || "").localeCompare(b.dueDate || b.createdAt || ""));
    const first = unpaid[0];
    setQuickPaymentForm((prev) => ({
      ...prev,
      studentId,
      invoiceId: first?.id || "",
      amount: first ? invoiceBalance(first) : 0,
    }));
  };

  const downloadPdf = async (endpoint: string, filename: string, mode: "download" | "open" = "download") => {
    const error = await downloadProtectedFile(endpoint, filename, mode);
    if (error) setFormError(error);
  };

  const handleCreateInvoice = async () => {
    if (!invoiceForm.studentId) { setFormError("Veuillez sélectionner un élève"); return; }
    if (!invoiceForm.amount || invoiceForm.amount <= 0) { setFormError("Montant invalide"); return; }
    setFormError(null);
    setSaving(true);
    const { data, error } = await schoolApi.createInvoice(invoiceForm);
    setSaving(false);
    if (error) { setFormError(error); return; }
    if (data?.pdfs?.invoice) {
      await downloadPdf(data.pdfs.invoice, `facture-${data.invoice.number || data.invoice.id}.pdf`, "open");
    }
    setFormSuccess("Facture créée et PDF généré !");
    setTimeout(() => { setInvoiceModal(false); resetInvoiceForm(); loadInvoices(); }, 900);
  };

  const handleRecordPayment = async () => {
    if (!paymentModal) return;
    if (!paymentForm.amount || paymentForm.amount <= 0) { setFormError("Montant invalide"); return; }
    setFormError(null);
    setSaving(true);
    const { data, error } = await schoolApi.recordPayment({
      invoiceId: paymentModal.id,
      amount: paymentForm.amount!,
      method: paymentForm.method,
      payerName: paymentForm.payerName,
      note: paymentForm.note,
    });
    setSaving(false);
    if (error) { setFormError(error); return; }
    if (data?.pdfs?.receipt) {
      await downloadPdf(data.pdfs.receipt, `recu-${data.payment.receiptNumber || data.payment.id}.pdf`);
    }
    setFormSuccess("Paiement enregistré et reçu généré !");
    setTimeout(() => { setPaymentModal(null); setPaymentForm({ amount: 0, method: "CASH", payerName: "", note: "" }); setFormError(null); setFormSuccess(null); loadInvoices(); }, 900);
  };

  const handleQuickPayment = async () => {
    if (!quickPaymentForm.studentId) { setFormError("Veuillez sélectionner un élève"); return; }
    if (!quickSelectedInvoice) { setFormError("Aucune facture impayée pour cet élève. Créez d'abord une facture de scolarité."); return; }
    if (!quickPaymentForm.amount || quickPaymentForm.amount <= 0) { setFormError("Montant invalide"); return; }
    if (quickPaymentForm.amount > quickSelectedDue) { setFormError("Le montant dépasse le reste à payer sur cette facture."); return; }
    setFormError(null);
    setSaving(true);
    const { data, error } = await schoolApi.recordPayment({
      invoiceId: quickSelectedInvoice.id,
      studentId: quickPaymentForm.studentId,
      amount: quickPaymentForm.amount,
      method: quickPaymentForm.method,
      payerName: quickPaymentForm.payerName,
      note: quickPaymentForm.note,
    });
    setSaving(false);
    if (error) { setFormError(error); return; }
    if (data?.pdfs?.receipt) {
      await downloadPdf(data.pdfs.receipt, `recu-${data.payment.receiptNumber || data.payment.id}.pdf`, "open");
    }
    setFormSuccess("Paiement scolarité enregistré et reçu ouvert !");
    setTimeout(() => {
      setQuickPaymentModal(false);
      setFormError(null);
      setFormSuccess(null);
      loadInvoices();
    }, 900);
  };

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading text-white">Frais & Paiements</h1>
          <p className="text-gray-400 text-sm mt-1">Gestion des factures et paiements</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={openQuickPayment}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-[0_0_20px_rgba(37,99,235,0.25)]"
          >
            <CreditCard className="w-4 h-4" />
            Paiement scolarité
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => { resetInvoiceForm(); setInvoiceModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all shadow-[0_0_20px_rgba(16,185,129,0.25)]"
          >
            <Plus className="w-4 h-4" />
            Nouvelle facture
          </motion.button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: "Encaissé", value: formatCurrency(paid), icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "En attente", value: formatCurrency(pending), icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "En retard", value: formatCurrency(overdue), icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", stat.bg)}>
                <stat.icon className={cn("w-3.5 h-3.5", stat.color)} />
              </div>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
            <p className={cn("text-base font-bold font-heading", stat.color)}>{stat.value}</p>
          </div>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Rechercher un élève..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-emerald-500/50 transition-all"
          />
        </div>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white [&>option]:bg-soraCard focus:border-emerald-500/50 transition-all min-w-[170px]"
        >
          <option value="">Toutes les classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white [&>option]:bg-soraCard focus:border-emerald-500/50 transition-all"
        >
          <option value="">Tous les statuts</option>
          <option value="PAID">Payé</option>
          <option value="ISSUED">Émise</option>
          <option value="OVERDUE">En retard</option>
          <option value="PARTIALLY_PAID">Partiel</option>
        </select>
      </motion.div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="flex-1"><div className="h-3 bg-white/10 rounded w-32 mb-2" /><div className="h-2 bg-white/[0.07] rounded w-20" /></div>
                <div className="h-5 bg-white/10 rounded w-20" />
                <div className="h-5 bg-white/10 rounded-full w-16" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <DollarSign className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">Aucune facture trouvée</p>
            <button onClick={() => { resetInvoiceForm(); setInvoiceModal(true); }} className="mt-3 text-xs text-emerald-500 hover:text-emerald-400 transition-colors">
              Créer la première facture
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Élève</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Classe</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Montant</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Échéance</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map((inv) => {
                  const latestPayment = inv.payments?.[0];
                  return (
                  <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-white">
                        {inv.student ? `${inv.student.firstName} ${inv.student.lastName}` : "—"}
                      </p>
                      {inv.description && <p className="text-xs text-gray-500 truncate max-w-[160px]">{inv.description}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-400">
                      {inv.student?.classroom?.name || "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs bg-white/[0.06] text-gray-300 px-2 py-0.5 rounded-full">
                        {(inv.type && INVOICE_TYPE_LABELS[inv.type]) || inv.title || "Frais"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-semibold text-white">{formatCurrency(invoiceTotal(inv))}</span>
                      {(inv.paidAmount ?? 0) > 0 && inv.status !== "PAID" && (
                        <p className="text-xs text-emerald-400">Payé : {formatCurrency(inv.paidAmount ?? 0)}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-400">
                      {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => downloadPdf(`/api/payments/invoices/${inv.id}/pdf`, `facture-${inv.number || inv.id}.pdf`, "open")}
                          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-white/[0.05] text-gray-300 hover:bg-white/[0.09] border border-white/10 transition-all"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Facture
                        </button>
                        {latestPayment?.id && (
                          <button
                            onClick={() => downloadPdf(latestPayment.receiptUrl || `/api/payments/${latestPayment.id}/receipt`, `recu-${latestPayment.receiptNumber || latestPayment.id}.pdf`, "open")}
                            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 border border-blue-500/20 transition-all"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            Reçu
                          </button>
                        )}
                        {(["PENDING", "ISSUED", "OVERDUE", "PARTIAL", "PARTIALLY_PAID", "DRAFT"].includes(inv.status)) && (
                          <button
                            onClick={() => {
                              setPaymentModal(inv);
                              setPaymentForm({ amount: invoiceBalance(inv) || invoiceTotal(inv), method: "CASH", payerName: "", note: "" });
                              setFormError(null);
                              setFormSuccess(null);
                            }}
                            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20 transition-all"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            Payer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Quick tuition payment modal */}
      <Modal open={quickPaymentModal} onClose={() => { setQuickPaymentModal(false); setFormError(null); setFormSuccess(null); }} title="Paiement scolarité élève">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Classe">
              <select
                className={selectCls}
                value={quickPaymentForm.classId}
                onChange={(e) => setQuickPaymentForm({ ...quickPaymentForm, classId: e.target.value, studentId: "", invoiceId: "", amount: 0 })}
              >
                <option value="">Toutes les classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Élève" required>
              <select className={selectCls} value={quickPaymentForm.studentId} onChange={(e) => selectQuickStudent(e.target.value)}>
                <option value="">Sélectionner</option>
                {quickStudents.map((s) => (
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-gray-500">Montant dû total</p>
                <p className="text-lg font-bold text-amber-300">{formatCurrency(quickTotalDue)}</p>
              </div>
              <div>
                <p className="text-gray-500">Facture sélectionnée</p>
                <p className="text-sm font-semibold text-white truncate">{quickSelectedInvoice?.title || "Aucune dette"}</p>
                <p className="text-xs text-emerald-300">Reste : {formatCurrency(quickSelectedDue)}</p>
              </div>
            </div>
            {quickStudentInvoices.length > 1 && (
              <div className="mt-3">
                <label className="block text-xs text-gray-500 mb-1">Choisir la tranche/facture à payer</label>
                <select
                  className={selectCls}
                  value={quickSelectedInvoice?.id || ""}
                  onChange={(e) => {
                    const invoice = quickStudentInvoices.find((item) => item.id === e.target.value);
                    setQuickPaymentForm({ ...quickPaymentForm, invoiceId: e.target.value, amount: invoice ? invoiceBalance(invoice) : 0 });
                  }}
                >
                  {quickStudentInvoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.title || invoice.number || "Facture"} - reste {formatCurrency(invoiceBalance(invoice))}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <FormField label="Nom du payeur">
            <input
              className={inputCls}
              placeholder="Ex: Sissoko Abdoulaye, parent, tuteur..."
              value={quickPaymentForm.payerName}
              onChange={(e) => setQuickPaymentForm({ ...quickPaymentForm, payerName: e.target.value })}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Montant payé (tranche)" required>
              <input
                type="number"
                className={inputCls}
                value={quickPaymentForm.amount || ""}
                onChange={(e) => setQuickPaymentForm({ ...quickPaymentForm, amount: Number(e.target.value) })}
              />
            </FormField>
            <FormField label="Méthode">
              <select className={selectCls} value={quickPaymentForm.method} onChange={(e) => setQuickPaymentForm({ ...quickPaymentForm, method: e.target.value })}>
                <option value="CASH">Espèces</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="BANK_TRANSFER">Virement</option>
                <option value="CARD">Carte</option>
              </select>
            </FormField>
          </div>
          <button
            type="button"
            disabled={!quickSelectedDue}
            onClick={() => setQuickPaymentForm({ ...quickPaymentForm, amount: quickSelectedDue })}
            className="w-full rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50 transition-all"
          >
            Payer le solde complet de cette tranche
          </button>

          <AnimatePresence>
            {formError && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{formError}
              </motion.div>
            )}
            {formSuccess && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />{formSuccess}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setQuickPaymentModal(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm hover:bg-white/[0.04] hover:text-white transition-all">Annuler</button>
            <button onClick={handleQuickPayment} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all disabled:opacity-60">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Encaisser"}
            </button>
          </div>
        </div>
      </Modal>

      {/* New invoice modal */}
      <Modal open={invoiceModal} onClose={() => setInvoiceModal(false)} title="Nouvelle facture">
        <div className="space-y-4">
          <FormField label="Élève" required>
            <select className={selectCls} value={invoiceForm.studentId} onChange={(e) => setInvoiceForm({ ...invoiceForm, studentId: e.target.value })}>
              <option value="">Sélectionner un élève</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
              ))}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Montant (XOF)" required>
              <input type="number" className={inputCls} placeholder="50000" value={invoiceForm.amount || ""} onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: Number(e.target.value) })} />
            </FormField>
            <FormField label="Type">
              <select className={selectCls} value={invoiceForm.type} onChange={(e) => setInvoiceForm({ ...invoiceForm, type: e.target.value as CreateInvoiceInput["type"] })}>
                <option value="TUITION">Scolarité</option>
                <option value="ACTIVITY">Activité</option>
                <option value="TRANSPORT">Transport</option>
                <option value="CANTEEN">Cantine</option>
                <option value="OTHER">Autre</option>
              </select>
            </FormField>
          </div>
          <FormField label="Date d'échéance">
            <input type="date" className={inputCls} value={invoiceForm.dueDate || ""} onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })} />
          </FormField>
          <FormField label="Description (optionnel)">
            <textarea className={cn(inputCls, "resize-none h-16")} placeholder="Frais de scolarité 1er trimestre..." value={invoiceForm.description || ""} onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })} />
          </FormField>

          <AnimatePresence>
            {formError && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{formError}
              </motion.div>
            )}
            {formSuccess && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />{formSuccess}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setInvoiceModal(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm hover:bg-white/[0.04] hover:text-white transition-all">Annuler</button>
            <button onClick={handleCreateInvoice} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all disabled:opacity-60">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Créer la facture"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Record payment modal */}
      <Modal open={!!paymentModal} onClose={() => { setPaymentModal(null); setFormError(null); setFormSuccess(null); }} title="Enregistrer un paiement">
        {paymentModal && (
          <div className="space-y-4">
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Facture de</p>
              <p className="text-sm font-medium text-white">
                {paymentModal.student ? `${paymentModal.student.firstName} ${paymentModal.student.lastName}` : "—"}
              </p>
              <p className="text-xs text-gray-500 mt-1">Montant initial : <span className="text-amber-400">{formatCurrency(invoiceTotal(paymentModal))}</span></p>
              <p className="text-xs text-gray-500 mt-1">Reste à payer : <span className="text-emerald-400">{formatCurrency(invoiceBalance(paymentModal))}</span></p>
            </div>
            <FormField label="Montant payé (XOF)" required>
              <input type="number" className={inputCls} placeholder={String(invoiceBalance(paymentModal) || invoiceTotal(paymentModal))} value={paymentForm.amount || ""} onChange={(e) => setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })} />
            </FormField>
            <FormField label="Méthode de paiement">
              <select className={selectCls} value={paymentForm.method || "CASH"} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}>
                <option value="CASH">Espèces</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="BANK_TRANSFER">Virement</option>
                <option value="CHECK">Chèque</option>
              </select>
            </FormField>
            <FormField label="Nom du payeur">
              <input className={inputCls} placeholder="Nom du parent, tuteur ou élève..." value={paymentForm.payerName || ""} onChange={(e) => setPaymentForm({ ...paymentForm, payerName: e.target.value })} />
            </FormField>
            <FormField label="Note (optionnel)">
              <input className={inputCls} placeholder="Note sur le paiement..." value={paymentForm.note || ""} onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })} />
            </FormField>

            <AnimatePresence>
              {formError && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{formError}
                </motion.div>
              )}
              {formSuccess && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />{formSuccess}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setPaymentModal(null); setFormError(null); setFormSuccess(null); }} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm hover:bg-white/[0.04] hover:text-white transition-all">Annuler</button>
              <button onClick={handleRecordPayment} disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-all disabled:opacity-60">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Valider le paiement"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
