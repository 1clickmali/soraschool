"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Receipt,
  Search,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  FileText,
  Send,
  X,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableRowSkeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

type InvoiceStatus = "ISSUED" | "PAID" | "OVERDUE" | "CANCELED";

interface SaaSInvoice {
  id: string;
  number: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  institution: { id: string; name: string; slug: string };
  plan: { name: string } | null;
  subscription: { cycle: string } | null;
}

interface InvoicesResponse {
  invoices: SaaSInvoice[];
}

type PaymentProvider =
  | "CASH"
  | "WAVE"
  | "ORANGE_MONEY"
  | "MTN_MONEY"
  | "MOOV_MONEY"
  | "BANK_TRANSFER";

const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  CASH: "Cash",
  WAVE: "Wave",
  ORANGE_MONEY: "Orange Money",
  MTN_MONEY: "MTN Money",
  MOOV_MONEY: "Moov Money",
  BANK_TRANSFER: "Virement Bancaire",
};

// ── Status config ──────────────────────────────────────────────────────────────

const statusConfig: Record<
  InvoiceStatus,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  ISSUED: {
    label: "Émise",
    color: "text-orange-400",
    bg: "bg-orange-400/10",
    icon: Clock,
  },
  PAID: {
    label: "Payée",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    icon: CheckCircle,
  },
  OVERDUE: {
    label: "En retard",
    color: "text-red-400",
    bg: "bg-red-400/10",
    icon: AlertCircle,
  },
  CANCELED: {
    label: "Annulée",
    color: "text-gray-400",
    bg: "bg-gray-400/10",
    icon: XCircle,
  },
};

// ── Modal ──────────────────────────────────────────────────────────────────────

interface MarkPaidModalProps {
  invoice: SaaSInvoice;
  onClose: () => void;
  onSuccess: () => void;
}

