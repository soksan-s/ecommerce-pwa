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
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => { });
      await authClient.signOut().catch(() => { });
      window.location.href = "/login";
    } catch (error) {
      window.location.href = "/login";
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
