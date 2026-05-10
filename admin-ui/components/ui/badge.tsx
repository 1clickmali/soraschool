"use client";

import { cn } from "@/lib/utils";

type BadgeVariant =
  | "active"
  | "trial"
  | "suspended"
  | "expired"
  | "free"
  | "starter"
  | "growth"
  | "basic"
  | "premium"
  | "enterprise"
  | "default";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 ring-1 ring-emerald-500/10",
  trial: "bg-blue-500/15 text-blue-400 border border-blue-500/25 ring-1 ring-blue-500/10",
  suspended: "bg-orange-500/15 text-orange-400 border border-orange-500/25 ring-1 ring-orange-500/10",
  expired: "bg-red-500/15 text-red-400 border border-red-500/25 ring-1 ring-red-500/10",
  free: "bg-gray-500/15 text-gray-400 border border-gray-500/25 ring-1 ring-gray-500/10",
  starter: "bg-blue-500/15 text-blue-400 border border-blue-500/25 ring-1 ring-blue-500/10",
  growth: "bg-purple-500/15 text-purple-400 border border-purple-500/25 ring-1 ring-purple-500/10",
  basic: "bg-blue-500/15 text-blue-400 border border-blue-500/25 ring-1 ring-blue-500/10",
  premium: "bg-purple-500/15 text-purple-400 border border-purple-500/25 ring-1 ring-purple-500/10",
  enterprise: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/25 ring-1 ring-yellow-500/10",
  default: "bg-gray-500/15 text-gray-400 border border-gray-500/25",
};

const dotColors: Record<BadgeVariant, string> = {
  active: "bg-emerald-400",
  trial: "bg-blue-400",
  suspended: "bg-orange-400",
  expired: "bg-red-400",
  free: "bg-gray-400",
  starter: "bg-blue-400",
  growth: "bg-purple-400",
  basic: "bg-blue-400",
  premium: "bg-purple-400",
  enterprise: "bg-yellow-400",
  default: "bg-gray-400",
};

const labelMap: Record<string, string> = {
  active: "Actif",
  trial: "Essai",
  suspended: "Suspendu",
  expired: "Expiré",
  ACTIVE: "Actif",
  TRIAL: "Essai",
  SUSPENDED: "Suspendu",
  EXPIRED: "Expiré",
  BASIC: "Basic",
  PREMIUM: "Premium",
  ENTERPRISE: "Premium legacy",
};

export function Badge({ variant = "default", children, className, dot = false }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {dot && (
        <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", dotColors[variant])} />
      )}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const variant = status.toLowerCase() as BadgeVariant;
  const label = labelMap[status] || status;
  return (
    <Badge variant={variant} dot>
      {label}
    </Badge>
  );
}

export function TierBadge({ tier }: { tier: string }) {
  const variant = tier.toLowerCase() as BadgeVariant;
  const label = labelMap[tier] || tier;
  return (
    <Badge variant={variant}>
      {label}
    </Badge>
  );
}
