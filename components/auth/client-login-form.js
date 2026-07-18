"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

function getRoleRedirect(role) {
  if (role === "ADMIN" || role === "SUPER_ADMIN") return "/admin";
  if (role === "CASHIER" || role === "MANAGER") return "/pos";
  return "/client";
}

function AuthNotice({ children, tone = "neutral" }) {
  const toneClasses =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-[var(--border-soft)] bg-[var(--surface-quiet)] text-[var(--foreground)]";

  return (
    <div className={"rounded-2xl border px-4 py-3 text-sm " + toneClasses}>
      {children}
    </div>
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

    // Find the longest matching dial code
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
      setError("Enter a valid phone number");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // Admin first-boot intercept (creates admin if missing)
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, password }),
      });

      const { data, error: authError } = await authClient.signIn.phoneNumber({
        phoneNumber,
        password,
      });

      if (authError) {
        setError(authError.message || "Invalid phone number or password.");
        setLoading(false);
        return;
      }

      router.push(getRoleRedirect(data?.user?.role || "CLIENT"));
    } catch {
      setError("An unexpected error occurred.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-3xl font-semibold text-[var(--foreground)]">Welcome back</h2>
        <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">Sign in with your phone number.</p>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Phone Number</label>
        <div className="flex items-stretch gap-2">
          <select
            value={countryDialCode}
            onChange={(e) => {
              setCountryDialCode(e.target.value);
            }}
            className="app-input px-3 py-3"
            aria-label="Select country"
          >
            {countries.map((c) => (
              <option key={c.code} value={c.dialCode}>
                {c.name} ({c.dialCode})
              </option>
            ))}
          </select>

          <input
            type="tel"
            value={nationalNumber}
            onChange={(event) => {
              const raw = event.target.value;
              // Auto-detect if user typed full +XX...
              if (raw.trim().startsWith("+")) {
                tryDetectCountryFromInput(raw);
                return;
              }
              setNationalNumber(raw.replace(/\D/g, ""));
            }}
            placeholder="12345678"
            inputMode="tel"
            className="app-input px-4 py-3"
            aria-label="Phone number"
          />
        </div>
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">Enter your phone number (country prefix is selected automatically).</p>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Password</label>
        <div className="relative">
          <input
            type={hidePassword ? "password" : "text"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="app-input px-4 py-3 pr-12"
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

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSwitchToForgot}
          className="text-sm font-medium text-[var(--foreground)] hover:underline"
        >
          Forgot Password?
        </button>
      </div>

      {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Please wait..." : "Login"}
      </Button>

      <button
        type="button"
        onClick={onSwitchToRegister}
        className="text-sm font-medium text-[var(--foreground)]"
      >
        Create account
      </button>
    </form>
  );
}

