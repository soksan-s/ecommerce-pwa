"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, Phone, Lock, ArrowRight, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { phoneAuthEmail } from "@/lib/phone";
import { AuthAlert, normalizeAuthError } from "@/components/auth/auth-alert";

function getRoleRedirect(role) {
  if (role === "ADMIN" || role === "SUPER_ADMIN") return "/admin";
  if (role === "CASHIER" || role === "MANAGER") return "/pos";
  return "/client";
}

export function ClientLoginForm({ onSwitchToRegister, onSwitchToForgot }) {
  const router = useRouter();

  const countries = useMemo(
    () => [
      { code: "KH", name: "Cambodia", flag: "🇰🇭", dialCode: "+855" },
      { code: "TH", name: "Thailand", flag: "🇹🇭", dialCode: "+66" },
      { code: "VN", name: "Vietnam", flag: "🇻🇳", dialCode: "+84" },
      { code: "SG", name: "Singapore", flag: "🇸🇬", dialCode: "+65" },
      { code: "MY", name: "Malaysia", flag: "🇲🇾", dialCode: "+60" },
      { code: "CN", name: "China", flag: "🇨🇳", dialCode: "+86" },
    ],
    [],
  );

  const defaultCountry = countries.find((c) => c.code === "KH") || countries[0];

  const [countryDialCode, setCountryDialCode] = useState(defaultCountry.dialCode);
  const [nationalNumber, setNationalNumber] = useState("");
  const [password, setPassword] = useState("");
  const [hidePassword, setHidePassword] = useState(true);
  const [errorObj, setErrorObj] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

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

  function clearErrors() {
    setErrorObj(null);
    setFieldErrors({});
  }

  async function handleSubmit(event) {
    event.preventDefault();
    clearErrors();

    const newFieldErrors = {};
    const digits = nationalNumber.replace(/\D/g, "");
    if (!digits || digits.length < 8) {
      newFieldErrors.phone = true;
    }
    if (!password || password.length < 4) {
      newFieldErrors.password = true;
    }

    if (Object.keys(newFieldErrors).length > 0) {
      setFieldErrors(newFieldErrors);
      setErrorObj(
        normalizeAuthError({
          message: newFieldErrors.phone
            ? "Please enter a valid phone number."
            : "Password must be at least 4 characters.",
        }),
      );
      return;
    }

    // Check offline status
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setErrorObj(
        normalizeAuthError({
          message: "You appear to be offline. Please check your internet connection.",
        }),
      );
      return;
    }

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
        setFieldErrors({ phone: true, password: true });
        setErrorObj(
          normalizeAuthError({
            message:
              loginPayload?.error?.message ||
              loginPayload?.error ||
              "Invalid phone number or password.",
          }),
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
        setFieldErrors({ phone: true, password: true });
        setErrorObj(normalizeAuthError(authError));
        setLoading(false);
        return;
      }

      router.push(getRoleRedirect(data?.user?.role || "CLIENT"));
    } catch (err) {
      setErrorObj(normalizeAuthError(err));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Header Section */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
          Welcome back
        </h2>
        <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
          Sign in to access your wholesale & retail store.
        </p>
      </div>

      {/* Enhanced Auth Alert Banner */}
      {errorObj && (
        <AuthAlert
          error={errorObj}
          onDismiss={() => setErrorObj(null)}
          onAction={(action) => {
            if (action === "forgot") onSwitchToForgot?.();
          }}
        />
      )}

      {/* Phone Input Field */}
      <div>
        <label className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1.5">
            <Phone className="size-3.5" />
            <span>Phone Number</span>
          </span>
          {fieldErrors.phone && (
            <span className="text-[11px] font-bold text-rose-500 lowercase">
              invalid phone number
            </span>
          )}
        </label>
        <div
          className={`group relative flex items-center overflow-hidden rounded-2xl border bg-[var(--surface-quiet)]/80 transition-all focus-within:bg-[var(--surface-strong)] focus-within:ring-2 ${
            fieldErrors.phone
              ? "border-rose-500/80 focus-within:border-rose-500 focus-within:ring-rose-500/20"
              : "border-[var(--border-soft)] focus-within:border-[var(--action)] focus-within:ring-[var(--action)]/20"
          }`}
        >
          <select
            value={countryDialCode}
            onChange={(e) => {
              setCountryDialCode(e.target.value);
              clearErrors();
            }}
            className="h-12 border-r border-[var(--border-soft)] bg-transparent px-3 text-sm font-semibold text-[var(--foreground)] outline-none cursor-pointer"
            aria-label="Select country prefix"
          >
            {countries.map((c) => (
              <option key={c.code} value={c.dialCode} className="bg-[var(--surface-strong)]">
                {c.flag} {c.dialCode}
              </option>
            ))}
          </select>

          <input
            type="tel"
            value={nationalNumber}
            onChange={(event) => {
              clearErrors();
              const raw = event.target.value;
              if (raw.trim().startsWith("+")) {
                tryDetectCountryFromInput(raw);
                return;
              }
              setNationalNumber(raw.replace(/\D/g, ""));
            }}
            placeholder="12345678"
            inputMode="tel"
            className="h-12 w-full bg-transparent px-3.5 pr-9 text-sm font-medium text-[var(--foreground)] placeholder-[var(--muted-foreground)]/60 outline-none"
            aria-label="Phone number"
          />

          {nationalNumber && (
            <button
              type="button"
              onClick={() => {
                setNationalNumber("");
                clearErrors();
              }}
              className="absolute right-3 p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              aria-label="Clear phone number"
            >
              <X className="size-3.5" />
            </button>
          )}
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

        <div
          className={`group relative flex items-center overflow-hidden rounded-2xl border bg-[var(--surface-quiet)]/80 transition-all focus-within:bg-[var(--surface-strong)] focus-within:ring-2 ${
            fieldErrors.password
              ? "border-rose-500/80 focus-within:border-rose-500 focus-within:ring-rose-500/20"
              : "border-[var(--border-soft)] focus-within:border-[var(--action)] focus-within:ring-[var(--action)]/20"
          }`}
        >
          <input
            type={hidePassword ? "password" : "text"}
            value={password}
            onChange={(event) => {
              clearErrors();
              setPassword(event.target.value);
            }}
            placeholder="••••••••"
            className="h-12 w-full bg-transparent px-3.5 pr-11 text-sm font-medium text-[var(--foreground)] placeholder-[var(--muted-foreground)]/60 outline-none"
            aria-label="Password"
          />
          <button
            type="button"
            onClick={() => setHidePassword((current) => !current)}
            className="absolute right-3 p-1 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)]"
            aria-label="Toggle password visibility"
          >
            {hidePassword ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </button>
        </div>
      </div>

      {/* Primary Submit CTA */}
      <Button
        type="submit"
        className="relative h-12 w-full rounded-2xl bg-[var(--action)] text-sm font-bold text-[var(--action-foreground)] shadow-lg transition-all hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-70 cursor-pointer"
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
          className="font-bold text-[var(--foreground)] hover:underline cursor-pointer"
        >
          Create an account
        </button>
      </div>
    </form>
  );
}
