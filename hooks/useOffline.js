"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

// Shared singleton state so all components share a single health check loop
// rather than spawning dozens of overlapping polling intervals.
let globalIsOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
let isPolling = false;
let checkTimer = null;
let currentController = null;
const listeners = new Set();

function emitChange() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {}
  }
}

async function performHealthCheck() {
  if (typeof window === "undefined") return;

  // Instant check using browser's built-in navigator
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    if (globalIsOnline !== false) {
      globalIsOnline = false;
      emitChange();
    }
    return;
  }

  // Cancel prior check if still in-flight
  if (currentController) {
    try {
      currentController.abort("superseded");
    } catch {}
    currentController = null;
  }

  const controller = new AbortController();
  currentController = controller;

  // 6-second timeout to avoid false offline flags during heavy Turbopack dev builds
  const timeoutId = setTimeout(() => {
    try {
      controller.abort("timeout");
    } catch {}
  }, 6000);

  try {
    const res = await fetch("/api/health", {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const nextStatus = res.ok === true;
    if (globalIsOnline !== nextStatus) {
      globalIsOnline = nextStatus;
      emitChange();
    }
  } catch (error) {
    clearTimeout(timeoutId);

    // Gracefully ignore intentional aborts (timeout, superseded, unmount)
    const isAborted =
      error?.name === "AbortError" ||
      controller.signal.aborted ||
      error === "timeout" ||
      error === "superseded";

    if (!isAborted && globalIsOnline !== false) {
      globalIsOnline = false;
      emitChange();
    }
  } finally {
    if (currentController === controller) {
      currentController = null;
    }
  }
}

function startGlobalPoller() {
  if (typeof window === "undefined" || isPolling) return;
  isPolling = true;

  performHealthCheck();

  // Gentle 20-second interval for background verification
  checkTimer = setInterval(performHealthCheck, 20000);

  window.addEventListener("online", performHealthCheck);
  window.addEventListener("offline", () => {
    globalIsOnline = false;
    emitChange();
  });
  window.addEventListener("focus", performHealthCheck);
}

function stopGlobalPollerIfNoListeners() {
  if (listeners.size === 0 && isPolling) {
    isPolling = false;
    if (checkTimer) {
      clearInterval(checkTimer);
      checkTimer = null;
    }
    if (currentController) {
      try {
        currentController.abort("unsubscribed");
      } catch {}
      currentController = null;
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("online", performHealthCheck);
      window.removeEventListener("focus", performHealthCheck);
    }
  }
}

function subscribe(callback) {
  listeners.add(callback);
  if (!isPolling) {
    startGlobalPoller();
  }
  return () => {
    listeners.delete(callback);
    stopGlobalPollerIfNoListeners();
  };
}

function getSnapshot() {
  return globalIsOnline;
}

function getServerSnapshot() {
  return true;
}

export function useOffline() {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return {
    isOnline,
    isOffline: mounted ? !isOnline : false,
    isChecking: !mounted,
  };
}
