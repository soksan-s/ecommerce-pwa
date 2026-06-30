"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PurchaseOrderForm } from "@/components/admin/po-form";

export default function NewProcurementPage() {
  const router = useRouter();

  return (
    <main className="app-shell min-h-screen bg-[var(--background-start)]">
      <header className="app-bar flex items-center gap-4 px-5 py-4">
        <button onClick={() => router.push("/admin/procurement")} className="app-icon-button p-2">
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">New Purchase Order</h1>
      </header>

      <section className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-[var(--foreground)]">Order Details</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">Create a new purchase order for a supplier.</p>
          </div>
          
          <div className="rounded-[1.2rem] bg-[var(--surface)] p-6 shadow-sm border border-white/20">
            <PurchaseOrderForm />
          </div>
        </div>
      </section>
    </main>
  );
}
