"use client";

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
  return <label className="block text-sm font-bold text-slate-700">{children}</label>;
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={checked ? "h-8 w-14 rounded-full bg-emerald-600 p-1" : "h-8 w-14 rounded-full bg-slate-300 p-1"}
      aria-pressed={checked}
    >
      <span className={checked ? "block size-6 translate-x-6 rounded-full bg-white transition" : "block size-6 rounded-full bg-white transition"} />
    </button>
  );
}

function RadioGroup({ name, value, options, onChange }) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((option) => (
        <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold">
          <input
            type="radio"
            name={name}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="accent-emerald-600"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

function SectionCard({ children }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">{children}</section>;
}

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
    return savedSection === section ? <span className="text-sm font-black text-emerald-700">Saved!</span> : null;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">Settings</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">POS Settings</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Saved locally and synced when online. Current status: {isOnline ? "Online" : "Offline"}
          </p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={
              activeTab === tab.key
                ? "shrink-0 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white"
                : "shrink-0 rounded-2xl px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-100"
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

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
              <Toggle checked={draft.currency.showBothCurrencies} onChange={(value) => patchSection("currency", { showBothCurrencies: value })} />
            </div>
            <div>
              <FieldLabel>Exchange Rate</FieldLabel>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="font-bold">1 USD =</span>
                <input
                  type="number"
                  value={draft.currency.exchangeRate}
                  onChange={(event) => patchSection("currency", { exchangeRate: Number(event.target.value) })}
                  className="w-40 rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-emerald-500"
                />
                <span className="font-bold">KHR</span>
                <span className="text-sm font-semibold text-slate-500">Last updated: {draft.currency.lastUpdated || "Never"}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  patchSection("currency", { lastUpdated: new Date().toLocaleString() });
                  window.setTimeout(() => saveSection("currency"), 0);
                }}
                className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white"
              >
                Save Exchange Rate
              </button>
              {renderSaved("currency")}
            </div>
            <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">
              This rate is used across the entire POS for all currency conversions.
            </p>
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "tax" ? (
        <SectionCard>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="flex items-center justify-between gap-4 md:col-span-2">
              <FieldLabel>Enable Tax</FieldLabel>
              <Toggle checked={draft.tax.enabled} onChange={(value) => patchSection("tax", { enabled: value })} />
            </div>
            <div>
              <FieldLabel>Tax Name</FieldLabel>
              <input value={draft.tax.taxName} onChange={(event) => patchSection("tax", { taxName: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-emerald-500" />
            </div>
            <div>
              <FieldLabel>Tax Rate (%)</FieldLabel>
              <input type="number" value={draft.tax.taxRate} onChange={(event) => patchSection("tax", { taxRate: Number(event.target.value) })} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-emerald-500" />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Tax Type</FieldLabel>
              <div className="mt-2">
                <RadioGroup name="taxType" value={draft.tax.taxType} options={[{ value: "inclusive", label: "Inclusive" }, { value: "exclusive", label: "Exclusive" }]} onChange={(value) => patchSection("tax", { taxType: value })} />
              </div>
            </div>
            <div className="space-y-3 md:col-span-2">
              <FieldLabel>Apply Tax To</FieldLabel>
              {[
                ["allProducts", "All Products"],
                ["specificCategories", "Specific Categories"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 font-bold">
                  <input type="checkbox" checked={draft.tax.applyTo[key]} onChange={(event) => patchSection("tax", { applyTo: { ...draft.tax.applyTo, [key]: event.target.checked } })} className="size-4 accent-emerald-600" />
                  {label}
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between gap-4 md:col-span-2">
              <FieldLabel>Show tax line on receipt</FieldLabel>
              <Toggle checked={draft.tax.showTaxLineOnReceipt} onChange={(value) => patchSection("tax", { showTaxLineOnReceipt: value })} />
            </div>
            <div className="flex items-center gap-3 md:col-span-2">
              <button type="button" onClick={() => saveSection("tax")} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">Save Tax</button>
              {renderSaved("tax")}
            </div>
          </div>
        </SectionCard>
      ) : null}

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
                <Toggle checked={draft.discount[key]} onChange={(value) => patchSection("discount", { [key]: value })} />
              </div>
            ))}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>Maximum discount %</FieldLabel>
                <input type="number" value={draft.discount.maxDiscountPercent} onChange={(event) => patchSection("discount", { maxDiscountPercent: Number(event.target.value) })} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-emerald-500" />
              </div>
              <div>
                <FieldLabel>Require manager PIN over (%)</FieldLabel>
                <input type="number" value={draft.discount.managerPinThresholdPercent} onChange={(event) => patchSection("discount", { managerPinThresholdPercent: Number(event.target.value) })} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div>
              <FieldLabel>Preset discount buttons</FieldLabel>
              <div className="mt-3 flex flex-wrap gap-2">
                {draft.discount.presets.map((preset) => (
                  <button key={preset} type="button" onClick={() => patchSection("discount", { presets: draft.discount.presets.filter((entry) => entry !== preset) })} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
                    {preset}% ×
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <input type="number" value={newPreset} onChange={(event) => setNewPreset(event.target.value)} placeholder="5" className="w-28 rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-emerald-500" />
                <button type="button" onClick={addPreset} disabled={draft.discount.presets.length >= 5} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white disabled:bg-slate-300">Add Preset</button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => saveSection("discount")} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">Save Discount</button>
              {renderSaved("discount")}
            </div>
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "storeInfo" ? (
        <SectionCard>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <FieldLabel>Store Name</FieldLabel>
              <input value={draft.storeInfo.storeName} onChange={(event) => patchSection("storeInfo", { storeName: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-emerald-500" />
            </div>
            <div>
              <FieldLabel>Phone Number</FieldLabel>
              <input value={draft.storeInfo.phoneNumber} onChange={(event) => patchSection("storeInfo", { phoneNumber: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-emerald-500" />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Store Address</FieldLabel>
              <textarea value={draft.storeInfo.storeAddress} onChange={(event) => patchSection("storeInfo", { storeAddress: event.target.value })} className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-emerald-500" />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Store Logo</FieldLabel>
              <input type="file" accept="image/*" onChange={(event) => handleLogoUpload(event.target.files?.[0])} className="mt-2 block w-full text-sm font-bold" />
              {draft.storeInfo.logoBase64 ? <img src={draft.storeInfo.logoBase64} alt="Store logo preview" className="mt-3 size-24 rounded-2xl border border-slate-200 object-cover" /> : null}
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Receipt Header Note</FieldLabel>
              <input value={draft.storeInfo.receiptHeaderNote} onChange={(event) => patchSection("storeInfo", { receiptHeaderNote: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-emerald-500" />
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Receipt Footer Message</FieldLabel>
              <textarea value={draft.storeInfo.receiptFooterMessage} onChange={(event) => patchSection("storeInfo", { receiptFooterMessage: event.target.value })} className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-emerald-500" />
            </div>
            <div className="flex items-center gap-3 md:col-span-2">
              <button type="button" onClick={() => saveSection("storeInfo")} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">Save Store Info</button>
              {renderSaved("storeInfo")}
            </div>
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "appearance" ? (
        <SectionCard>
          <div className="space-y-5">
            <div><FieldLabel>Theme</FieldLabel><div className="mt-2"><RadioGroup name="theme" value={draft.appearance.theme} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "System" }]} onChange={(value) => patchSection("appearance", { theme: value })} /></div></div>
            <div><FieldLabel>POS Layout</FieldLabel><div className="mt-2"><RadioGroup name="posLayout" value={draft.appearance.posLayout} options={[{ value: "compact", label: "Compact" }, { value: "comfortable", label: "Comfortable" }]} onChange={(value) => patchSection("appearance", { posLayout: value })} /></div></div>
            <div><FieldLabel>Default Language</FieldLabel><div className="mt-2"><RadioGroup name="defaultLanguage" value={draft.appearance.defaultLanguage} options={[{ value: "en", label: "English" }, { value: "km", label: "ភាសាខ្មែរ" }]} onChange={(value) => patchSection("appearance", { defaultLanguage: value })} /></div></div>
            <div><FieldLabel>Receipt Language</FieldLabel><div className="mt-2"><RadioGroup name="receiptLanguage" value={draft.appearance.receiptLanguage} options={[{ value: "en", label: "English" }, { value: "km", label: "Khmer" }]} onChange={(value) => patchSection("appearance", { receiptLanguage: value })} /></div></div>
            <div className="flex items-center gap-3"><button type="button" onClick={() => saveSection("appearance")} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">Save Appearance</button>{renderSaved("appearance")}</div>
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "printer" ? (
        <SectionCard>
          <div className="space-y-5">
            <div><FieldLabel>Printer Type</FieldLabel><div className="mt-2"><RadioGroup name="printerType" value={draft.printer.printerType} options={[{ value: "thermal-58", label: "Thermal 58mm" }, { value: "thermal-80", label: "Thermal 80mm" }, { value: "none", label: "None" }]} onChange={(value) => patchSection("printer", { printerType: value })} /></div></div>
            <div className="flex items-center justify-between gap-4"><FieldLabel>Auto-print after sale</FieldLabel><Toggle checked={draft.printer.autoPrintAfterSale} onChange={(value) => patchSection("printer", { autoPrintAfterSale: value })} /></div>
            <div><FieldLabel>Print receipt copies</FieldLabel><input type="number" min="1" max="3" value={draft.printer.receiptCopies} onChange={(event) => patchSection("printer", { receiptCopies: Math.min(3, Math.max(1, Number(event.target.value))) })} className="mt-2 w-36 rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-emerald-500" /></div>
            <p className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600">Actual printing will use the browser print dialog.</p>
            <div className="flex items-center gap-3"><button type="button" onClick={() => saveSection("printer")} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">Save Printer</button>{renderSaved("printer")}</div>
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "cashiers" ? (
        <SectionCard>
          <div className="space-y-5">
            <div className="space-y-3">
              {draft.cashiers.list.length ? draft.cashiers.list.map((cashier) => (
                <div key={cashier.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 p-4">
                  <div><p className="font-black">{cashier.name}</p><p className="text-sm font-semibold text-slate-500">PIN: {cashier.pinSet ? "set" : "not set"}</p></div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => {
                      const nextPin = window.prompt("Enter new 4-digit PIN", cashier.pin || "");
                      if (/^\d{4}$/.test(nextPin || "")) {
                        patchSection("cashiers", { list: draft.cashiers.list.map((entry) => entry.id === cashier.id ? { ...entry, pin: nextPin, pinSet: true } : entry) });
                      }
                    }} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black">Edit PIN</button>
                    <button type="button" onClick={() => patchSection("cashiers", { list: draft.cashiers.list.filter((entry) => entry.id !== cashier.id) })} className="rounded-xl bg-red-50 px-3 py-2 text-sm font-black text-red-700">Remove</button>
                  </div>
                </div>
              )) : <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-500">No cashiers added yet.</div>}
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_auto]">
              <input value={newCashierName} onChange={(event) => setNewCashierName(event.target.value)} placeholder="Cashier name" className="rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-emerald-500" />
              <input value={newCashierPin} onChange={(event) => setNewCashierPin(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="4-digit PIN" className="rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-emerald-500" />
              <button type="button" onClick={addCashier} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white">Add Cashier</button>
            </div>
            <div>
              <FieldLabel>Manager PIN</FieldLabel>
              <input value={draft.cashiers.managerPin} onChange={(event) => patchSection("cashiers", { managerPin: event.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="4-digit PIN" className="mt-2 w-48 rounded-2xl border border-slate-200 px-4 py-3 font-bold outline-none focus:border-emerald-500" />
            </div>
            <div className="flex items-center gap-3"><button type="button" onClick={() => saveSection("cashiers")} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">Save Cashiers</button>{renderSaved("cashiers")}</div>
          </div>
        </SectionCard>
      ) : null}

      {activeTab === "syncLogs" ? (
        <SectionCard>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black">Recent Sync Activity</h2>
              <button 
                type="button" 
                onClick={() => getSyncLogs().then(setSyncLogs)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-200"
              >
                Refresh Logs
              </button>
            </div>
            
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.1em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-bold">Time</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                    <th className="px-4 py-3 font-bold">Endpoint</th>
                    <th className="px-4 py-3 font-bold">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {syncLogs.map((log) => (
                    <tr key={log.id} className="bg-white hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-600">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-black ${
                          log.status === "success" 
                            ? "bg-emerald-100 text-emerald-800" 
                            : "bg-red-100 text-red-800"
                        }`}>
                          {log.status === "success" ? "Success" : "Failed"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700 truncate max-w-[200px]" title={log.url}>
                        {new URL(log.url, window.location.origin).pathname}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {log.error || "-"}
                      </td>
                    </tr>
                  ))}
                  {syncLogs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm font-bold text-slate-500">
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
