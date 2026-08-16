"use client";

import { useEffect, useState } from "react";

export function useOffline() {
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setMounted(true);

    let active = true;

    async function checkConnectivity() {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (active) setIsOnline(false);
        return;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const response = await fetch("/api/health", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (active) {
          setIsOnline(response.ok === true);
        }
      } catch {
        if (active) {
          setIsOnline(false);
        }
      }
    }

    checkConnectivity();
    const interval = setInterval(checkConnectivity, 4000);

    function handleOnline() {
      checkConnectivity();
    }

    function handleOffline() {
      if (active) setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return {
    isOnline,
    isOffline: mounted ? !isOnline : false,
    isChecking: !mounted,
  };
}
