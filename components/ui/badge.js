import * as React from "react";
import { cn } from "@/lib/utils";

function Badge({ className, variant = "default", ...props }) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variant === "default" && "border-[color-mix(in_srgb,var(--action)_30%,transparent)] bg-[var(--action-surface)] text-[var(--action-on-muted)]",
        variant === "secondary" && "border-transparent bg-[var(--surface-quiet)] text-[var(--muted-foreground)]",
        variant === "destructive" && "border-transparent bg-red-500/15 text-red-400",
        variant === "outline" && "border-[var(--border-strong)] text-[var(--foreground)]",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
