"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Store, AlertCircle } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { ClientLoginForm } from "@/components/auth/client-login-form";
import { RegisterForm } from "@/components/auth/register-form";
import { ForgotPasswordFlow } from "@/components/auth/forgot-password-flow";

function SurfaceCard({ children, className = "" }) {
  return (
    <div
      className={
        "relative overflow-hidden rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-strong)]/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8 " +
        className
      }
    >
      {children}
    </div>
  );
}

function AuthNotice({ children, tone = "neutral" }) {
  const toneClasses =
    tone === "error"
      ? "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
      : "border-[var(--border-soft)] bg-[var(--surface-quiet)] text-[var(--foreground)]";

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={"mb-4 flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-medium " + toneClasses}
    >
      {tone === "error" ? <AlertCircle className="size-4 shrink-0 text-red-500" /> : null}
      <span>{children}</span>
    </motion.div>
  );
}

export function PublicAuthGate({ initialAuthView = "" }) {
  const searchParams = useSearchParams();
  const requestedView = searchParams.get("auth") || initialAuthView;
  const [authViewMode, setAuthViewMode] = useState(() =>
    requestedView === "register" || requestedView === "forgot" ? requestedView : "login",
  );
  const [notice, setNotice] = useState("");

  function syncAuthView(view) {
    if (view === "login" || view === "admin") {
      setAuthViewMode("login");
      return;
    }
    if (view === "register") {
      setAuthViewMode("register");
      return;
    }
    if (view === "forgot") {
      setAuthViewMode("forgot");
      return;
    }
    setAuthViewMode("login");
  }

  return (
    <div className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-[var(--background)] px-4 py-8 sm:px-6 lg:px-8">
      {/* Background ambient lighting blobs */}
      <div className="pointer-events-none absolute -left-20 -top-20 size-96 rounded-full bg-[var(--accent)]/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 size-96 rounded-full bg-[var(--action)]/15 blur-3xl" />

      {/* Main Container - Centered Login Card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Header directly above the login card with branding on left and theme toggle on right */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[var(--action)] text-[var(--action-foreground)] shadow-md transition-transform hover:scale-105">
              <Store className="size-6" />
            </div>
            <div>
              <h1 className="font-display text-base font-bold tracking-tight text-[var(--foreground)] sm:text-lg">
                Soeum Savet Store
              </h1>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                Wholesale & Retail POS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>

        {/* Auth Glass Card */}
        <SurfaceCard className="w-full">
          {notice ? <AuthNotice>{notice}</AuthNotice> : null}

          <AnimatePresence mode="wait">
            {authViewMode === "login" && (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <ClientLoginForm
                  onSwitchToRegister={() => syncAuthView("register")}
                  onSwitchToForgot={() => syncAuthView("forgot")}
                />
              </motion.div>
            )}

            {authViewMode === "register" && (
              <motion.div
                key="register"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <RegisterForm onSwitchToLogin={() => syncAuthView("login")} />
              </motion.div>
            )}

            {authViewMode === "forgot" && (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <ForgotPasswordFlow onSwitchToLogin={() => syncAuthView("login")} />
              </motion.div>
            )}
          </AnimatePresence>
        </SurfaceCard>
      </div>
    </div>
  );
}