function MarkPaidModal({ invoice, onClose, onSuccess }: MarkPaidModalProps) {
  const [provider, setProvider] = useState<PaymentProvider>("CASH");
  const [transactionRef, setTransactionRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    const { error: apiError } = await api.post(
      `/api/super-admin/saas-invoices/${invoice.id}/mark-paid`,
      { provider, transactionRef }
    );
    setSubmitting(false);
    if (apiError) {
      setError(apiError);
    } else {
      onSuccess();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md bg-soraCard border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div>
            <h3 className="text-base font-semibold text-white">Valider le paiement</h3>
            <p className="text-xs text-gray-400 mt-0.5">Facture {invoice.number}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/8 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Amount reminder */}
          <div className="flex items-center justify-between bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3">
            <span className="text-sm text-gray-400">Montant</span>
            <span className="text-sm font-semibold text-white">
              {formatCurrency(invoice.amount, invoice.currency)}
            </span>
          </div>

          {/* Provider select */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Mode de paiement
            </label>
            <div className="relative">
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as PaymentProvider)}
                className="w-full appearance-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 pr-10 text-sm text-white [&>option]:bg-soraCard focus:outline-none focus:border-soraBlue/50 transition-colors"
              >
                {(Object.keys(PROVIDER_LABELS) as PaymentProvider[]).map((p) => (
                  <option key={p} value={p}>
                    {PROVIDER_LABELS[p]}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            </div>
          </div>

          {/* Transaction ref */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Référence de transaction{" "}
              <span className="text-gray-600 normal-case font-normal">(optionnel)</span>
            </label>
            <input
              type="text"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              placeholder="Ex: TXN-20260502-001"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-soraBlue/50 transition-colors"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/8 bg-white/[0.01]">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={submitting}
            icon={<CheckCircle className="w-3.5 h-3.5" />}
            onClick={handleSubmit}
          >
            Confirmer le paiement
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

type StatusFilter = "ALL" | InvoiceStatus;

const FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "Toutes" },
  { value: "ISSUED", label: "Émises" },
  { value: "PAID", label: "Payées" },
  { value: "OVERDUE", label: "En retard" },
  { value: "CANCELED", label: "Annulées" },
];

export default function FacturesPage() {
  const [invoices, setInvoices] = useState<SaaSInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [markPaidInvoice, setMarkPaidInvoice] = useState<SaaSInvoice | null>(null);
  const [reminderLoading, setReminderLoading] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (search.trim()) params.set("search", search.trim());
    const qs = params.toString();
    const { data, error: apiError } = await api.get<InvoicesResponse>(
      `/api/super-admin/saas-invoices${qs ? `?${qs}` : ""}`
    );
    setInvoices(data?.invoices || []);
    if (apiError) setError(apiError);
    setLoading(false);
  }, [statusFilter, search]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleSendReminder = async (invoice: SaaSInvoice) => {
    setReminderLoading(invoice.id);
    await api.post(`/api/super-admin/saas-invoices/${invoice.id}/send-reminder`);
    setReminderLoading(null);
  };

  // Stats derived from all loaded invoices (before filter, but we use what we have)
  const stats = {
    total: invoices.length,
    paid: invoices.filter((inv) => inv.status === "PAID").length,
    pending: invoices.filter((inv) => inv.status === "ISSUED").length,
    overdue: invoices.filter((inv) => inv.status === "OVERDUE").length,
  };

  return (
    <div className="space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold font-heading text-white">Finance SaaS</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Gestion des factures d&apos;abonnement des établissements
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          icon={<RefreshCw className="w-3.5 h-3.5" />}
          onClick={loadInvoices}
        >
          Actualiser
        </Button>
      </motion.div>

      {/* Stats cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {[
          {
            label: "Total factures",
            value: stats.total,
            icon: FileText,
            color: "text-soraBlue",
            bg: "bg-soraBlue/10",
          },
          {
            label: "Payées",
            value: stats.paid,
            icon: CheckCircle,
            color: "text-emerald-400",
            bg: "bg-emerald-400/10",
          },
          {
            label: "En attente",
            value: stats.pending,
            icon: Clock,
            color: "text-orange-400",
            bg: "bg-orange-400/10",
          },
          {
            label: "En retard",
            value: stats.overdue,
            icon: AlertCircle,
            color: "text-red-400",
            bg: "bg-red-400/10",
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", stat.bg)}>
                  <Icon className={cn("w-4.5 h-4.5", stat.color)} />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
            </div>
          );
        })}
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un établissement…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-soraBlue/50 transition-colors"
          />
        </div>

        {/* Status tabs */}
        <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.08] rounded-xl p-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
                statusFilter === opt.value
                  ? "bg-soraBlue text-white shadow-sm"
                  : "text-gray-400 hover:text-white hover:bg-white/[0.06]"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Error state */}
      {error && !loading && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-4">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden"
      >
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/8">
              {["Numéro", "École", "Montant", "Statut", "Échéance", "Actions"].map((h) => (
                <th
                  key={h}
                  className="text-left px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                      <Receipt className="w-7 h-7 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-gray-400 font-medium">Aucune facture trouvée</p>
                      <p className="text-gray-600 text-sm mt-1">
                        {statusFilter !== "ALL" || search
                          ? "Essayez de modifier vos filtres de recherche."
                          : "Les factures SaaS générées apparaîtront ici automatiquement."}
                      </p>
                    </div>
                    {(statusFilter !== "ALL" || search) && (
                      <button
                        onClick={() => {
                          setStatusFilter("ALL");
                          setSearch("");
                        }}
                        className="text-xs text-soraBlue hover:text-blue-400 transition-colors"
                      >
                        Réinitialiser les filtres
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              invoices.map((invoice, i) => {
                const s = statusConfig[invoice.status] ?? statusConfig.ISSUED;
                const StatusIcon = s.icon;
                const canMarkPaid =
                  invoice.status === "ISSUED" || invoice.status === "OVERDUE";
                const canRemind = invoice.status === "OVERDUE";
                return (
                  <motion.tr
                    key={invoice.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.03 * i }}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                  >
                    {/* Numéro */}
                    <td className="px-5 py-4 text-sm font-mono text-soraBlue">
                      {invoice.number}
                    </td>

                    {/* École */}
                    <td className="px-5 py-4">
                      <p className="text-sm text-white font-medium">
                        {invoice.institution.name}
                      </p>
                      {invoice.plan && (
                        <p className="text-xs text-gray-500 mt-0.5">{invoice.plan.name}</p>
                      )}
                    </td>

                    {/* Montant */}
                    <td className="px-5 py-4 text-sm font-semibold text-white">
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </td>

                    {/* Statut */}
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                          s.color,
                          s.bg
                        )}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {s.label}
                      </span>
                    </td>

                    {/* Échéance */}
                    <td className="px-5 py-4 text-sm text-gray-400">
                      {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {canMarkPaid && (
                          <button
                            onClick={() => setMarkPaidInvoice(invoice)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 text-xs font-medium transition-colors"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Valider paiement
                          </button>
                        )}
                        {canRemind && (
                          <button
                            onClick={() => handleSendReminder(invoice)}
                            disabled={reminderLoading === invoice.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 hover:text-orange-300 text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            {reminderLoading === invoice.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Send className="w-3 h-3" />
                            )}
                            Relance
                          </button>
                        )}
                        {invoice.status === "PAID" && (
                          <span className="text-xs text-gray-600">
                            Payée le {invoice.paidAt ? formatDate(invoice.paidAt) : "—"}
                          </span>
                        )}
                        {invoice.status === "CANCELED" && (
                          <span className="text-xs text-gray-600">Annulée</span>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </motion.div>

      {/* Mark Paid Modal */}
      <AnimatePresence>
        {markPaidInvoice && (
          <MarkPaidModal
            invoice={markPaidInvoice}
            onClose={() => setMarkPaidInvoice(null)}
            onSuccess={loadInvoices}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
