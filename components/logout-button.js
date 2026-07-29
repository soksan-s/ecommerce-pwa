"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function LogoutButton({ variant = "outline", className = "", children }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const cancellingRef = useRef(false);

  async function handleLogout() {
    // Guard against rapid double-clicks
    if (cancellingRef.current) return;
    cancellingRef.current = true;
    setLoading(true);

    try {
      // Only use Better Auth's signOut — it handles all cookie/session cleanup.
      // Do NOT call the custom /api/auth/logout endpoint as well, since that races.
      await authClient.signOut();

      // Navigate after a small delay to let session cleanup propagate
      await new Promise((r) => setTimeout(r, 100));

      // Use replace instead of push to avoid stacking history entries
      router.replace("/");
    } catch (error) {
      console.error("Logout failed", error);
      // Even on error, try to navigate home so the user isn't stuck
      router.replace("/");
    } finally {
      setLoading(false);
      cancellingRef.current = false;
    }
  }

  return (
    <Button variant={variant} className={className} onClick={handleLogout} disabled={loading}>
      {loading ? (
        "Logging out..."
      ) : (
        <>
          <LogOut className="mr-2 size-4" />
          {children || "Logout"}
        </>
      )}
    </Button>
  );
}
