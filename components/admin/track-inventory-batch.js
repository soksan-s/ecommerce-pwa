"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TrackInventoryBatchForm({ variantId, branchId, quantity }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(quantity));
  const [expiryDate, setExpiryDate] = useState("");
  const [noExpiry, setNoExpiry] = useState(false);
  const [batchNumber, setBatchNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/inventory/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, branchId, quantity: Number(amount), expiryDate, noExpiry, batchNumber }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to record batch.");
      setOpen(false);
      router.refresh();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="rounded-lg border border-[var(--action)] px-2.5 py-1.5 text-[10px] font-bold text-[var(--action)] hover:bg-[var(--action)]/10">Record batch date</button>;

  return (
    <form onSubmit={submit} className="mt-2 min-w-56 space-y-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-quiet)] p-2">
      <input aria-label="Batch number" value={batchNumber} onChange={(event) => setBatchNumber(event.target.value)} placeholder="Batch number (optional)" className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-strong)] px-2 py-1.5 text-[10px]" />
      <input aria-label="Quantity in this batch" type="number" min="1" max={quantity} required value={amount} onChange={(event) => setAmount(event.target.value)} className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-strong)] px-2 py-1.5 text-[10px]" />
      <input aria-label="Expiry date" type="date" disabled={noExpiry} required={!noExpiry} value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} className="w-full rounded-md border border-[var(--border-soft)] bg-[var(--surface-strong)] px-2 py-1.5 text-[10px] disabled:opacity-50" />
      <label className="flex items-center gap-1.5 text-[10px] text-[var(--muted-foreground)]"><input type="checkbox" checked={noExpiry} onChange={(event) => setNoExpiry(event.target.checked)} />No printed expiry date</label>
      {error ? <p role="alert" className="text-[10px] text-rose-600">{error}</p> : null}
      <div className="flex gap-2"><button disabled={saving} className="rounded-md bg-[var(--action)] px-2.5 py-1.5 text-[10px] font-bold text-white disabled:opacity-50">{saving ? "Saving…" : "Save batch"}</button><button type="button" onClick={() => { setOpen(false); setError(""); }} className="px-2 py-1 text-[10px] text-[var(--muted-foreground)]">Cancel</button></div>
    </form>
  );
}
