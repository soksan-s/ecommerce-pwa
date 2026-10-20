"use client";

import { useEffect, useState } from "react";

const initialTax = { enabled: true, taxName: "VAT", taxRate: 10, taxType: "exclusive" };

export function AdminTaxSettingsPageView() {
  const [tax, setTax] = useState(initialTax);
  const [rules, setRules] = useState([]);
  const [newName, setNewName] = useState("");
  const [newRate, setNewRate] = useState("10");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadRules() {
    const response = await fetch("/api/admin/taxes", { cache: "no-store" });
    const result = await response.json();
    if (response.ok && Array.isArray(result.data)) setRules(result.data);
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/store-tax-settings", { cache: "no-store" }).then((res) => res.json()),
      loadRules(),
    ]).then(([result]) => {
      if (result?.data) setTax({ ...initialTax, ...result.data });
    }).catch(() => setMessage("Could not load tax settings.")).finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/store-tax-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tax),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save tax settings.");
      setMessage("Saved. POS and online checkout now use these defaults.");
    } catch (error) {
      setMessage(error.message || "Unable to save tax settings.");
    } finally {
      setSaving(false);
    }
  }

  async function addRule(event) {
    event.preventDefault();
    try {
      const response = await fetch("/api/admin/taxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, rate: Number(newRate), type: "EXCLUSIVE" }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to add tax rule.");
      setRules((current) => [...current, result.data]);
      setNewName("");
      setMessage("Tax rule added. Assign it to products in Product Management.");
    } catch (error) {
      setMessage(error.message || "Unable to add tax rule.");
    }
  }

  if (loading) return <div className="p-8 text-sm text-[var(--muted-foreground)]">Loading tax settings…</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--action)]">Store configuration</p>
        <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)]">Tax & VAT</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">Manage the shared default used by POS and online orders. Product tax rules override this default.</p>
      </header>

      <section className="space-y-5 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 sm:p-6">
        <label className="flex items-center justify-between gap-4 text-sm font-semibold text-[var(--foreground)]">
          Enable tax calculation
          <input type="checkbox" checked={tax.enabled} onChange={(event) => setTax((current) => ({ ...current, enabled: event.target.checked }))} className="size-5 accent-emerald-700" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-bold text-[var(--muted-foreground)]">Tax name
            <input value={tax.taxName} onChange={(event) => setTax((current) => ({ ...current, taxName: event.target.value }))} className="app-input w-full px-3 py-2.5 text-sm" />
          </label>
          <label className="space-y-1.5 text-xs font-bold text-[var(--muted-foreground)]">Default rate (%)
            <input type="number" min="0" max="100" step="0.01" value={tax.taxRate} onChange={(event) => setTax((current) => ({ ...current, taxRate: Number(event.target.value) }))} className="app-input w-full px-3 py-2.5 text-sm" />
          </label>
        </div>
        <fieldset>
          <legend className="mb-2 text-xs font-bold text-[var(--muted-foreground)]">Price behavior</legend>
          <div className="flex flex-wrap gap-3">
            {[["exclusive", "Add tax at checkout"], ["inclusive", "Price includes tax"]].map(([value, label]) => (
              <label key={value} className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border-soft)] px-4 py-3 text-sm text-[var(--foreground)]">
                <input type="radio" name="admin-tax-type" checked={tax.taxType === value} onChange={() => setTax((current) => ({ ...current, taxType: value }))} />{label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={saving} className="rounded-xl bg-[var(--action)] px-5 py-2.5 text-sm font-bold text-[var(--action-foreground)] disabled:opacity-50">{saving ? "Saving…" : "Save tax settings"}</button>
          {message ? <p role="status" className="text-sm text-[var(--muted-foreground)]">{message}</p> : null}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 sm:p-6">
        <div><h2 className="text-lg font-bold text-[var(--foreground)]">Product tax rules</h2><p className="mt-1 text-xs text-[var(--muted-foreground)]">Use a 0% rule for items your business treats as exempt, then assign it to those products.</p></div>
        {rules.length ? <ul className="divide-y divide-[var(--border-soft)]">{rules.map((rule) => <li key={rule.id} className="flex justify-between py-2 text-sm"><span>{rule.name}</span><span>{(Number(rule.rate) * 100).toFixed(2)}% · {rule.type.toLowerCase()}</span></li>)}</ul> : <p className="text-sm text-[var(--muted-foreground)]">No product rules created yet.</p>}
        <form onSubmit={addRule} className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
          <input required minLength={2} value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Rule name, e.g. Basic food exempt" className="app-input px-3 py-2 text-sm" />
          <input required type="number" min="0" max="100" step="0.01" value={newRate} onChange={(event) => setNewRate(event.target.value)} aria-label="Rule rate percent" className="app-input px-3 py-2 text-sm" />
          <button type="submit" className="rounded-xl border border-[var(--border-soft)] px-4 py-2 text-sm font-semibold text-[var(--foreground)]">Add rule</button>
        </form>
      </section>
    </div>
  );
}
