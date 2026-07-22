"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";

import { ClientLoginForm } from "@/components/auth/client-login-form";
import { RegisterForm } from "@/components/auth/register-form";
import { ForgotPasswordFlow } from "@/components/auth/forgot-password-flow";

function SurfaceCard({ children, className = "" }) {
  return <div className={"app-card p-4 sm:p-6 " + className}>{children}</div>;
}

function AuthNotice({ children, tone = "neutral" }) {
  const toneClasses =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-[var(--border-soft)] bg-[var(--surface-quiet)] text-[var(--foreground)]";

  return <div className={"rounded-2xl border px-4 py-3 text-sm " + toneClasses}>{children}</div>;
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

  if (authViewMode === "login") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
        <div className="absolute left-6 top-6">
          <ThemeToggle />
        </div>

        <SurfaceCard className="w-full max-w-md">
          {notice ? <AuthNotice>{notice}</AuthNotice> : null}

          <ClientLoginForm
            onSwitchToRegister={() => syncAuthView("register")}
            onSwitchToForgot={() => syncAuthView("forgot")}
          />
        </SurfaceCard>
      </div>
    );
  }

  if (authViewMode === "register") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
        <div className="absolute left-6 top-6">
          <ThemeToggle />
        </div>

        <SurfaceCard className="w-full max-w-md">
          <RegisterForm onSwitchToLogin={() => syncAuthView("login")} />
        </SurfaceCard>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <div className="absolute left-6 top-6">
        <ThemeToggle />
      </div>

      <SurfaceCard className="w-full max-w-md">
        <ForgotPasswordFlow onSwitchToLogin={() => syncAuthView("login")} />
      </SurfaceCard>
    </div>
  );
}

