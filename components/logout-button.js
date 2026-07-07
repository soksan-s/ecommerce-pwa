"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function LogoutButton({ variant = "outline", className = "", children }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await authClient.signOut();
      
      // Also hit our custom endpoint if any remaining cookies exist, but BetterAuth handles its own.
      await fetch("/api/auth/logout", { method: "POST" });
      
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Logout failed", error);
      setLoading(false);
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
