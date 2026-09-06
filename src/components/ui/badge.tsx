import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "outline";
  className?: string;
  style?: React.CSSProperties;
}

function Badge({ children, variant = "default", className, style }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        variant === "outline" && "border",
        className
      )}
      style={{
        background: variant === "default" ? "var(--surface-3)" : "transparent",
        borderColor: variant === "outline" ? "var(--border)" : undefined,
        color: "var(--text-secondary)",
        fontSize: 10,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export { Badge };
