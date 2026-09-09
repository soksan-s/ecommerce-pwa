"use client";

import { useEffect, useState } from "react";

import { useOffline } from "@/hooks/useOffline";

export function PWAProvider() {
  const { isOnline } = useOffline();
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        registration.update().catch(() => {});
      })
      .catch(() => {
        // Service worker registration should not block the app UI.
      });
  }, []);

  useEffect(() => {
    function handleOnline() {
      setMessage("Back online. Syncing queued POS work.");
    }

    function handleOffline() {
      setMessage("You are offline. POS transactions will be saved locally.");
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!message) {
      return undefined;
    }

    const timer = window.setTimeout(() => setMessage(""), 4200);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!message) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-[80] w-[calc(100%-2rem)] max-w-[28rem] -translate-x-1/2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] shadow-[var(--shadow-strong)]">
      <div className="flex items-center justify-between gap-3">
        <span>{message}</span>
        <span className={isOnline ? "text-emerald-600" : "text-amber-600"}>{isOnline ? "Online" : "Offline"}</span>
      </div>
    </div>
  );
}
