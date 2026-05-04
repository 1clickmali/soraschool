"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  CreditCard,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Receipt,
  TrendingUp,
  Calendar,
  Package,
  Users,
  Building2,
  Zap,
  RefreshCw,
} from "lucide-react";
import { schoolApi, type SubscriptionData } from "@/lib/school-api";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; bg: string }> = {
  ACTIVE: { label: "Actif", color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/25", icon: CheckCircle },
  TRIALING: { label: "Période d'essai", color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/25", icon: Zap },
  PENDING_PAYMENT: { label: "Paiement en attente", color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/25", icon: Clock },
  SUSPENDED: { label: "Suspendu", color: "text-red-400", bg: "bg-red-500/15 border-red-500/25", icon: XCircle },
  EXPIRED: { label: "Expiré", color: "text-gray-400", bg: "bg-gray-500/15 border-gray-500/25", icon: XCircle },
  TRIAL: { label: "Période d'essai", color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/25", icon: Zap },
};

const INS_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Actif", color: "text-emerald-400" },
  TRIAL: { label: "Essai gratuit", color: "text-blue-400" },
  PENDING_PAYMENT: { label: "Paiement requis", color: "text-amber-400" },
  SUSPENDED: { label: "Suspendu", color: "text-red-400" },
  EXPIRED: { label: "Expiré", color: "text-gray-400" },
};

const INVOICE_STATUS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Brouillon", color: "text-gray-400" },
  ISSUED: { label: "Émise", color: "text-amber-400" },
  PAID: { label: "Payée", color: "text-emerald-400" },
  OVERDUE: { label: "En retard", color: "text-red-400" },
  CANCELED: { label: "Annulée", color: "text-gray-500" },
};

const CYCLE_LABELS: Record<string, string> = {
  MONTHLY: "Mensuel",
  ANNUAL: "Annuel",
  TWO_YEAR: "2 ans",
  FIVE_YEAR: "5 ans",
  TEN_YEAR: "10 ans",
};

const TIER_LABELS: Record<string, string> = {
  FREE: "Gratuit",
  STARTER: "Starter",
  GROWTH: "Growth",
  PRO: "Pro",
  ENTERPRISE: "Enterprise",
};

function StatCard({ icon: Icon, label, value, sub, color = "text-white" }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 flex items-start gap-3">
      <div className="p-2 rounded-lg bg-white/[0.05]">
        <Icon className={cn("w-4 h-4", color)} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className={cn("text-lg font-bold font-heading mt-0.5", color)}>{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function AbonnementPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data: res, error: err } = await schoolApi.mySubscription();
    if (err) setError(err);
    else if (res) setData(res);
    setLoading(false);
  };

  useEffect(() => { load(); }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-soraDark flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm">Chargement…</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-soraDark flex items-center justify-center p-4">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <p className="text-white font-semibold mb-1">Impossible de charger l'abonnement</p>
          <p className="text-gray-400 text-sm mb-4">{error}</p>
          <button onClick={load} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  const { institution, subscription, invoices, payments, summary } = data;
  const insStatus = INS_STATUS_CONFIG[institution.status] ?? { label: institution.status, color: "text-gray-400" };
  const subStatus = subscription ? (STATUS_CONFIG[subscription.status] ?? STATUS_CONFIG.SUSPENDED) : null;
  const SubIcon = subStatus?.icon ?? Clock;

  const daysLeft = subscription?.endsAt
    ? Math.max(0, Math.ceil((new Date(subscription.endsAt).getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <div className="min-h-screen bg-soraDark text-white">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-emerald-500/15">
              <CreditCard className="w-5 h-5 text-emerald-400" />
            </div>
            <h1 className="text-xl font-bold font-heading">Mon abonnement</h1>
          </div>
          <p className="text-sm text-gray-400 ml-12">{institution.name}</p>
        </motion.div>

        {/* Status Banner */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          {subStatus ? (
            <div className={cn("rounded-2xl border p-5 flex items-start gap-4", subStatus.bg)}>
              <SubIcon className={cn("w-6 h-6 mt-0.5 shrink-0", subStatus.color)} />
              <div>
                <p className={cn("font-semibold", subStatus.color)}>{subStatus.label}</p>
                {subscription && (
                  <p className="text-sm text-gray-300 mt-0.5">
                    Plan <span className="font-semibold text-white">{subscription.plan?.name ?? "—"}</span>
                    {" · "}{CYCLE_LABELS[subscription.cycle] ?? subscription.cycle}
                    {daysLeft !== null && (
                      <span className={cn("ml-2", daysLeft <= 7 ? "text-red-400" : "text-gray-400")}>
                        — {daysLeft} jour{daysLeft !== 1 ? "s" : ""} restant{daysLeft !== 1 ? "s" : ""}
                      </span>
                    )}
                  </p>
                )}
                {subscription?.endsAt && (
                  <p className="text-xs text-gray-400 mt-1">
                    Expire le {formatDate(subscription.endsAt)}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <p className="text-amber-300 text-sm">Aucun abonnement actif — Contactez l'administration.</p>
            </div>
          )}
        </motion.div>

        {/* Plan Details */}
        {subscription?.plan && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-4 flex items-center gap-2">
              <Package className="w-4 h-4" /> Détails du plan
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <p className="text-xs text-gray-500">Plan</p>
                <p className="text-sm font-bold text-white mt-1">{subscription.plan.name}</p>
                <p className="text-xs text-gray-500">{TIER_LABELS[subscription.plan.tier] ?? subscription.plan.tier}</p>
              </div>
              <div className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <p className="text-xs text-gray-500">Élèves max</p>
                <p className="text-sm font-bold text-white mt-1">
                  {subscription.plan.maxStudents != null ? subscription.plan.maxStudents.toLocaleString() : "Illimité"}
                </p>
              </div>
              <div className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <p className="text-xs text-gray-500">Enseignants max</p>
                <p className="text-sm font-bold text-white mt-1">
                  {subscription.plan.maxTeachers != null ? subscription.plan.maxTeachers.toLocaleString() : "Illimité"}
                </p>
              </div>
              <div className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <p className="text-xs text-gray-500">Établissements</p>
                <p className="text-sm font-bold text-white mt-1">{subscription.plan.maxEstablishments}</p>
              </div>
            </div>
            {subscription.plan.features && typeof subscription.plan.features === "object" && (
              <div className="mt-4 flex flex-wrap gap-2">
                {Object.entries(subscription.plan.features as Record<string, boolean>)
                  .filter(([, v]) => v)
                  .map(([k]) => (
                    <span key={k} className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {k}
                    </span>
                  ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Financial Summary */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Résumé financier
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard icon={Receipt} label="Total facturé" value={formatCurrency(summary.totalBilled)} color="text-white" />
            <StatCard icon={CheckCircle} label="Total payé" value={formatCurrency(summary.totalPaid)} color="text-emerald-400" />
            <StatCard
              icon={summary.remaining > 0 ? AlertTriangle : CheckCircle}
              label="Solde restant"
              value={formatCurrency(summary.remaining)}
              color={summary.remaining > 0 ? "text-amber-400" : "text-emerald-400"}
            />
          </div>
        </motion.div>

        {/* Invoices */}
        {invoices.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.07] flex items-center gap-2">
              <Receipt className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-300">Factures ({invoices.length})</h2>
            </div>
            <div className="divide-y divide-white/[0.05]">
              {invoices.map((inv) => {
                const st = INVOICE_STATUS[inv.status] ?? { label: inv.status, color: "text-gray-400" };
                return (
                  <div key={inv.id} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium truncate">{inv.number}</p>
                      <p className="text-xs text-gray-500">{formatDate(inv.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={cn("text-xs font-medium", st.color)}>{st.label}</span>
                      <span className="text-sm font-semibold text-white">{formatCurrency(inv.amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Payment History */}
        {payments.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.07] flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-300">Historique des paiements ({payments.length})</h2>
            </div>
            <div className="divide-y divide-white/[0.05]">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm text-white font-medium truncate">{p.transactionRef ?? "Paiement"}</p>
                    <p className="text-xs text-gray-500">{formatDate(p.createdAt)}</p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-400 shrink-0">{formatCurrency(p.amount)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {invoices.length === 0 && payments.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="text-center py-12 text-gray-500">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Aucune transaction pour le moment.</p>
          </motion.div>
        )}

        {/* Contact block */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 text-center">
          <p className="text-sm text-gray-400">
            Pour renouveler, mettre à niveau ou régler une facture, contactez l'administration SoraSchool.
          </p>
          <p className="text-xs text-gray-500 mt-1">contact@soratech.ci · 0704928068</p>
        </motion.div>

      </div>
    </div>
  );
}
