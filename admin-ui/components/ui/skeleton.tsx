"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  rounded?: boolean;
}

export function Skeleton({ className, rounded = false }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-gradient-to-r from-white/5 via-white/10 to-white/5 bg-[length:200%_100%] animate-shimmer",
        rounded ? "rounded-full" : "rounded-lg",
        className
      )}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-soraCard border border-white/8 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <Skeleton className="w-16 h-5 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="w-24 h-8" />
        <Skeleton className="w-32 h-4" />
      </div>
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-white/5">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className={`h-4 ${i === 0 ? "w-32" : i === 1 ? "w-20" : "w-16"}`} />
        </td>
      ))}
    </tr>
  );
}

export function PlanCardSkeleton() {
  return (
    <div className="bg-soraCard border border-white/8 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="w-28 h-6" />
        <Skeleton className="w-20 h-5 rounded-full" />
      </div>
      <Skeleton className="w-36 h-10" />
      <Skeleton className="w-full h-px" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="w-full h-4" />
        ))}
      </div>
    </div>
  );
}
