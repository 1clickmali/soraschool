"use client";

import { forwardRef, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "gold";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      iconPosition = "left",
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-soraDark disabled:opacity-50 disabled:cursor-not-allowed select-none";

    const variants = {
      primary:
        "bg-soraBlue hover:bg-blue-500 active:bg-blue-700 text-white focus:ring-soraBlue shadow-lg hover:shadow-glow-blue",
      secondary:
        "bg-white/10 hover:bg-white/15 active:bg-white/5 text-white border border-white/10 hover:border-white/20 focus:ring-white/30",
      ghost:
        "bg-transparent hover:bg-white/8 active:bg-white/5 text-gray-300 hover:text-white focus:ring-white/20",
      danger:
        "bg-red-500/20 hover:bg-red-500/30 active:bg-red-500/10 text-red-400 hover:text-red-300 border border-red-500/30 focus:ring-red-500",
      gold: "bg-soraGold hover:bg-yellow-500 active:bg-yellow-700 text-white focus:ring-soraGold shadow-lg hover:shadow-glow-gold",
    };

    const sizes = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2.5 text-sm",
      lg: "px-6 py-3 text-base",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          icon && iconPosition === "left" && <span className="w-4 h-4">{icon}</span>
        )}
        {children}
        {!loading && icon && iconPosition === "right" && (
          <span className="w-4 h-4">{icon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
