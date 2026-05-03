"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TierBadge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { PlanCardSkeleton } from "@/components/ui/skeleton";
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
  },
  ENTERPRISE: {
    icon: Crown,
    gradient: "from-yellow-600/20 to-yellow-900/20",
    border: "border-yellow-500/30",
    iconBg: "bg-yellow-500/20",
    iconColor: "text-yellow-400",
    badge: "gold",
    popular: false,
  },
};

const PLAN_COPY: Record<Plan["tier"], { label: string; description: string }> = {
  BASIC: {
    label: "Basic",
    description: "Pour une école unique qui démarre sa gestion numérique.",
  },
  PREMIUM: {
    label: "Premium",
    description: "Pour une école complète avec parents, PDF, boutique et exports.",
  },
  ENTERPRISE: {
    label: "Entreprise",
    description: "Pour les groupes scolaires avec plusieurs établissements.",
  },
};

const FEATURE_LABELS: Record<string, string> = {
  students: "Gestion des élèves",
  classes: "Classes et niveaux",
  teachers: "Gestion des enseignants",
  attendance: "Présences élèves et professeurs",
  grades: "Notes, bulletins et décisions",
  payments: "Frais scolaires, paiements et reçus",
  documents: "Documents officiels et PDF",
  all_basic: "Tout le plan Basic",
  parent_portal: "Espace parents en lecture seule",
  pdf_cards: "Cartes, fiches et bulletins PDF",
  shop: "Boutique scolaire et stock",
  messages: "Messagerie école-famille",
  advanced_exports: "Exports Excel/PDF avancés",
  all_premium: "Tout le plan Premium",
  multi_establishment: "Administration Centrale multi-écoles",
  unlimited_students: "Élèves illimités",
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
  const config = TIER_CONFIG[plan.tier];
  const Icon = config.icon;
  const copy = PLAN_COPY[plan.tier];

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
        plan.tier === "BASIC" ? "bg-blue-500" :
        plan.tier === "PREMIUM" ? "bg-purple-500" :
        "bg-yellow-500"
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
              <TierBadge tier={plan.tier} />
            </div>
          </div>
        </div>
        <p className="mb-5 min-h-[40px] text-sm leading-snug text-gray-400">{copy.description}</p>

        {/* Price */}
        <div className="mb-6">
          {plan.monthlyPrice === 0 ? (
            <div>
              <span className="text-3xl font-bold font-heading text-white">Gratuit</span>
              <p className="text-gray-500 text-sm mt-1">Pour toujours</p>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
                <span className="text-[2rem] font-bold font-heading leading-tight text-white">
                  {formatCurrency(plan.monthlyPrice)}
                </span>
                <span className="text-gray-400 text-sm">/mois</span>
              </div>
              <p className="text-gray-500 text-sm mt-1 leading-snug">
                {formatCurrency(plan.annualPrice)}/an
                <span className="ml-2 text-emerald-400 text-xs font-medium">
                  (économisez {Math.round((1 - plan.annualPrice / (plan.monthlyPrice * 12)) * 100)}%)
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Limits */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-6 bg-black/20 rounded-xl p-3">
          {[
            { label: "Élèves", value: limitLabel(plan.maxStudents, 10000), icon: GraduationCap },
            { label: "Enseignants", value: limitLabel(plan.maxTeachers, 500), icon: BookOpen },
            {
              label: "Établissements",
              value: plan.canCreateBranches || plan.tier === "ENTERPRISE" ? "∞" : String(plan.maxEstablishments || 1),
              icon: Building2,
            },
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

function CreatePlanModal({ isOpen, onClose, onCreated }: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (plan: Plan) => void;
}) {
  const [formData, setFormData] = useState({
    name: "",
    tier: "BASIC" as Plan["tier"],
    monthlyPrice: 0,
    annualPrice: 0,
    maxStudents: 500,
    maxTeachers: 40,
    featuresInput: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const features = formData.featuresInput
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);

    const { data, error: err } = await superAdminApi.createPlan({
      name: formData.name,
      tier: formData.tier,
      monthlyPrice: formData.monthlyPrice,
      annualPrice: formData.annualPrice,
      maxStudents: formData.maxStudents,
      maxTeachers: formData.maxTeachers,
      features,
    });

    setLoading(false);
    if (err || !data) { setError(err || "Erreur"); return; }
    onCreated(data.plan);
    onClose();
  };

  const inputClass = "w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 focus:border-soraBlue/50 transition-colors text-sm";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Créer un plan" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Nom du plan</label>
            <input
              required
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Business Pro"
              className={inputClass}
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Niveau (tier)</label>
            <select
              value={formData.tier}
              onChange={(e) => setFormData({ ...formData, tier: e.target.value as Plan["tier"] })}
              className={inputClass}
            >
              {["BASIC", "PREMIUM", "ENTERPRISE"].map((t) => (
                <option key={t} value={t} className="bg-soraCard">{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Prix mensuel (XOF)</label>
            <input
              type="number"
              min={0}
              value={formData.monthlyPrice}
              onChange={(e) => setFormData({ ...formData, monthlyPrice: Number(e.target.value) })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Prix annuel (XOF)</label>
            <input
              type="number"
              min={0}
              value={formData.annualPrice}
              onChange={(e) => setFormData({ ...formData, annualPrice: Number(e.target.value) })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Max élèves</label>
            <input
              type="number"
              min={1}
              value={formData.maxStudents}
              onChange={(e) => setFormData({ ...formData, maxStudents: Number(e.target.value) })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Max enseignants</label>
            <input
              type="number"
              min={1}
              value={formData.maxTeachers}
              onChange={(e) => setFormData({ ...formData, maxTeachers: Number(e.target.value) })}
              className={inputClass}
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Fonctionnalités <span className="text-gray-500 font-normal">(une par ligne)</span>
            </label>
            <textarea
              rows={5}
              value={formData.featuresInput}
              onChange={(e) => setFormData({ ...formData, featuresInput: e.target.value })}
              placeholder={"Gestion des classes\nSuivi de présence\nBulletins scolaires"}
              className={cn(inputClass, "resize-none")}
            />
          </div>
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">{error}</div>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose} className="flex-1">Annuler</Button>
          <Button type="submit" loading={loading} className="flex-1">Créer le plan</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await superAdminApi.plans();
    setPlans(data?.plans || []);
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
            Offres officielles : Basic 55 000 XOF, Premium 125 000 XOF, Entreprise 200 000 XOF.
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
          { label: "Plans actifs", value: String(plans.length), icon: Users, color: "text-soraBlue", bg: "bg-soraBlue/10" },
          { label: "Prix mensuel min.", value: plans.length ? formatCurrency(Math.min(...plans.map((p) => p.monthlyPrice))) : "—", icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Plan premium", value: plans.find((p) => p.tier === "PREMIUM")?.name || "—", icon: Star, color: "text-purple-400", bg: "bg-purple-500/10" },
          { label: "Prix annuel max.", value: plans.length ? formatCurrency(Math.max(...plans.map((p) => p.annualPrice))) : "—", icon: TrendingUp, color: "text-soraGold", bg: "bg-soraGold/10" },
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
          <div className="md:col-span-2 xl:col-span-3 bg-soraCard border border-white/8 rounded-2xl p-10 text-center">
            <Crown className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">Aucun plan configuré</p>
            <p className="text-gray-600 text-sm mt-1">Cliquez sur Synchroniser les plans pour créer les offres officielles.</p>
          </div>
        ) : (
          plans.map((plan, index) => (
            <PlanCard key={plan.id} plan={plan} delay={index * 0.08} />
          ))
        )}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-soraBlue/20 bg-soraBlue/5 p-5">
        <p className="text-sm font-semibold text-soraBlue">Règles automatiques appliquées</p>
        <p className="mt-1 text-xs text-gray-400">
          Basic et Premium restent sur un seul établissement. Le plan Entreprise active la création de filiales et autorise plusieurs établissements pour une même école.
        </p>
      </motion.div>
    </div>
  );
}
