import * as React from "react";
import { cn } from "@/lib/utils";

function Badge({ className, variant = "default", ...props }) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variant === "default" && "border-transparent bg-indigo-600 text-white shadow hover:bg-indigo-600/80",
        variant === "secondary" && "border-transparent bg-slate-800 text-slate-200 hover:bg-slate-800/80",
        variant === "destructive" && "border-transparent bg-rose-500 text-white shadow hover:bg-rose-500/80",
        variant === "outline" && "text-slate-300 border-slate-700",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
