"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";

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
    <main className="flex min-h-dvh items-center justify-center px-4 py-8">
      <section className="app-card w-full max-w-[28rem] p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="inline-flex rounded-2xl bg-[color-mix(in_srgb,var(--action)_14%,var(--surface))] p-3 text-[var(--action)]">
            <ShieldCheck className="size-6" />
          </div>
          <ThemeToggle />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="app-top-label">Admin</p>
            <h1 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">Admin login</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">
              Sign in to manage products, orders, inventory, and sales reports.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Admin email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="app-input px-4 py-3"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Password</label>
            <div className="relative">
              <input
                type={hidePassword ? "password" : "text"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="app-input px-4 py-3 pr-12"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setHidePassword((current) => !current)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
                aria-label="Toggle password visibility"
              >
                {hidePassword ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </button>
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Please wait..." : "Login as admin"}
          </Button>
        </form>
      </section>
    </main>
  );
}
