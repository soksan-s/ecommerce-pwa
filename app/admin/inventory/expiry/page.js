import Link from "next/link";
import { redirect } from "next/navigation";

import { requireAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { TrackInventoryBatchForm } from "@/components/admin/track-inventory-batch";

function businessDateKey(value) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Phnom_Penh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function addDays(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function productName(batch) {
  return batch.variant?.product?.nameKh || batch.variant?.product?.name || batch.variant?.name || "Unknown product";
}

function groupBatches(batches) {
  const today = businessDateKey(new Date());
  const sevenDays = addDays(today, 7);
  const thirtyDays = addDays(today, 30);

  return {
    expired: batches.filter((batch) => batch.expiryDate && businessDateKey(batch.expiryDate) < today),
    sevenDays: batches.filter((batch) => batch.expiryDate && businessDateKey(batch.expiryDate) >= today && businessDateKey(batch.expiryDate) <= sevenDays),
    thirtyDays: batches.filter((batch) => batch.expiryDate && businessDateKey(batch.expiryDate) > sevenDays && businessDateKey(batch.expiryDate) <= thirtyDays),
    noExpiry: batches.filter((batch) => !batch.expiryDate),
  };
}

function BatchTable({ rows }) {
  if (!rows.length) {
    return (
      <div className="rounded-[1.2rem] border border-dashed border-[var(--border-soft)] p-8 text-center text-sm text-[var(--muted-foreground)]">
        No batches in this expiry window.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[54rem] text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
          <tr>
            <th className="px-3 py-2">Product</th>
            <th className="px-3 py-2">Branch</th>
            <th className="px-3 py-2">Batch</th>
            <th className="px-3 py-2">Quantity Left</th>
            <th className="px-3 py-2">Expiry Date</th>
            <th className="px-3 py-2">Cost Value</th>
            <th className="px-3 py-2">Tracking</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((batch) => (
            <tr key={batch.id} className="border-t border-[var(--border-soft)]">
              <td className="px-3 py-3 font-semibold text-[var(--foreground)]">{productName(batch)}</td>
              <td className="px-3 py-3 text-[var(--muted-foreground)]">{batch.branch?.name || "Main"}</td>
              <td className="px-3 py-3 font-mono text-xs text-[var(--foreground)]">{batch.batchNumber}</td>
              <td className="px-3 py-3 font-semibold text-[var(--foreground)]">{batch.remainingQty.toLocaleString()}</td>
              <td className="px-3 py-3 text-[var(--muted-foreground)]">{batch.expiryDate ? new Date(batch.expiryDate).toLocaleDateString("en-GB", { timeZone: "Asia/Phnom_Penh" }) : "Not recorded"}</td>
              <td className="px-3 py-3 font-semibold text-[var(--foreground)]">{formatCurrency(Number(batch.costPrice) * batch.remainingQty)}</td>
              <td className="px-3 py-3">{batch.untracked ? <TrackInventoryBatchForm variantId={batch.variantId} branchId={batch.branchId} quantity={batch.remainingQty} /> : <span className="text-xs text-[var(--muted-foreground)]">Recorded</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function AdminInventoryExpiryPage({ searchParams }) {
  const admin = await requireAdminUser();

  if (!admin) {
    redirect("/login");
  }

  const resolvedParams = await searchParams;
  const activeTab = ["expired", "sevenDays", "thirtyDays", "noExpiry"].includes(resolvedParams?.tab) ? resolvedParams.tab : "expired";
  const [batches, inventoryRows] = await Promise.all([
    prisma.inventoryBatch.findMany({
      where: { remainingQty: { gt: 0 } },
      include: { variant: { include: { product: true } }, branch: true },
      orderBy: { expiryDate: "asc" },
    }),
    prisma.inventory.findMany({
      where: { quantity: { gt: 0 } },
      include: { variant: { include: { product: true } }, branch: true },
    }),
  ]);
  const trackedQty = new Map();
  for (const batch of batches) {
    const key = `${batch.variantId}:${batch.branchId}`;
    trackedQty.set(key, (trackedQty.get(key) || 0) + batch.remainingQty);
  }
  const untrackedBatches = inventoryRows.flatMap((row) => {
    const quantity = Math.max(0, row.quantity - (trackedQty.get(`${row.variantId}:${row.branchId}`) || 0));
    return quantity ? [{
      id: `untracked-${row.id}`,
      variantId: row.variantId,
      branchId: row.branchId,
      batchNumber: "Expiry not recorded",
      remainingQty: quantity,
      costPrice: row.variant?.costPrice || 0,
      expiryDate: null,
      variant: row.variant,
      branch: row.branch,
      untracked: true,
    }] : [];
  });
  const allRows = [...batches, ...untrackedBatches];
  const grouped = groupBatches(allRows);
  const tabs = [
    { key: "expired", label: "Expired", count: grouped.expired.length },
    { key: "sevenDays", label: "Expiring in 7 Days", count: grouped.sevenDays.length },
    { key: "thirtyDays", label: "Expiring in 30 Days", count: grouped.thirtyDays.length },
    { key: "noExpiry", label: "No Expiry Date", count: grouped.noExpiry.length },
  ];

  return (
    <main className="app-shell">
      <section className="app-card p-4 sm:p-6">
        <Link href="/admin?tab=inventory" className="text-sm font-semibold text-[var(--action)]">
          Back to inventory
        </Link>
        <p className="mt-5 text-xs uppercase tracking-[0.28em] text-[var(--muted-foreground)]">Expiry Tracking</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[var(--foreground)]">FEFO batch expiry report</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
          Monitor expired and soon-expiring grocery stock by branch and batch.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={`/admin/inventory/expiry?tab=${tab.key}`}
              className={
                activeTab === tab.key
                  ? "rounded-full bg-[var(--action)] px-4 py-2 text-sm font-semibold text-[var(--action-foreground)]"
                  : "rounded-full bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]"
              }
            >
              {tab.label} ({tab.count})
            </Link>
          ))}
        </div>

        <div className="mt-6">
          <BatchTable rows={grouped[activeTab]} />
        </div>
      </section>
    </main>
  );
}
