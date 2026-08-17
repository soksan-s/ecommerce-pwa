"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { defaultPOSSettings, usePOSSettings } from "@/hooks/usePOSSettings";
import { useOffline } from "@/hooks/useOffline";
import { getSyncLogs } from "@/lib/sync";

const tabs = [
  { key: "currency", label: "Currency" },
  { key: "tax", label: "Tax" },
  { key: "discount", label: "Discount" },
  { key: "storeInfo", label: "Store Info" },
  { key: "appearance", label: "Appearance" },
  { key: "printer", label: "Printer" },
  { key: "cashiers", label: "Cashiers & PIN" },
  { key: "syncLogs", label: "Sync Logs" },
];

function FieldLabel({ children }) {
  return (
    <label className="block text-xs font-bold text-[var(--foreground)]">
      {children}
    </label>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`h-7 w-12 rounded-full p-[3px] transition-colors ${checked ? "bg-[var(--pos-action)]" : "bg-[var(--border-soft)]"}`}
      aria-pressed={checked}
    >
      <span
        className={`block size-5 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  );
}

function RadioGroup({ name, value, options, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <label
          key={option.value}
          className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
            value === option.value
              ? "border-[var(--pos-action)] bg-[var(--pos-action-surface)] text-[var(--pos-action)]"
              : "border-[var(--border-soft)] bg-[var(--surface-soft)] text-[var(--foreground)] hover:bg-[var(--surface-quiet)]"
          }`}
        >
          <input
            type="radio"
            name={name}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

function SectionCard({ children }) {
  return (
    <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-5 shadow-xs text-[var(--foreground)]">
      {children}
    </section>
  );
}

const inputCls =
  "mt-1.5 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3.5 py-2.5 text-xs font-bold text-[var(--foreground)] outline-none transition-colors focus:border-[var(--pos-action)] focus:bg-[var(--surface-strong)] placeholder:text-[var(--muted-foreground)]";

const saveBtnCls =
  "rounded-xl bg-[var(--pos-action)] hover:bg-[var(--pos-action-hover)] px-4 py-2 text-xs font-extrabold text-[var(--pos-action-fg)] shadow-xs transition-all active:scale-[0.98]";

export default function PosSettingsPage() {
  const { settings, updateSettings } = usePOSSettings();
  const { isOnline } = useOffline();
  const [activeTab, setActiveTab] = useState("currency");
  const [draft, setDraft] = useState(defaultPOSSettings);
  const [savedSection, setSavedSection] = useState("");
  const [newPreset, setNewPreset] = useState("");
  const [newCashierName, setNewCashierName] = useState("");
  const [newCashierPin, setNewCashierPin] = useState("");
  const [syncLogs, setSyncLogs] = useState([]);

  useEffect(() => {
    if (activeTab === "syncLogs") {
      getSyncLogs().then(setSyncLogs);
    }
  }, [activeTab]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDraft(settings);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [settings]);

  useEffect(() => {
    if (!savedSection) {
      return undefined;
    }

    const timer = window.setTimeout(() => setSavedSection(""), 2000);
    return () => window.clearTimeout(timer);
  }, [savedSection]);

  function patchSection(section, values) {
    setDraft((current) => ({
      ...current,
      [section]: {
        ...current[section],
        ...values,
      },
    }));
  }

  async function saveSection(section) {
    await updateSettings(section, draft[section]);

    if (section === "cashiers" && isOnline) {
      try {
        await fetch("/api/pos/cashiers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft.cashiers),
        });
      } catch {
        // Cashier settings remain saved locally if the backend is unavailable.
      }
    }

    setSavedSection(section);
  }

  function handleLogoUpload(file) {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      patchSection("storeInfo", { logoBase64: reader.result });
    };
    reader.readAsDataURL(file);
  }

  function addPreset() {
    const value = Number(newPreset);
    if (!value || draft.discount.presets.length >= 5) {
      return;
    }

    patchSection("discount", {
      presets: [...new Set([...draft.discount.presets, value])].slice(0, 5),
    });
    setNewPreset("");
  }

  function addCashier() {
    if (!newCashierName.trim() || !/^\d{4}$/.test(newCashierPin)) {
      return;
    }

    patchSection("cashiers", {
      list: [
        ...draft.cashiers.list,
        {
          id: `cashier-${Date.now()}`,
          name: newCashierName.trim(),
          pinSet: true,
          pin: newCashierPin,
        },
      ],
    });
    setNewCashierName("");
    setNewCashierPin("");
  }

  function renderSaved(section) {
    return savedSection === section ? (
      <span className="text-xs font-extrabold text-[var(--pos-action)]">Saved!</span>
    ) : null;
  }

  return (
    <div className="space-y-4 transition-colors">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--pos-action)]">Settings</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--foreground)] font-display">POS Settings</h1>
          <p className="mt-0.5 text-xs font-semibold text-[var(--muted-foreground)]">
            Saved locally and synced when online.{" "}
            <span className={`font-extrabold ${isOnline ? "text-[var(--pos-action)]" : "text-amber-500"}`}>
              {isOnline ? "● Online" : "○ Offline"}
            </span>
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-strong)] p-1.5 shadow-xs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={
              activeTab === tab.key
                ? "shrink-0 rounded-xl bg-[var(--pos-action)] px-3.5 py-2 text-xs font-extrabold text-[var(--pos-action-fg)] transition-all"
                : "shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)] transition-all"
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Currency ── */}
      {activeTab === "currency" ? (
        <SectionCard>
          <div className="space-y-5">
            <div>
              <FieldLabel>Primary currency</FieldLabel>
              <div className="mt-2">
                <RadioGroup
                  name="currency"
                  value={draft.currency.primaryCurrency}
                  options={[
                    { value: "USD", label: "USD" },
                    { value: "KHR", label: "KHR" },
                  ]}
                  onChange={(value) => patchSection("currency", { primaryCurrency: value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <FieldLabel>Show both currencies</FieldLabel>
              <Toggle
                checked={draft.currency.showBothCurrencies}
                onChange={(value) => patchSection("currency", { showBothCurrencies: value })}
              />
            </div>
            <div>
              <FieldLabel>Exchange Rate</FieldLabel>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-[var(--muted-foreground)]">1 USD =</span>
                <input
                  type="number"
                  value={draft.currency.exchangeRate}
                  onChange={(event) => patchSection("currency", { exchangeRate: Number(event.target.value) })}
                  className="w-36 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-bold text-[var(--foreground)] outline-none focus:border-[var(--pos-action)]"
                />
                <span className="text-xs font-bold text-[var(--muted-foreground)]">KHR</span>
                <span className="text-xs font-semibold text-[var(--muted-foreground)]">
                  Last updated: {draft.currency.lastUpdated || "Never"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  patchSection("currency", { lastUpdated: new Date().toLocaleString() });
                  window.setTimeout(() => saveSection("currency"), 0);
                }}
                className={saveBtnCls}
              >
                Save Exchange Rate
              </button>
              {renderSaved("currency")}
            </div>
            <p className="rounded-xl bg-[var(--surface-soft)] px-4 py-3 text-xs font-semibold text-[var(--muted-foreground)]">
              This rate is used across the entire POS for all currency conversions.
            </p>
          </div>
        </SectionCard>
      ) : null}

      {/* ── Tax ── */}
      {activeTab === "tax" ? (
        <SectionCard>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex items-center justify-between gap-4 md:col-span-2">
              <FieldLabel>Enable Tax</FieldLabel>
              <Toggle
                checked={draft.tax.enabled}
                onChange={(value) => patchSection("tax", { enabled: value })}
              />
            </div>
            <div>
              <FieldLabel>Tax Name</FieldLabel>
              <input
                value={draft.tax.taxName}
                onChange={(event) => patchSection("tax", { taxName: event.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <FieldLabel>Tax Rate (%)</FieldLabel>
              <input
                type="number"
                value={draft.tax.taxRate}
                onChange={(event) => patchSection("tax", { taxRate: Number(event.target.value) })}
                className={inputCls}
              />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Tax Type</FieldLabel>
              <div className="mt-2">
                <RadioGroup
                  name="taxType"
                  value={draft.tax.taxType}
                  options={[
                    { value: "inclusive", label: "Inclusive" },
                    { value: "exclusive", label: "Exclusive" },
                  ]}
                  onChange={(value) => patchSection("tax", { taxType: value })}
                />
              </div>
            </div>
            <div className="space-y-2.5 md:col-span-2">
              <FieldLabel>Apply Tax To</FieldLabel>
              {[
                ["allProducts", "All Products"],
                ["specificCategories", "Specific Categories"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2.5 text-xs font-bold text-[var(--foreground)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.tax.applyTo[key]}
                    onChange={(event) =>
                      patchSection("tax", { applyTo: { ...draft.tax.applyTo, [key]: event.target.checked } })
                    }
                    className="size-4 accent-[var(--pos-action)] rounded"
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between gap-4 md:col-span-2">
              <FieldLabel>Show tax line on receipt</FieldLabel>
              <Toggle
                checked={draft.tax.showTaxLineOnReceipt}
                onChange={(value) => patchSection("tax", { showTaxLineOnReceipt: value })}
              />
            </div>
            <div className="flex items-center gap-3 md:col-span-2">
              <button type="button" onClick={() => saveSection("tax")} className={saveBtnCls}>
                Save Tax
              </button>
              {renderSaved("tax")}
            </div>
          </div>
        </SectionCard>
      ) : null}

      {/* ── Discount ── */}
      {activeTab === "discount" ? (
        <SectionCard>
          <div className="space-y-5">
            {[
              ["enabled", "Enable Discounts"],
              ["allowPercentDiscount", "Allow % discount"],
              ["allowFixedDiscount", "Allow fixed amount discount"],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <FieldLabel>{label}</FieldLabel>
                <Toggle
                  checked={draft.discount[key]}
                  onChange={(value) => patchSection("discount", { [key]: value })}
                />
              </div>
            ))}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>Maximum discount %</FieldLabel>
                <input
                  type="number"
                  value={draft.discount.maxDiscountPercent}
                  onChange={(event) =>
                    patchSection("discount", { maxDiscountPercent: Number(event.target.value) })
                  }
                  className={inputCls}
                />
              </div>
              <div>
                <FieldLabel>Require manager PIN over (%)</FieldLabel>
                <input
                  type="number"
                  value={draft.discount.managerPinThresholdPercent}
                  onChange={(event) =>
                    patchSection("discount", { managerPinThresholdPercent: Number(event.target.value) })
                  }
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <FieldLabel>Preset discount buttons</FieldLabel>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {draft.discount.presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() =>
                      patchSection("discount", {
                        presets: draft.discount.presets.filter((entry) => entry !== preset),
                      })
                    }
                    className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-bold text-[var(--foreground)] hover:border-red-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 transition-colors"
                  >
                    {preset}% ×
                  </button>
                ))}
              </div>
              <div className="mt-2.5 flex gap-2">
                <input
                  type="number"
                  value={newPreset}
                  onChange={(event) => setNewPreset(event.target.value)}
                  placeholder="5"
                  className="w-24 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-bold text-[var(--foreground)] outline-none focus:border-[var(--pos-action)]"
                />
                <button
                  type="button"
                  onClick={addPreset}
                  disabled={draft.discount.presets.length >= 5}
                  className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-2 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-quiet)] disabled:opacity-40 transition-all"
                >
                  Add Preset
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => saveSection("discount")} className={saveBtnCls}>
                Save Discount
              </button>
              {renderSaved("discount")}
            </div>
          </div>
        </SectionCard>
      ) : null}

      {/* ── Store Info ── */}
      {activeTab === "storeInfo" ? (
        <SectionCard>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>Store Name</FieldLabel>
              <input
                value={draft.storeInfo.storeName}
                onChange={(event) => patchSection("storeInfo", { storeName: event.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <FieldLabel>Phone Number</FieldLabel>
              <input
                value={draft.storeInfo.phoneNumber}
                onChange={(event) => patchSection("storeInfo", { phoneNumber: event.target.value })}
                className={inputCls}
              />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Store Address</FieldLabel>
              <textarea
                value={draft.storeInfo.storeAddress}
                onChange={(event) => patchSection("storeInfo", { storeAddress: event.target.value })}
                className={`${inputCls} min-h-20 resize-none`}
              />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Store Logo</FieldLabel>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => handleLogoUpload(event.target.files?.[0])}
                className="mt-1.5 block w-full text-xs font-bold text-[var(--foreground)]"
              />
              {draft.storeInfo.logoBase64 ? (
                <img
                  src={draft.storeInfo.logoBase64}
                  alt="Store logo preview"
                  className="mt-3 size-20 rounded-xl border border-[var(--border-soft)] object-cover"
                />
              ) : null}
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Receipt Header Note</FieldLabel>
              <input
                value={draft.storeInfo.receiptHeaderNote}
                onChange={(event) => patchSection("storeInfo", { receiptHeaderNote: event.target.value })}
                className={inputCls}
              />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Receipt Footer Message</FieldLabel>
              <textarea
                value={draft.storeInfo.receiptFooterMessage}
                onChange={(event) => patchSection("storeInfo", { receiptFooterMessage: event.target.value })}
                className={`${inputCls} min-h-20 resize-none`}
              />
            </div>
            <div className="flex items-center gap-3 md:col-span-2">
              <button type="button" onClick={() => saveSection("storeInfo")} className={saveBtnCls}>
                Save Store Info
              </button>
              {renderSaved("storeInfo")}
            </div>
          </div>
        </SectionCard>
      ) : null}

      {/* ── Appearance ── */}
      {activeTab === "appearance" ? (
        <SectionCard>
          <div className="space-y-5">
            <div>
              <FieldLabel>Theme</FieldLabel>
              <div className="mt-2">
                <RadioGroup
                  name="theme"
                  value={draft.appearance.theme}
                  options={[
                    { value: "light", label: "Light" },
                    { value: "dark", label: "Dark" },
                    { value: "system", label: "System" },
                  ]}
                  onChange={(value) => patchSection("appearance", { theme: value })}
                />
              </div>
            </div>
            <div>
              <FieldLabel>POS Layout</FieldLabel>
              <div className="mt-2">
                <RadioGroup
                  name="posLayout"
                  value={draft.appearance.posLayout}
                  options={[
                    { value: "compact", label: "Compact" },
                    { value: "comfortable", label: "Comfortable" },
                  ]}
                  onChange={(value) => patchSection("appearance", { posLayout: value })}
                />
              </div>
            </div>
            <div>
              <FieldLabel>Default Language</FieldLabel>
              <div className="mt-2">
                <RadioGroup
                  name="defaultLanguage"
                  value={draft.appearance.defaultLanguage}
                  options={[
                    { value: "en", label: "English" },
                    { value: "km", label: "ភាសាខ្មែរ" },
                  ]}
                  onChange={(value) => patchSection("appearance", { defaultLanguage: value })}
                />
              </div>
            </div>
            <div>
              <FieldLabel>Receipt Language</FieldLabel>
              <div className="mt-2">
                <RadioGroup
                  name="receiptLanguage"
                  value={draft.appearance.receiptLanguage}
                  options={[
                    { value: "en", label: "English" },
                    { value: "km", label: "Khmer" },
                  ]}
                  onChange={(value) => patchSection("appearance", { receiptLanguage: value })}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => saveSection("appearance")} className={saveBtnCls}>
                Save Appearance
              </button>
              {renderSaved("appearance")}
            </div>
          </div>
        </SectionCard>
      ) : null}

      {/* ── Printer ── */}
      {activeTab === "printer" ? (
        <SectionCard>
          <div className="space-y-5">
            <div>
              <FieldLabel>Printer Type</FieldLabel>
              <div className="mt-2">
                <RadioGroup
                  name="printerType"
                  value={draft.printer.printerType}
                  options={[
                    { value: "thermal-58", label: "Thermal 58mm" },
                    { value: "thermal-80", label: "Thermal 80mm" },
                    { value: "none", label: "None" },
                  ]}
                  onChange={(value) => patchSection("printer", { printerType: value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <FieldLabel>Auto-print after sale</FieldLabel>
              <Toggle
                checked={draft.printer.autoPrintAfterSale}
                onChange={(value) => patchSection("printer", { autoPrintAfterSale: value })}
              />
            </div>
            <div>
              <FieldLabel>Print receipt copies</FieldLabel>
              <input
                type="number"
                min="1"
                max="3"
                value={draft.printer.receiptCopies}
                onChange={(event) =>
                  patchSection("printer", {
                    receiptCopies: Math.min(3, Math.max(1, Number(event.target.value))),
                  })
                }
                className="mt-1.5 w-28 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-bold text-[var(--foreground)] outline-none focus:border-[var(--pos-action)]"
              />
            </div>
            <p className="rounded-xl bg-[var(--surface-soft)] px-4 py-3 text-xs font-semibold text-[var(--muted-foreground)]">
              Actual printing will use the browser print dialog.
            </p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => saveSection("printer")} className={saveBtnCls}>
                Save Printer
              </button>
              {renderSaved("printer")}
            </div>
          </div>
        </SectionCard>
      ) : null}

      {/* ── Cashiers ── */}
      {activeTab === "cashiers" ? (
        <SectionCard>
          <div className="space-y-5">
            <div className="space-y-2.5">
              {draft.cashiers.list.length ? (
                draft.cashiers.list.map((cashier) => (
                  <div
                    key={cashier.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5"
                  >
                    <div>
                      <p className="text-xs font-extrabold text-[var(--foreground)]">{cashier.name}</p>
                      <p className="text-[11px] font-semibold text-[var(--muted-foreground)]">
                        PIN: {cashier.pinSet ? "set" : "not set"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const nextPin = window.prompt("Enter new 4-digit PIN", cashier.pin || "");
                          if (/^\d{4}$/.test(nextPin || "")) {
                            patchSection("cashiers", {
                              list: draft.cashiers.list.map((entry) =>
                                entry.id === cashier.id ? { ...entry, pin: nextPin, pinSet: true } : entry
                              ),
                            });
                          }
                        }}
                        className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-strong)] px-3 py-1.5 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-quiet)] transition-colors"
                      >
                        Edit PIN
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          patchSection("cashiers", {
                            list: draft.cashiers.list.filter((entry) => entry.id !== cashier.id),
                          })
                        }
                        className="rounded-lg bg-red-50 dark:bg-red-950/40 px-3 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--border-soft)] p-8 text-center text-xs font-bold text-[var(--muted-foreground)]">
                  No cashiers added yet.
                </div>
              )}
            </div>
            <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_10rem_auto]">
              <input
                value={newCashierName}
                onChange={(event) => setNewCashierName(event.target.value)}
                placeholder="Cashier name"
                className={inputCls}
              />
              <input
                value={newCashierPin}
                onChange={(event) => setNewCashierPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="4-digit PIN"
                className={inputCls}
              />
              <button
                type="button"
                onClick={addCashier}
                className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-2 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-quiet)] transition-all"
              >
                Add Cashier
              </button>
            </div>
            <div>
              <FieldLabel>Manager PIN</FieldLabel>
              <input
                value={draft.cashiers.managerPin}
                onChange={(event) =>
                  patchSection("cashiers", {
                    managerPin: event.target.value.replace(/\D/g, "").slice(0, 4),
                  })
                }
                placeholder="4-digit PIN"
                className="mt-1.5 w-40 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-bold text-[var(--foreground)] outline-none focus:border-[var(--pos-action)]"
              />
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => saveSection("cashiers")} className={saveBtnCls}>
                Save Cashiers
              </button>
              {renderSaved("cashiers")}
            </div>
          </div>
        </SectionCard>
      ) : null}

      {/* ── Sync Logs ── */}
      {activeTab === "syncLogs" ? (
        <SectionCard>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-[var(--foreground)]">Recent Sync Activity</h2>
              <button
                type="button"
                onClick={() => getSyncLogs().then(setSyncLogs)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3.5 py-2 text-xs font-bold text-[var(--foreground)] hover:bg-[var(--surface-quiet)] transition-all active:scale-[0.98]"
              >
                <RefreshCw className="size-3.5" />
                Refresh
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-[var(--border-soft)]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--surface-soft)] text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--muted-foreground)]">
                  <tr>
                    <th className="px-4 py-2.5">Time</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Endpoint</th>
                    <th className="px-4 py-2.5">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-soft)]">
                  {syncLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[var(--surface-soft)]/50 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-[var(--muted-foreground)]">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                            log.status === "success"
                              ? "bg-[var(--pos-action-surface)] text-[var(--pos-action)]"
                              : "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400"
                          }`}
                        >
                          {log.status === "success" ? "Success" : "Failed"}
                        </span>
                      </td>
                      <td
                        className="max-w-[180px] truncate px-4 py-2.5 font-medium text-[var(--foreground)]"
                        title={log.url}
                      >
                        {new URL(log.url, window.location.origin).pathname}
                      </td>
                      <td className="px-4 py-2.5 text-[var(--muted-foreground)]">
                        {log.error || "—"}
                      </td>
                    </tr>
                  ))}
                  {syncLogs.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-xs font-semibold text-[var(--muted-foreground)]"
                      >
                        No sync logs available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
