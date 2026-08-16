"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

const MODE_STORAGE_KEY = "grocery-mode";
const MODE_EVENT = "grocery-theme-change";
const SERVER_SNAPSHOT = "dark";

function getStoredMode() {
  if (typeof window === "undefined") {
    return "dark";
  }

  return localStorage.getItem(MODE_STORAGE_KEY) || "dark";
}

function getSnapshot() {
  return getStoredMode();
}

function getServerSnapshot() {
  return SERVER_SNAPSHOT;
}

function subscribe(callback) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = () => callback();

  window.addEventListener("storage", handleChange);
  window.addEventListener(MODE_EVENT, handleChange);
  mediaQuery.addEventListener("change", handleChange);

  return () => {
    window.removeEventListener("storage", handleChange);
    window.removeEventListener(MODE_EVENT, handleChange);
    mediaQuery.removeEventListener("change", handleChange);
  };
}

function resolveMode(mode) {
  if (mode !== "system") {
    return mode;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyMode(mode) {
  const resolved = resolveMode(mode);
  document.body.dataset.mode = resolved;
  document.documentElement.dataset.mode = resolved;
  document.documentElement.style.colorScheme = resolved;
}

export function ThemeToggle({ className = "" }) {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof document !== "undefined") {
      applyMode(mode);
    }
  }, [mode]);

  function toggleMode() {
    const current = resolveMode(mode);
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem(MODE_STORAGE_KEY, next);
    window.dispatchEvent(new Event(MODE_EVENT));
  }

  const resolved = mounted ? resolveMode(mode) : "dark";

  return (
    <button
      type="button"
      onClick={toggleMode}
      className={`app-icon-button ${className}`}
      aria-label={resolved === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={resolved === "dark" ? "Light mode" : "Dark mode"}
    >
      {resolved === "dark" ? <MoonStar className="size-4" /> : <SunMedium className="size-4" />}
    </button>
  );
}
