"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, Phone, Lock, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { phoneAuthEmail } from "@/lib/phone";

function getRoleRedirect(role) {
  if (role === "ADMIN" || role === "SUPER_ADMIN") return "/admin";
  if (role === "CASHIER" || role === "MANAGER") return "/pos";
  return "/client";
}

function AuthNotice({ children, tone = "neutral" }) {
  const toneClasses =
    tone === "error"
      ? "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
      : "border-[var(--border-soft)] bg-[var(--surface-quiet)] text-[var(--foreground)]";

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={"flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-medium " + toneClasses}
    >
      {tone === "error" ? <AlertCircle className="size-4 shrink-0 text-red-500" /> : null}
      <span>{children}</span>
    </motion.div>
  );
}

export function ClientLoginForm({ onSwitchToRegister, onSwitchToForgot }) {
  const router = useRouter();

  const countries = useMemo(
    () => [
      { code: "KH", name: "Cambodia", dialCode: "+855" },
      { code: "TH", name: "Thailand", dialCode: "+66" },
      { code: "VN", name: "Vietnam", dialCode: "+84" },
      { code: "SG", name: "Singapore", dialCode: "+65" },
      { code: "MY", name: "Malaysia", dialCode: "+60" },
      { code: "CN", name: "China", dialCode: "+86" },
    ],
    [],
  );

  const defaultCountry = countries.find((c) => c.code === "KH") || countries[0];

  const [countryDialCode, setCountryDialCode] = useState(defaultCountry.dialCode);
  const [nationalNumber, setNationalNumber] = useState("");
  const [password, setPassword] = useState("");
  const [hidePassword, setHidePassword] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const phoneNumber = useMemo(() => {
    const digits = nationalNumber.replace(/\D/g, "");
    if (!digits) return "";
    return `${countryDialCode}${digits}`;
  }, [countryDialCode, nationalNumber]);

  function tryDetectCountryFromInput(rawValue) {
    const value = rawValue || "";
    if (!value.trim()) return;

    const normalized = value.replace(/\s+/g, "");
    if (!normalized.startsWith("+")) return;

    const matching = countries
      .map((c) => ({ ...c, len: c.dialCode.length }))
      .filter((c) => normalized.startsWith(c.dialCode))
      .sort((a, b) => b.len - a.len)[0];

    if (!matching) return;

    const restDigits = normalized.slice(matching.dialCode.length).replace(/\D/g, "");
    setCountryDialCode(matching.dialCode);
    setNationalNumber(restDigits);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!phoneNumber.trim()) {
      setError("Enter a valid phone number.");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // Admin first-boot check & account preparation
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, password }),
      });
      const loginPayload = await loginRes.json();

      if (!loginRes.ok) {
        setError(
          loginPayload?.error?.message ||
            loginPayload?.error ||
            "Invalid phone number or password.",
        );
        setLoading(false);
        return;
      }

      const targetPhone = loginPayload?.phoneNumberForAuth || phoneNumber;
      const targetEmail = loginPayload?.emailForAuth || phoneAuthEmail(targetPhone);

      const { data, error: authError } = await authClient.signIn.email({
        email: targetEmail,
        password,
      });

      if (authError) {
        setError(authError.message || "Invalid phone number or password.");
        setLoading(false);
        return;
      }

      router.push(getRoleRedirect(data?.user?.role || "CLIENT"));
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Header Section */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
          Welcome back
        </h2>
        <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
          Sign in to access your wholesale & retail store.
        </p>
      </div>

      {/* Phone Input Field */}
      <div>
        <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          <Phone className="size-3.5" />
          <span>Phone Number</span>
        </label>
        <div className="group relative flex items-center overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-quiet)]/80 transition-all focus-within:border-[var(--action)] focus-within:bg-[var(--surface-strong)] focus-within:ring-2 focus-within:ring-[var(--action)]/20">
          <select
            value={countryDialCode}
            onChange={(e) => setCountryDialCode(e.target.value)}
            className="h-12 border-r border-[var(--border-soft)] bg-transparent px-3 text-sm font-semibold text-[var(--foreground)] outline-none cursor-pointer"
            aria-label="Select country prefix"
          >
            {countries.map((c) => (
              <option key={c.code} value={c.dialCode} className="bg-[var(--surface-strong)]">
                {c.code} ({c.dialCode})
              </option>
            ))}
          </select>

          <input
            type="tel"
            value={nationalNumber}
            onChange={(event) => {
              const raw = event.target.value;
              if (raw.trim().startsWith("+")) {
                tryDetectCountryFromInput(raw);
                return;
              }
              setNationalNumber(raw.replace(/\D/g, ""));
            }}
            placeholder="12345678"
            inputMode="tel"
            className="h-12 w-full bg-transparent px-3.5 text-sm font-medium text-[var(--foreground)] placeholder-[var(--muted-foreground)]/60 outline-none"
            aria-label="Phone number"
          />
        </div>
      </div>

      {/* Password Input Field */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            <Lock className="size-3.5" />
            <span>Password</span>
          </label>
          <button
            type="button"
            onClick={onSwitchToForgot}
            className="text-xs font-semibold text-[var(--action)] hover:underline"
          >
            Forgot Password?
          </button>
        </div>

        <div className="group relative flex items-center overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-quiet)]/80 transition-all focus-within:border-[var(--action)] focus-within:bg-[var(--surface-strong)] focus-within:ring-2 focus-within:ring-[var(--action)]/20">
          <input
            type={hidePassword ? "password" : "text"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            className="h-12 w-full bg-transparent px-3.5 pr-11 text-sm font-medium text-[var(--foreground)] placeholder-[var(--muted-foreground)]/60 outline-none"
          />
          <button
            type="button"
            onClick={() => setHidePassword((current) => !current)}
            className="absolute right-3 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            aria-label="Toggle password visibility"
          >
            {hidePassword ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}

      {/* Primary Submit CTA */}
      <Button
        type="submit"
        className="relative h-12 w-full rounded-2xl bg-[var(--action)] text-sm font-bold text-[var(--action-foreground)] shadow-lg transition-all hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-70"
        disabled={loading}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            <span>Signing in...</span>
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <span>Sign In</span>
            <ArrowRight className="size-4" />
          </span>
        )}
      </Button>

      {/* Switch to Register */}
      <div className="pt-2 text-center text-sm text-[var(--muted-foreground)]">
        Don&apos;t have an account?{" "}
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="font-bold text-[var(--foreground)] hover:underline"
        >
          Create an account
        </button>
      </div>
    </form>
  );
}
