import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("rounded-2xl border border-white/8 bg-soraCard p-10 text-center", className)}>
      {icon && <div className="mb-3 flex justify-center text-gray-700">{icon}</div>}
      <p className="font-medium text-gray-300">{title}</p>
      {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
