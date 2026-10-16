"use client";

import { Bell, BellOff, BellRing, Check, Loader2 } from "lucide-react";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { cn } from "@/lib/utils";

/**
 * Clean push notification toggle button for staff.
 */
export function PushNotificationToggle({ className, lang = "en" }) {
  const { isSupported, isSubscribed, loading, permission, subscribe, unsubscribe } =
    usePushSubscription();

  if (!isSupported) {
    return null;
  }

  const isKm = lang === "km" || lang === "kh";

  async function handleToggle() {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading || permission === "denied"}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all",
        isSubscribed
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
          : "border-[var(--border-soft)] bg-[var(--surface-quiet)] text-[var(--foreground)] hover:bg-[var(--surface-soft)]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      title={
        permission === "denied"
          ? isKm
            ? "ការជូនដំណឹងត្រូវបានបិទនៅក្នុង Browser settings"
            : "Push notifications are blocked in browser settings"
          : isSubscribed
          ? isKm
            ? "ការជូនដំណឹង Push ត្រូវបានបើកដំណើរការ"
            : "Push alerts active for background orders"
          : isKm
          ? "បើកការជូនដំណឹង Push ពេលកម្មវិធីបិទ"
          : "Enable background push notifications"
      }
    >
      {loading ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : isSubscribed ? (
        <BellRing className="size-3.5 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Bell className="size-3.5 text-[var(--muted-foreground)]" />
      )}

      <span>
        {isSubscribed
          ? isKm
            ? "Push បានបើក"
            : "Push Alerts On"
          : isKm
          ? "បើក Push"
          : "Enable Push"}
      </span>
    </button>
  );
}
