"use client";

import { useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Phone, User, Lock, ArrowRight, ArrowLeft, CheckCircle2, ShieldCheck, Loader2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { phoneAuthEmail } from "@/lib/phone";
import { RegistrationAlreadyExistsModal } from "@/components/auth/registration-already-exists-modal";

function AuthNotice({ children, tone = "neutral" }) {
  const toneClasses =
    tone === "error"
      ? "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
      : "border-[var(--border-soft)] bg-[var(--surface-quiet)] text-[var(--foreground)]";

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={"mb-4 flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-medium " + toneClasses}
    >
      {tone === "error" ? <AlertCircle className="size-4 shrink-0 text-red-500" /> : null}
      <span>{children}</span>
    </motion.div>
  );
}

function StepIndicator({ currentStep }) {
  const steps = [
    { num: 1, label: "Phone" },
    { num: 2, label: "Verify" },
    { num: 3, label: "Password" },
  ];

  return (
    <div className="mb-6 flex items-center justify-between gap-2">
      {steps.map((s, idx) => {
        const isCompleted = currentStep > s.num;
        const isActive = currentStep === s.num;

        return (
          <div key={s.num} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-8 w-full items-center justify-center rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? "bg-[var(--action)] text-[var(--action-foreground)] shadow-md"
                  : isCompleted
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-[var(--surface-quiet)] text-[var(--muted-foreground)]"
              }`}
            >
              {isCompleted ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" />
                  <span>{s.label}</span>
                </span>
              ) : (
                <span>
                  {s.num}. {s.label}
                </span>
              )}
            </div>
            {idx < steps.length - 1 ? (
              <div className="h-0.5 w-3 rounded-full bg-[var(--border-soft)]" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function RegisterForm({ onSwitchToLogin }) {
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

  const [step, setStep] = useState(1); // 1: send, 2: verify, 3: set password
  const [username, setUsername] = useState("");
  const [countryDialCode, setCountryDialCode] = useState(defaultCountry.dialCode);
  const [nationalNumber, setNationalNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hidePassword, setHidePassword] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const phoneNumber = useMemo(() => {
    const digits = nationalNumber.replace(/\D/g, "");
    if (!digits) return "";
    return `${countryDialCode}${digits}`;
  }, [countryDialCode, nationalNumber]);

  const confirmationResultRef = useRef(null);
  const firebaseIdTokenRef = useRef(null);
  const recaptchaVerifierRef = useRef(null);
  const recaptchaContainerRef = useRef(null);

  const [accountExistsModalOpen, setAccountExistsModalOpen] = useState(false);
  const [accountExistsPhone, setAccountExistsPhone] = useState("");

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
      setError("Please enter a valid phone number.");
      return;
    }

    setError("");
    setAccountExistsModalOpen(false);
    setAccountExistsPhone(trimmed);
    setLoading(true);

    try {
      const checkRes = await fetch(
        `/api/auth/check-phone-exists?phoneNumber=${encodeURIComponent(trimmed)}`,
        { method: "GET", cache: "no-store" },
      );
      const checkPayload = await checkRes.json();

      if (checkRes.ok && checkPayload?.exists) {
        setAccountExistsModalOpen(true);
        return;
      }

      const { RecaptchaVerifier, signInWithPhoneNumber } = await import("firebase/auth");
      const { firebaseAuth } = await import("@/lib/firebase");

      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }

      const verifier = new RecaptchaVerifier(firebaseAuth, "recaptcha-register", {
        size: "invisible",
        callback: () => {},
      });
      recaptchaVerifierRef.current = verifier;

      const result = await signInWithPhoneNumber(firebaseAuth, trimmed, verifier);
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
      setError("Please enter the 6-digit code sent to your phone.");
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
      if (err?.code === "auth/invalid-verification-code") {
        setError("Incorrect code. Please try again.");
      } else if (err?.code === "auth/code-expired") {
        setError("Code expired. Please go back and resend.");
      } else {
        setError(err?.message || "Failed to verify code.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteRegister(event) {
    event.preventDefault();

    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!firebaseIdTokenRef.current) {
      setError("Phone verification expired. Please start over.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          phoneNumber,
          password,
          firebaseIdToken: firebaseIdTokenRef.current,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error || "Registration failed.");

      const { error: authError } = await authClient.signIn.email({
        email: phoneAuthEmail(phoneNumber),
        password,
      });

      if (authError) throw new Error(authError.message);

      window.location.href = "/client";
    } catch (err) {
      setError(err?.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <RegistrationAlreadyExistsModal
        open={accountExistsModalOpen}
        phoneNumber={accountExistsPhone}
        onClose={() => setAccountExistsModalOpen(false)}
        onSignIn={() => {
          setAccountExistsModalOpen(false);
          onSwitchToLogin?.();
        }}
      />

      <StepIndicator currentStep={step} />

      {step === 1 ? (
        <form onSubmit={handleSendOTP} className="space-y-4">
          <div id="recaptcha-register" ref={recaptchaContainerRef} />

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
              Create account
            </h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Enter your name & phone number to get started.
            </p>
          </div>

          <div>
            <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              <User className="size-3.5" />
              <span>Full Name (Optional)</span>
            </label>
            <div className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-quiet)]/80 focus-within:border-[var(--action)] focus-within:ring-2 focus-within:ring-[var(--action)]/20">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. Sok Chea"
                className="h-12 w-full bg-transparent px-3.5 text-sm font-medium text-[var(--foreground)] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              <Phone className="size-3.5" />
              <span>Phone Number</span>
            </label>
            <div className="group relative flex items-center overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-quiet)]/80 focus-within:border-[var(--action)] focus-within:ring-2 focus-within:ring-[var(--action)]/20">
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
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw.trim().startsWith("+")) {
                    tryDetectCountryFromInput(raw);
                    return;
                  }
                  setNationalNumber(raw.replace(/\D/g, ""));
                }}
                placeholder="11831023"
                className="h-12 w-full bg-transparent px-3.5 text-sm font-medium text-[var(--foreground)] outline-none"
                aria-label="Phone number"
              />
            </div>
          </div>

          {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}

          <Button
            type="submit"
            className="relative h-12 w-full rounded-2xl bg-[var(--action)] text-sm font-bold text-[var(--action-foreground)] shadow-lg transition-all hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-70"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                <span>Sending SMS Code...</span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span>Send Verification Code</span>
                <ArrowRight className="size-4" />
              </span>
            )}
          </Button>

          <div className="pt-2 text-center text-sm text-[var(--muted-foreground)]">
            Already have an account?{" "}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="font-bold text-[var(--foreground)] hover:underline"
            >
              Sign In
            </button>
          </div>
        </form>
      ) : null}

      {step === 2 ? (
        <form onSubmit={handleVerifyOTP} className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
              Verify Phone
            </h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Enter the 6-digit SMS code sent to <strong className="text-[var(--foreground)]">{phoneNumber}</strong>.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              6-Digit SMS Code
            </label>
            <div className="overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-quiet)]/80 focus-within:border-[var(--action)] focus-within:ring-2 focus-within:ring-[var(--action)]/20">
              <input
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="h-14 w-full bg-transparent text-center font-mono text-2xl font-extrabold tracking-[0.35em] text-[var(--foreground)] outline-none"
                autoComplete="one-time-code"
              />
            </div>
          </div>

          {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}

          <Button
            type="submit"
            className="relative h-12 w-full rounded-2xl bg-[var(--action)] text-sm font-bold text-[var(--action-foreground)] shadow-lg transition-all hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-70"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                <span>Verifying...</span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span>Verify Code</span>
                <ShieldCheck className="size-4" />
              </span>
            )}
          </Button>

          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center gap-1 font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <ArrowLeft className="size-3.5" />
              <span>Change phone number</span>
            </button>
          </div>
        </form>
      ) : null}

      {step === 3 ? (
        <form onSubmit={handleCompleteRegister} className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-[var(--foreground)] sm:text-3xl">
              Set Password
            </h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Create a secure password to protect your account.
            </p>
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
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 w-full bg-transparent px-3.5 pr-11 text-sm font-medium text-[var(--foreground)] outline-none"
              />
              <button
                type="button"
                onClick={() => setHidePassword((current) => !current)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                {hidePassword ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              <Lock className="size-3.5" />
              <span>Confirm Password</span>
            </label>
            <div className="relative overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-quiet)]/80 focus-within:border-[var(--action)] focus-within:ring-2 focus-within:ring-[var(--action)]/20">
              <input
                type={hidePassword ? "password" : "text"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 w-full bg-transparent px-3.5 pr-11 text-sm font-medium text-[var(--foreground)] outline-none"
              />
            </div>
          </div>

          {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}

          <Button
            type="submit"
            className="relative h-12 w-full rounded-2xl bg-[var(--action)] text-sm font-bold text-[var(--action-foreground)] shadow-lg transition-all hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-70"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                <span>Creating Account...</span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span>Complete Registration</span>
                <CheckCircle2 className="size-4" />
              </span>
            )}
          </Button>
        </form>
      ) : null}
    </>
  );
}
