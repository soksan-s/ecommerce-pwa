"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ShieldCheck, Mail, Lock, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hidePassword, setHidePassword] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submittingRef = useRef(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (submittingRef.current) return;
    submittingRef.current = true;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      submittingRef.current = false;
      setError("Enter admin email.");
      return;
    }

    if (!password) {
      submittingRef.current = false;
      setError("Enter password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
          roleHint: "admin",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Unable to login as admin.");
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Unable to login right now.");
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  }

  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-[var(--background)] px-4 py-8">
      {/* Ambient background light blobs */}
      <div className="pointer-events-none absolute -left-20 -top-20 size-96 rounded-full bg-[var(--accent)]/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 size-96 rounded-full bg-[var(--action)]/15 blur-3xl" />

      <section className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-strong)]/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2.5 rounded-2xl bg-amber-500/10 px-3.5 py-2 text-amber-600 dark:text-amber-400">
            <ShieldCheck className="size-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Management Console</span>
          </div>
          <ThemeToggle />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
              Admin Portal
            </h1>
            <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
              Sign in to manage products, orders, inventory, and sales analytics.
            </p>
          </div>

          <div>
            <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              <Mail className="size-3.5" />
              <span>Admin Email</span>
            </label>
            <div className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-quiet)]/80 focus-within:border-[var(--action)] focus-within:ring-2 focus-within:ring-[var(--action)]/20">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@soeumsavet.com"
                className="h-12 w-full bg-transparent px-3.5 text-sm font-medium text-[var(--foreground)] outline-none"
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              <Lock className="size-3.5" />
              <span>Password</span>
            </label>
            <div className="relative overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-quiet)]/80 focus-within:border-[var(--action)] focus-within:ring-2 focus-within:ring-[var(--action)]/20">
              <input
                type={hidePassword ? "password" : "text"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="h-12 w-full bg-transparent px-3.5 pr-11 text-sm font-medium text-[var(--foreground)] outline-none"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setHidePassword((current) => !current)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                aria-label="Toggle password visibility"
              >
                {hidePassword ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </button>
            </div>
          </div>

          {error ? (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2.5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400"
            >
              <AlertCircle className="size-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </motion.div>
          ) : null}

          <Button
            type="submit"
            className="relative h-12 w-full rounded-2xl bg-[var(--action)] text-sm font-bold text-[var(--action-foreground)] shadow-lg transition-all hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-70"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                <span>Authenticating...</span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span>Login to Admin Portal</span>
                <ArrowRight className="size-4" />
              </span>
            )}
          </Button>
        </form>
      </section>
    </main>
  );
}
