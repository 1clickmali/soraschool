"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Building2, CheckCircle, Clock, CreditCard, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableRowSkeleton } from "@/components/ui/skeleton";
import { superAdminApi, type Institution, type SaaSPayment } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";

const statusConfig = {
  PAID: { label: "Payé", color: "text-emerald-400 bg-emerald-400/10", icon: CheckCircle },
  PENDING: { label: "En attente", color: "text-orange-400 bg-orange-400/10", icon: Clock },
  PROCESSING: { label: "Traitement", color: "text-soraBlue bg-soraBlue/10", icon: RefreshCw },
  FAILED: { label: "Échoué", color: "text-red-400 bg-red-400/10", icon: XCircle },
  CANCELED: { label: "Annulé", color: "text-gray-400 bg-gray-400/10", icon: XCircle },
  REFUNDED: { label: "Remboursé", color: "text-purple-400 bg-purple-400/10", icon: RefreshCw },
};

export default function PaymentsPage() {
  const [payments, setPayments] = useState<SaaSPayment[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");
  const [loading, setLoading] = useState(true);

  const loadPayments = async () => {
    setLoading(true);
    const { data } = await superAdminApi.payments(selectedInstitutionId || undefined);
    setPayments(data?.payments || []);
    setLoading(false);
  };

  useEffect(() => {
    superAdminApi.institutions().then(({ data }) => setInstitutions(data?.institutions || []));
  }, []);

  useEffect(() => {
    loadPayments();
  }, [selectedInstitutionId]);

  return (
    <div className="space-y-6 max-w-[1600px]">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading text-white">Paiements SaaS</h1>
          <p className="text-gray-400 text-sm mt-0.5">{payments.length} paiement{payments.length !== 1 ? "s" : ""} enregistré{payments.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <select
              value={selectedInstitutionId}
              onChange={(event) => setSelectedInstitutionId(event.target.value)}
              className="min-w-[240px] rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white [&>option]:bg-soraCard"
            >
              <option value="">Toutes les écoles</option>
              {institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}
            </select>
          </div>
          <Button size="sm" variant="secondary" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={loadPayments}>
            Actualiser
          </Button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-soraCard border border-white/8 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/8">
              {["Référence", "Institution", "Plan", "Montant", "Statut", "Date"].map((h) => (
                <th key={h} className="text-left px-5 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
            ) : payments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center">
                  <CreditCard className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">Aucun paiement SaaS pour le moment</p>
                  <p className="text-gray-600 text-sm mt-1">Les paiements clients apparaîtront ici automatiquement.</p>
                </td>
              </tr>
            ) : (
              payments.map((payment, i) => {
                const s = statusConfig[payment.status] || statusConfig.PENDING;
                return (
                  <motion.tr key={payment.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.04 * i }}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4 text-sm font-mono text-soraBlue">{payment.transactionRef || payment.id.slice(-10).toUpperCase()}</td>
                    <td className="px-5 py-4 text-sm text-white font-medium">{payment.institution?.name || "Institution supprimée"}</td>
                    <td className="px-5 py-4 text-sm text-gray-400">{payment.subscription?.plan?.name || "—"}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-white">{formatCurrency(payment.amount, payment.currency)}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.color}`}>
                        <s.icon className="w-3 h-3" />{s.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-400">{formatDate(payment.paidAt || payment.createdAt)}</td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
}
