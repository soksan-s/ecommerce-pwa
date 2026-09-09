"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Globe,
  KeyRound,
  WifiOff,
  X,
  Check,
} from "lucide-react";
import { useState } from "react";

export function normalizeAuthError(err) {
  if (!err) return null;

  const rawMessage = typeof err === "string" ? err : err.message || "";
  const code = err?.code || "";

  // 1. Firebase Domain Not Authorized (Mobile / LAN / custom domain)
  if (
    code === "auth/captcha-check-failed" ||
    rawMessage.includes("captcha-check-failed") ||
    rawMessage.includes("Hostname match not found")
  ) {
    const currentHost = typeof window !== "undefined" ? window.location.hostname : "";
    return {
      type: "domain",
      title: "Firebase Domain Not Authorized",
      description: `Your current hostname "${currentHost}" is not listed in Firebase Authorized Domains.`,
      host: currentHost,
      actionType: "copy-host",
    };
  }

  // 2. Network / Offline Error
  if (
    (typeof navigator !== "undefined" && !navigator.onLine) ||
    rawMessage.includes("Failed to fetch") ||
    rawMessage.includes("NetworkError") ||
    rawMessage.includes("network-request-failed") ||
    code === "auth/network-request-failed"
  ) {
    return {
      type: "network",
      title: "Network Connection Issue",
      description: "Unable to reach the server. Please check your Wi-Fi or mobile data.",
    };
  }

  // 3. Invalid credentials
  if (
    rawMessage.toLowerCase().includes("invalid phone number or password") ||
    rawMessage.toLowerCase().includes("invalid login credentials") ||
    rawMessage.toLowerCase().includes("invalid password") ||
    code === "auth/wrong-password" ||
    code === "auth/user-not-found"
  ) {
    return {
      type: "credentials",
      title: "Incorrect Credentials",
      description: "The phone number or password you entered is incorrect.",
      actionType: "forgot-password",
    };
  }

  // 4. Rate Limiting / Too Many Requests
  if (
    code === "auth/too-many-requests" ||
    rawMessage.toLowerCase().includes("too many requests") ||
    rawMessage.toLowerCase().includes("too many attempts")
  ) {
    return {
      type: "rate-limit",
      title: "Too Many Attempts",
      description: "Access temporarily blocked due to repeated failed attempts. Please wait a moment and try again.",
    };
  }

  // 5. SMS Quota Exceeded
  if (
    code === "auth/quota-exceeded" ||
    rawMessage.toLowerCase().includes("quota exceeded")
  ) {
    return {
      type: "warning",
      title: "SMS Limit Reached",
      description: "Daily SMS verification limit reached for this project. Please contact support or try again later.",
    };
  }

  // 6. Invalid / Expired OTP
  if (code === "auth/invalid-verification-code") {
    return {
      type: "error",
      title: "Invalid Verification Code",
      description: "The 6-digit OTP you entered is incorrect. Please double-check and try again.",
    };
  }

  if (code === "auth/code-expired") {
    return {
      type: "warning",
      title: "Code Expired",
      description: "The verification code has expired. Please go back and request a new SMS.",
    };
  }

  // 7. Invalid phone number format
  if (
    code === "auth/invalid-phone-number" ||
    rawMessage.toLowerCase().includes("invalid phone number")
  ) {
    return {
      type: "error",
      title: "Invalid Phone Number",
      description: "Please enter a valid phone number with the correct country code.",
    };
  }

  // Default fallback
  return {
    type: "error",
    title: "Authentication Error",
    description: rawMessage || "An unexpected error occurred. Please try again.",
  };
}

export function AuthAlert({ error, onDismiss, onAction, className = "" }) {
  const [copied, setCopied] = useState(false);

  if (!error) return null;

  const normalized = typeof error === "string" ? normalizeAuthError({ message: error }) : error;

  if (!normalized) return null;

  const { type, title, description, host, actionType } = normalized;

  async function handleCopyHost() {
    if (!host) return;
    try {
      await navigator.clipboard.writeText(host);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  const iconMap = {
    domain: <Globe className="size-5 text-amber-500 shrink-0" />,
    network: <WifiOff className="size-5 text-rose-500 shrink-0" />,
    credentials: <KeyRound className="size-5 text-rose-500 shrink-0" />,
    "rate-limit": <AlertTriangle className="size-5 text-amber-500 shrink-0" />,
    warning: <AlertTriangle className="size-5 text-amber-500 shrink-0" />,
    error: <AlertCircle className="size-5 text-rose-500 shrink-0" />,
    success: <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />,
  };

  const styleMap = {
    domain: "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-200",
    network: "border-rose-500/30 bg-rose-500/10 text-rose-950 dark:text-rose-200",
    credentials: "border-rose-500/30 bg-rose-500/10 text-rose-950 dark:text-rose-200",
    "rate-limit": "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-200",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-200",
    error: "border-rose-500/30 bg-rose-500/10 text-rose-950 dark:text-rose-200",
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200",
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6, scale: 0.98 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
          x: [0, -3, 3, -2, 2, 0],
        }}
        exit={{ opacity: 0, y: -6, scale: 0.98 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className={`relative overflow-hidden rounded-2xl border p-4 shadow-sm backdrop-blur-md ${styleMap[type] || styleMap.error} ${className}`}
        role="alert"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{iconMap[type] || iconMap.error}</div>

          <div className="min-w-0 flex-1 space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider">{title}</h4>
            <p className="text-xs leading-relaxed opacity-90">{description}</p>

            {/* Quick Actions */}
            {type === "domain" && host && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2 pt-1">
                <span className="rounded-lg bg-black/10 dark:bg-white/10 px-2 py-1 font-mono text-[11px] font-bold">
                  {host}
                </span>
                <button
                  type="button"
                  onClick={handleCopyHost}
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 transition-colors"
                >
                  {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                  <span>{copied ? "Copied!" : "Copy Domain"}</span>
                </button>
                <span className="text-[10px] opacity-75">
                  (Add to Firebase &gt; Authentication &gt; Settings &gt; Authorized domains)
                </span>
              </div>
            )}

            {actionType === "forgot-password" && onAction && (
              <div className="mt-2 pt-1">
                <button
                  type="button"
                  onClick={() => onAction("forgot")}
                  className="text-xs font-bold text-[var(--action)] underline hover:opacity-80"
                >
                  Need to reset your password?
                </button>
              </div>
            )}
          </div>

          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg p-1 opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Dismiss error"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
