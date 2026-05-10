"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  Crown,
  Zap,
  TrendingUp,
  Building2,
  GraduationCap,
  BookOpen,
  Users,
  Star,
  RefreshCw,
  Layers,
  BadgeCheck,
  Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TierBadge } from "@/components/ui/badge";
import { PlanCardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { superAdminApi, type Plan } from "@/lib/api";
import { formatCurrency, cn } from "@/lib/utils";

const TIER_CONFIG = {
  BASIC: {
    icon: Zap,
    gradient: "from-blue-600/20 to-blue-900/20",
    border: "border-blue-600/20",
    iconBg: "bg-blue-500/20",
    iconColor: "text-blue-400",
    badge: "blue",
    popular: false,
  },
  PREMIUM: {
    icon: TrendingUp,
    gradient: "from-purple-600/20 to-purple-900/20",
    border: "border-purple-500/30",
    iconBg: "bg-purple-500/20",
    iconColor: "text-purple-400",
    badge: "purple",
    popular: true,
  }
};

const PLAN_COPY: Record<"BASIC" | "PREMIUM", { label: string; description: string }> = {
  BASIC: {
    label: "Basic",
    description: "Idéal pour une école unique souhaitant digitaliser sa gestion complète.",
  },
  PREMIUM: {
    label: "Premium",
    description: "Idéal pour les groupes scolaires, réseaux d'écoles et établissements multi-sites.",
  }
};

const FEATURE_LABELS: Record<string, string> = {
  students: "Gestion des apprenants",
  classes: "Structure académique",
  teachers: "Gestion des enseignants",
  attendance: "Assiduité apprenants et enseignants",
  grades: "Évaluations, bulletins et décisions",
  payments: "Frais scolaires, paiements et reçus",
  documents: "Documents officiels et PDF",
  all_basic: "Tout le plan Basic",
  parent_portal: "Espace parents en lecture seule",
  pdf_cards: "Cartes, fiches et bulletins PDF",
  shop: "Stock & fournitures",
  messages: "Messagerie école-famille",
  advanced_exports: "Exports Excel/PDF avancés",
  all_premium: "Tout le plan Premium",
  multi_establishment: "Administration Centrale multi-écoles",
  unlimited_students: "Apprenants illimités",
  unlimited_teachers: "Enseignants illimités",
  api_mobile: "Application mobile et API",
  priority_support: "Support prioritaire",
};

function featureLabel(feature: string) {
  return FEATURE_LABELS[feature] ?? feature.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function limitLabel(value: number | undefined, unlimitedAt: number) {
  if (value === undefined || !Number.isFinite(value) || value >= unlimitedAt) return "∞";
  return value.toLocaleString("fr-FR");
}

function PlanCard({ plan, delay }: { plan: Plan; delay: number }) {
  const effectiveTier: "BASIC" | "PREMIUM" = plan.tier === "PREMIUM" || plan.canCreateBranches ? "PREMIUM" : "BASIC";
  const config = TIER_CONFIG[effectiveTier];
  const Icon = config.icon;
  const copy = PLAN_COPY[effectiveTier];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      className={cn(
        "relative bg-gradient-to-b rounded-2xl border overflow-hidden group",
        config.gradient,
        config.border,
        "bg-soraCard"
      )}
    >
      {/* Popular badge */}
      {config.popular && (
        <div className="absolute top-0 inset-x-0 flex justify-center">
          <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs font-bold px-4 py-1 rounded-b-xl">
            LE PLUS POPULAIRE
          </div>
        </div>
      )}

      {/* Subtle top glow */}
      <div className={cn(
        "absolute inset-x-0 top-0 h-px opacity-50",
        effectiveTier === "BASIC" ? "bg-blue-500" : "bg-purple-500"
      )} />

      <div className={cn("p-6", config.popular && "pt-10")}>
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", config.iconBg)}>
              <Icon className={cn("w-5 h-5", config.iconColor)} />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold font-heading text-white">{copy.label}</h3>
              <TierBadge tier={effectiveTier} />
            </div>
          </div>
        </div>
        <p className="mb-5 min-h-[40px] text-sm leading-snug text-gray-400">{copy.description}</p>

        {/* Price */}
        <div className="mb-6 space-y-2">
          <div className="flex items-center gap-2">
            <Banknote className="w-4 h-4 text-gray-500 shrink-0" />
            <span className="text-xs text-gray-500">Frais d'installation</span>
            <span className="ml-auto text-base font-bold text-white">{formatCurrency(plan.installationFee ?? 0)}</span>
          </div>
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-gray-500 shrink-0" />
            <span className="text-xs text-gray-500">Abonnement annuel</span>
            <span className="ml-auto text-base font-bold text-white">{formatCurrency(plan.annualPrice)}</span>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-white/[0.06]">
            <span className="text-xs text-emerald-400 font-medium">Total 1ère année</span>
            <span className="ml-auto text-lg font-bold text-emerald-300">
              {formatCurrency((plan.installationFee ?? 0) + plan.annualPrice)}
            </span>
          </div>
        </div>

        {/* Limits */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4 bg-black/20 rounded-xl p-3">
          {[
            { label: "Apprenants", value: limitLabel(plan.maxStudents ?? undefined, 10000), icon: GraduationCap },
            { label: "Enseignants", value: limitLabel(plan.maxTeachers ?? undefined, 500), icon: BookOpen },
            { label: "Établissements", value: String(plan.maxEstablishments || 1), icon: Building2 },
          ].map((limit, index) => (
            <div key={limit.label} className={cn("min-w-0 rounded-lg px-2 py-2 text-center", index === 1 && "sm:border-x sm:border-white/5")}>
              <div className="flex items-center justify-center text-gray-400 mb-1">
                <limit.icon className="w-3.5 h-3.5" />
              </div>
              <p className="text-base font-bold font-heading text-white leading-none">{limit.value}</p>
              <p className="mt-1 text-[11px] leading-tight text-gray-500 break-words">{limit.label}</p>
            </div>
          ))}
        </div>
        {/* Multi-school badge */}
        <div className={cn(
          "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border mb-4",
          plan.canCreateBranches
            ? "bg-purple-500/10 border-purple-500/20 text-purple-300"
            : "bg-blue-500/10 border-blue-500/20 text-blue-300"
        )}>
          {plan.canCreateBranches
            ? <><Layers className="w-3 h-3 shrink-0" /> Multi-établissements activé</>
            : <><BadgeCheck className="w-3 h-3 shrink-0" /> Établissement unique</>
          }
        </div>

        {/* Divider */}
        <div className="h-px bg-white/[0.06] mb-5" />

        {/* Features */}
        <ul className="space-y-2.5 mb-6">
          {plan.features.map((feature, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: delay + i * 0.03 }}
              className="flex items-start gap-2.5"
            >
              <div className={cn("w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5", config.iconBg)}>
                <Check className={cn("w-2.5 h-2.5", config.iconColor)} />
              </div>
              <span className="text-sm leading-snug text-gray-300">{featureLabel(feature)}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await superAdminApi.plans();
    let officialPlans = data?.plans || [];
    if (officialPlans.length === 0) {
      const synced = await superAdminApi.syncDefaultPlans();
      officialPlans = synced.data?.plans || [];
    }
    setPlans(officialPlans);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const syncOfficialPlans = async () => {
    setSyncing(true);
    await superAdminApi.syncDefaultPlans();
    await fetchData();
    setSyncing(false);
  };

  return (
    <div className="space-y-6 max-w-[1600px]">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold font-heading text-white">Plans & abonnements</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Deux plans actifs : Basic (200 000 XOF install. + 100 000 XOF/an) · Premium (300 000 XOF install. + 500 000 XOF/an).
          </p>
        </div>
        <Button variant="secondary" loading={syncing} icon={<RefreshCw className="w-4 h-4" />} onClick={syncOfficialPlans}>
          Synchroniser les plans
        </Button>
      </motion.div>

      {/* Stats summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {[
          { label: "Plans actifs", value: String(plans.filter(p => p.isActive !== false).length), icon: Users, color: "text-soraBlue", bg: "bg-soraBlue/10" },
          { label: "Basic — 1ère année", value: plans.find(p => p.code === "BASIC") ? formatCurrency((plans.find(p => p.code === "BASIC")!.installationFee ?? 0) + plans.find(p => p.code === "BASIC")!.annualPrice) : "—", icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Premium — 1ère année", value: plans.find(p => p.code === "PREMIUM") ? formatCurrency((plans.find(p => p.code === "PREMIUM")!.installationFee ?? 0) + plans.find(p => p.code === "PREMIUM")!.annualPrice) : "—", icon: Star, color: "text-purple-400", bg: "bg-purple-500/10" },
          { label: "Renouvellement max.", value: plans.length ? formatCurrency(Math.max(...plans.map((p) => p.annualPrice))) : "—", icon: TrendingUp, color: "text-soraGold", bg: "bg-soraGold/10" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className="bg-soraCard border border-white/8 rounded-xl p-4 flex items-center gap-3"
          >
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", stat.bg)}>
              <stat.icon className={cn("w-4 h-4", stat.color)} />
            </div>
            <div>
              <p className="text-lg font-bold font-heading text-white">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <PlanCardSkeleton key={i} />)
        ) : plans.length === 0 ? (
          <EmptyState
            className="md:col-span-2 xl:col-span-3"
            icon={<Crown className="h-10 w-10" />}
            title="Aucun plan configuré"
            description="Synchronisez les offres officielles Basic et Premium pour continuer."
            action={
              <Button variant="secondary" loading={syncing} icon={<RefreshCw className="w-4 h-4" />} onClick={syncOfficialPlans}>
                Synchroniser les plans
              </Button>
            }
          />
        ) : (
          plans.map((plan, index) => (
            <PlanCard key={plan.id} plan={plan} delay={index * 0.08} />
          ))
        )}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-soraBlue/20 bg-soraBlue/5 p-5">
        <p className="text-sm font-semibold text-soraBlue">Règles de facturation</p>
        <ul className="mt-2 text-xs text-gray-400 space-y-1 list-disc list-inside">
          <li>Plan Basic — 1 établissement unique, frais d'installation 200 000 XOF + 100 000 XOF/an</li>
          <li>Plan Premium — multi-établissements (jusqu'à 10), frais d'installation 300 000 XOF + 500 000 XOF/an</li>
          <li>Les frais d'installation sont facturés une seule fois à la création, puis uniquement l'abonnement annuel est renouvelé</li>
          <li>Les anciens plans sont désactivés et les écoles actives sont migrées vers Basic ou Premium</li>
        </ul>
      </motion.div>
    </div>
  );
}
