"use client";

import { useMemo, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";

// (self-import removed)


function AuthNotice({ children, tone = "neutral" }) {
  const toneClasses =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-[var(--border-soft)] bg-[var(--surface-quiet)] text-[var(--foreground)]";

  return <div className={"rounded-2xl border px-4 py-3 text-sm " + toneClasses}>{children}</div>;
}

function formatPhoneToE164FromDialCode(dialCode, nationalNumber) {
  const digits = String(nationalNumber || "").replace(/\D/g, "");
  if (!digits) return "";
  return `${dialCode}${digits}`;
}

export function ForgotPasswordFlow({ onSwitchToLogin }) {
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

  const [step, setStep] = useState(1); // 1 send, 2 verify, 3 set new password
  const [countryDialCode, setCountryDialCode] = useState(defaultCountry.dialCode);
  const [nationalNumber, setNationalNumber] = useState("");

  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hidePassword, setHidePassword] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const phoneNumber = useMemo(
    () => formatPhoneToE164FromDialCode(countryDialCode, nationalNumber),
    [countryDialCode, nationalNumber],
  );

  const confirmationResultRef = useRef(null);
  const firebaseIdTokenRef = useRef(null);

  const recaptchaContainerId = "recaptcha-forgot";

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

  async function handleSendOTP(event) {
    event.preventDefault();

    const trimmed = phoneNumber.trim();
    if (!trimmed) {
      setError("Please enter a valid phone number");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const { RecaptchaVerifier, signInWithPhoneNumber } = await import("firebase/auth");
      const { firebaseAuth } = await import("@/lib/firebase");

      const verifier = new RecaptchaVerifier(firebaseAuth, recaptchaContainerId, {
        size: "invisible",
        callback: () => {},
      });

      const formattedPhone = trimmed;
      const result = await signInWithPhoneNumber(firebaseAuth, formattedPhone, verifier);
      confirmationResultRef.current = result;
      setStep(2);
    } catch (err) {
      setError(err?.message || "Failed to send SMS. Check your phone number.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP(event) {
    event.preventDefault();

    if (otp.length !== 6) {
      setError("Please enter the 6-digit code");
      return;
    }

    if (!confirmationResultRef.current) {
      setError("Session expired. Please go back and try again.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const userCredential = await confirmationResultRef.current.confirm(otp);
      const { getFirebaseIdToken } = await import("@/lib/firebase");
      const idToken = await getFirebaseIdToken(userCredential);
      firebaseIdTokenRef.current = idToken;
      setStep(3);
    } catch (err) {
      if (err?.code === "auth/invalid-verification-code") setError("Incorrect code. Please try again.");
      else setError(err?.message || "Failed to verify code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteReset(event) {
    event.preventDefault();

    if (password.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!firebaseIdTokenRef.current) {
      setError("Verification expired. Please start over.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/otp/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          newPassword: password,
          firebaseIdToken: firebaseIdTokenRef.current,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error || "Failed to reset password");

      onSwitchToLogin();
    } catch (err) {
      setError(err?.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  }

  if (step === 1) {
    return (
      <form onSubmit={handleSendOTP} className="space-y-4">
        <div id={recaptchaContainerId} />

        <div>
          <h2 className="text-3xl font-semibold text-[var(--foreground)]">Reset Password</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">Enter your phone number to receive a reset code via SMS.</p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Phone Number</label>
          <div className="flex items-stretch gap-2">
            <select
              value={countryDialCode}
              onChange={(e) => setCountryDialCode(e.target.value)}
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
              onChange={(e) => {
                const raw = e.target.value;
                if (raw.trim().startsWith("+")) {
                  tryDetectCountryFromInput(raw);
                  return;
                }
                setNationalNumber(raw.replace(/\D/g, ""));
              }}
              placeholder="11831023"
              className="app-input px-4 py-3"
              aria-label="Phone number"
            />
          </div>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Country prefix is selected automatically.</p>
        </div>

        {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Sending SMS..." : "Send Reset Code"}
        </Button>

        <button type="button" onClick={onSwitchToLogin} className="text-sm font-medium text-[var(--foreground)]">
          Back to login
        </button>
      </form>
    );
  }

  if (step === 2) {
    return (
      <form onSubmit={handleVerifyOTP} className="space-y-4">
        <div>
          <h2 className="text-3xl font-semibold text-[var(--foreground)]">Verify Code</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">Enter the 6-digit code sent to {phoneNumber}.</p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Verification Code</label>
          <input
            type="text"
            inputMode="numeric"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            className="app-input px-4 py-3 text-center tracking-widest text-lg"
            autoComplete="one-time-code"
          />
        </div>

        {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Verifying..." : "Verify Code"}
        </Button>

        <button type="button" onClick={() => setStep(1)} className="text-sm font-medium text-[var(--foreground)]">
          3 Resend code
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleCompleteReset} className="space-y-4">
      <div>
        <h2 className="text-3xl font-semibold text-[var(--foreground)]">Set New Password</h2>
        <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">Enter your new password.</p>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">New Password</label>
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
          >
            {hidePassword ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </button>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">Confirm Password</label>
        <div className="relative">
          <input
            type={hidePassword ? "password" : "text"}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="app-input px-4 py-3 pr-12"
          />
        </div>
      </div>

      {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Resetting..." : "Reset Password"}
      </Button>
    </form>
  );
}

