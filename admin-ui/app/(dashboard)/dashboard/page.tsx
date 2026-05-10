"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  CheckCircle,
  AlertCircle,
  Clock,
  GraduationCap,
  BookOpen,
  TrendingUp,
  DollarSign,
  Plus,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { StatCardSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { superAdminApi, type DashboardData, type Institution } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";

const EMPTY_DASHBOARD: DashboardData = {
  totalInstitutions: 0,
  activeInstitutions: 0,
  suspendedInstitutions: 0,
  expiredSubscriptions: 0,
  totalStudents: 0,
  totalTeachers: 0,
  monthlyRevenue: 0,
  annualRevenue: 0,
  recentInstitutions: [],
  institutionsByStatus: [],
  monthlyRevenueSeries: [],
};

const DONUT_COLORS = ["#10B981", "#0066FF", "#F97316", "#EF4444"];
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Actives",
  TRIAL: "Essai",
  SUSPENDED: "Suspendues",
  EXPIRED: "Expirées",
};

function emptyRevenueSeries() {
  const formatter = new Intl.DateTimeFormat("fr-FR", { month: "short" });
  const now = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
    return { month: formatter.format(date).replace(".", ""), revenue: 0, subscriptions: 0 };
  });
}

// Redirect modal — full form is on /institutions page
function NewInstitutionModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouvelle institution scolaire" size="sm">
      <div className="text-center py-4 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-soraBlue/10 flex items-center justify-center mx-auto">
          <Building2 className="w-7 h-7 text-soraBlue" />
        </div>
        <div>
          <p className="text-white font-semibold mb-1">Formulaire complet disponible</p>
          <p className="text-gray-400 text-sm">Le formulaire de création d&apos;école contient tous les champs requis (directeur, plan, facturation…)</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Annuler</Button>
          <Button onClick={() => { onClose(); window.location.href = "/institutions"; }} className="flex-1">
            Aller aux écoles →
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: apiData } = await superAdminApi.dashboard();
      setData(apiData || EMPTY_DASHBOARD);
      setLoading(false);
    };
    fetchData();
  }, []);

  const dashboard = data || EMPTY_DASHBOARD;
  const revenueData = dashboard.monthlyRevenueSeries?.length ? dashboard.monthlyRevenueSeries : emptyRevenueSeries();

  const donutData = (dashboard.institutionsByStatus || []).map(
    (item, i) => ({
      name: STATUS_LABELS[item.status] || item.status,
      value: item.count,
      color: DONUT_COLORS[i % DONUT_COLORS.length],
    })
  );

  return (
    <div className="space-y-6 max-w-[1600px]">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold font-heading text-white">Vue d&apos;ensemble</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Tableau de bord — {new Date().toLocaleDateString("fr-CI", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={() => window.location.reload()}
          >
            Actualiser
          </Button>
          <Button
            size="sm"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setShowNewModal(true)}
          >
            Nouvelle école
          </Button>
        </div>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              title="Total Institutions"
              value={dashboard.totalInstitutions}
              icon={Building2}
              color="blue"
              trend={12}
              trendLabel="ce mois"
              delay={0}
            />
            <StatCard
              title="Actives"
              value={dashboard.activeInstitutions}
              icon={CheckCircle}
              color="green"
              trend={5}
              trendLabel="vs mois dernier"
              delay={0.05}
            />
            <StatCard
              title="Suspendues"
              value={dashboard.suspendedInstitutions}
              icon={AlertCircle}
              color="orange"
              trend={-2}
              trendLabel="vs mois dernier"
              delay={0.1}
            />
            <StatCard
              title="Abonnements expirés"
              value={dashboard.expiredSubscriptions ?? 0}
              icon={Clock}
              color="red"
              trend={-8}
              trendLabel="ce mois"
              delay={0.15}
            />
            <StatCard
              title="Total apprenants"
              value={dashboard.totalStudents}
              icon={GraduationCap}
              color="purple"
              trend={18}
              trendLabel="croissance annuelle"
              delay={0.2}
            />
            <StatCard
              title="Enseignants"
              value={dashboard.totalTeachers}
              icon={BookOpen}
              color="indigo"
              trend={7}
              trendLabel="vs mois dernier"
              delay={0.25}
            />
            <StatCard
              title="Revenus mensuels"
              value={dashboard.monthlyRevenue}
              icon={TrendingUp}
              color="emerald"
              formatValue={(v) => formatCurrency(v)}
              trend={23}
              trendLabel="vs mois dernier"
              delay={0.3}
            />
            <StatCard
              title="Revenus annuels"
              value={dashboard.annualRevenue}
              icon={DollarSign}
              color="gold"
              formatValue={(v) => formatCurrency(v)}
              trend={31}
              trendLabel="vs année dernière"
              delay={0.35}
            />
          </>
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="lg:col-span-2 bg-soraCard border border-white/8 rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold font-heading text-white">
                Revenus mensuels
              </h2>
              <p className="text-gray-400 text-sm mt-0.5">12 derniers mois (XOF)</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <div className="w-2 h-2 rounded-full bg-soraBlue" />
                Revenus
              </div>
            </div>
          </div>
          <RevenueChart data={revenueData} />
        </motion.div>

        {/* Donut chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
          className="bg-soraCard border border-white/8 rounded-2xl p-6"
        >
          <div className="mb-4">
            <h2 className="text-base font-semibold font-heading text-white">
              Statut des institutions
            </h2>
            <p className="text-gray-400 text-sm mt-0.5">Répartition actuelle</p>
          </div>
          <DonutChart
            data={donutData}
            total={dashboard.totalInstitutions}
            label="Total"
          />
        </motion.div>
      </div>

      {/* Recent institutions + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent institutions table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="lg:col-span-2 bg-soraCard border border-white/8 rounded-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
            <div>
              <h2 className="text-base font-semibold font-heading text-white">
                Dernières institutions
              </h2>
              <p className="text-gray-400 text-sm mt-0.5">5 dernières créations</p>
            </div>
            <Link href="/institutions">
              <Button variant="ghost" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />} iconPosition="right">
                Voir tout
              </Button>
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {["Institution", "Type", "Statut", "Plan", "Créée le"].map((col) => (
                    <th
                      key={col}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {(dashboard.recentInstitutions || []).map((inst: Institution) => (
                  <tr
                    key={inst.id}
                    className="hover:bg-white/[0.02] transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-soraBlue/20 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-soraBlue" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{inst.name}</p>
                          <p className="text-xs text-gray-500">{inst.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-400">{inst.type}</span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={inst.status} />
                    </td>
                    <td className="px-6 py-4">
                      {inst.plan ? (
                        <span className="text-sm text-gray-300 font-medium">{inst.plan.name}</span>
                      ) : (
                        <span className="text-sm text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-400">{formatDate(inst.createdAt)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Quick actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.55 }}
          className="space-y-4"
        >
          {/* Quick actions card */}
          <div className="bg-soraCard border border-white/8 rounded-2xl p-6">
            <h2 className="text-base font-semibold font-heading text-white mb-4">
              Actions rapides
            </h2>
            <div className="space-y-3">
              <Button
                className="w-full justify-start"
                icon={<Plus className="w-4 h-4" />}
                onClick={() => setShowNewModal(true)}
              >
                Nouvelle école
              </Button>

              <Button
                variant="secondary"
                className="w-full justify-start"
                icon={<AlertCircle className="w-4 h-4" />}
              >
                Suspendre expirés
              </Button>

              <Link href="/plans" className="block">
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  icon={<ArrowRight className="w-4 h-4" />}
                  iconPosition="right"
                >
                  Voir tous les plans
                </Button>
              </Link>
            </div>
          </div>

          {/* Summary card */}
          <div className="bg-gradient-to-br from-soraBlue/20 to-purple-600/10 border border-soraBlue/20 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-soraBlue/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-soraBlue" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Taux de rétention</p>
                <p className="text-xs text-gray-400">ce trimestre</p>
              </div>
            </div>
            <p className="text-3xl font-bold font-heading text-white">
              87<span className="text-lg text-soraBlue">%</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">+4% vs trimestre précédent</p>
            <div className="mt-3 w-full bg-white/10 rounded-full h-1.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "87%" }}
                transition={{ duration: 1.5, delay: 0.8, ease: "easeOut" }}
                className="h-1.5 bg-gradient-to-r from-soraBlue to-purple-500 rounded-full"
              />
            </div>
          </div>
        </motion.div>
      </div>

      <NewInstitutionModal isOpen={showNewModal} onClose={() => setShowNewModal(false)} />
    </div>
  );
}
