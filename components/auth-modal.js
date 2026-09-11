"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Store, LogIn } from "lucide-react";

import { ClientLoginForm } from "@/components/auth/client-login-form";
import { RegisterForm } from "@/components/auth/register-form";
import { ForgotPasswordFlow } from "@/components/auth/forgot-password-flow";
import { easeInOutCubic } from "@/components/motion/motion-utils";

/**
 * A full-screen modal overlay that presents the Login / Register / Forgot-Password flow.
 *
 * Props:
 *   isOpen       {boolean}  — controls visibility
 *   onClose      {function} — called when the user dismisses the modal (backdrop click or X)
 *   hint         {string}   — optional message shown at the top (e.g. "Sign in to add to cart")
 *   initialView  {"login"|"register"|"forgot"} — which panel to show first
 */
export function AuthModal({ isOpen, onClose, hint = "", initialView = "login" }) {
  const [view, setView] = useState(initialView);

  function handleSwitch(nextView) {
    setView(nextView === "register" ? "register" : nextView === "forgot" ? "forgot" : "login");
  }

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          key="auth-modal-backdrop"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: easeInOutCubic }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal Panel */}
          <motion.div
            key="auth-modal-panel"
            className="relative z-10 w-full sm:max-w-sm max-h-[92dvh] overflow-y-auto rounded-t-[2rem] sm:rounded-[2rem] bg-[var(--surface-strong)] shadow-2xl border border-[var(--border-soft)]"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ duration: 0.38, ease: easeInOutCubic }}
          >
            {/* Handle bar (mobile) */}
            <div className="sm:hidden mx-auto mt-3 mb-1 h-1 w-10 rounded-full bg-[var(--border-soft)]" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-xl bg-[var(--action)] text-[var(--action-foreground)]">
                  <Store className="size-4" />
                </div>
                <span className="text-sm font-bold tracking-tight text-[var(--foreground)]">Soeum Savet Store</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="app-icon-button p-2"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Hint message */}
            {hint ? (
              <div className="mx-5 mb-3 flex items-center gap-2 rounded-2xl bg-[color-mix(in_srgb,var(--action)_12%,var(--surface))] border border-[color-mix(in_srgb,var(--action)_25%,transparent)] px-4 py-3 text-sm font-medium text-[var(--foreground)]">
                <LogIn className="size-4 shrink-0 text-[var(--action)]" />
                <span>{hint}</span>
              </div>
            ) : null}

            {/* Tab switcher (login / register) */}
            {view !== "forgot" ? (
              <div className="mx-5 mb-1 flex gap-1 rounded-2xl bg-[var(--surface-quiet)] p-1">
                <button
                  type="button"
                  onClick={() => setView("login")}
                  className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                    view === "login"
                      ? "bg-[var(--surface-strong)] text-[var(--foreground)] shadow-sm"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setView("register")}
                  className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                    view === "register"
                      ? "bg-[var(--surface-strong)] text-[var(--foreground)] shadow-sm"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  Register
                </button>
              </div>
            ) : null}

            {/* Form content */}
            <div className="px-5 pb-6 pt-2">
              <AnimatePresence mode="wait">
                {view === "login" && (
                  <motion.div
                    key="modal-login"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ClientLoginForm
                      onSwitchToRegister={() => handleSwitch("register")}
                      onSwitchToForgot={() => handleSwitch("forgot")}
                    />
                  </motion.div>
                )}
                {view === "register" && (
                  <motion.div
                    key="modal-register"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.2 }}
                  >
                    <RegisterForm onSwitchToLogin={() => handleSwitch("login")} />
                  </motion.div>
                )}
                {view === "forgot" && (
                  <motion.div
                    key="modal-forgot"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ForgotPasswordFlow onSwitchToLogin={() => handleSwitch("login")} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
