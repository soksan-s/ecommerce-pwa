"use client";

import { useEffect, useRef, useState } from "react";

const SETTINGS_DB = "ecommerce-local-backup";
const SETTINGS_STORE = "settings";
const SETTINGS_KEY = "automatic-database-backup";
const KDF_ITERATIONS = 600_000;

function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function openSettingsDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SETTINGS_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(SETTINGS_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readBackupSettings() {
  const db = await openSettingsDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(SETTINGS_STORE, "readonly").objectStore(SETTINGS_STORE).get(SETTINGS_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function saveBackupSettings(settings) {
  const db = await openSettingsDb();
  try {
    await new Promise((resolve, reject) => {
      const request = db.transaction(SETTINGS_STORE, "readwrite").objectStore(SETTINGS_STORE).put(settings, SETTINGS_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

async function deriveEncryptionKey(password, salt) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: KDF_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
}

async function createEncryptedFile(settings) {
  const response = await fetch("/api/admin/database-backup", {
    method: "POST",
    cache: "no-store",
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Sign in with an admin account to back up the database.");
    throw new Error("Could not read the database backup. Check the server and try again.");
  }

  const dump = await response.arrayBuffer();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = new Uint8Array(settings.salt);
  const encryptedWithTag = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv, tagLength: 128 }, settings.key, dump),
  );
  const ciphertext = encryptedWithTag.slice(0, -16);
  const tag = encryptedWithTag.slice(-16);
  const header = new Uint8Array(12);
  header.set(new TextEncoder().encode("POSDBBK1"), 0);
  new DataView(header.buffer).setUint32(8, KDF_ITERATIONS);

  const encryptedFile = new Blob([header, salt, iv, tag, ciphertext], {
    type: "application/octet-stream",
  });
  const stamp = new Date().toISOString().replace(/[-:.]/g, "");
  const file = await settings.directoryHandle.getFileHandle(`database-${stamp}.dump.enc`, { create: true });
  const writable = await file.createWritable();
  await writable.write(encryptedFile);
  await writable.close();

  settings.lastBackupDate = todayLocal();
  await saveBackupSettings(settings);
}

async function withBackupLock(callback) {
  if (navigator.locks?.request) {
    return navigator.locks.request("ecommerce-database-backup", { ifAvailable: true }, async (lock) => {
      if (lock) await callback();
    });
  }

  const lockKey = "ecommerce-database-backup-running";
  const existing = Number(localStorage.getItem(lockKey) || 0);
  if (Date.now() - existing < 30 * 60 * 1000) return;
  localStorage.setItem(lockKey, String(Date.now()));
  try {
    await callback();
  } finally {
    localStorage.removeItem(lockKey);
  }
}

export default function DatabaseBackupButton({ compact = false }) {
  const [open, setOpen] = useState(false);
  const [activeMode, setActiveMode] = useState("backup");
  const [password, setPassword] = useState("");
  const [restoreFile, setRestoreFile] = useState(null);
  const [directoryHandle, setDirectoryHandle] = useState(null);
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const restoreFileInput = useRef(null);

  useEffect(() => {
    let active = true;
    readBackupSettings()
      .then(async (settings) => {
        if (!active || !settings?.directoryHandle || !settings?.key) return;
        setConfigured(true);
        if (settings.lastBackupDate === todayLocal()) return;

        await withBackupLock(async () => {
          const permission = await settings.directoryHandle.queryPermission({ mode: "readwrite" });
          if (permission !== "granted") {
            if (active) setMessage("Allow backup folder access: click Backup settings and choose the folder again.");
            return;
          }
          await createEncryptedFile(settings);
          if (active) setMessage("Automatic encrypted backup saved for today.");
        });
      })
      .catch((error) => {
        if (active) setMessage(`Automatic backup failed: ${error.message || "check your connection"}`);
      });
    return () => {
      active = false;
    };
  }, []);

  async function chooseFolder() {
    setMessage("");
    try {
      if (!window.showDirectoryPicker) {
        throw new Error("Choose a backup folder using Chrome or Edge over HTTPS.");
      }
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      setDirectoryHandle(handle);
      setMessage(`Folder selected: ${handle.name}`);
    } catch (error) {
      if (error.name !== "AbortError") setMessage(error.message || "Could not select that folder.");
    }
  }

  async function restoreBackup(selectedFile = null) {
    setMessage("");
    if (!selectedFile) {
      setMessage("Choose an encrypted backup file first.");
      return;
    }
    setBusy(true);
    try {
      const bytes = new Uint8Array(await selectedFile.arrayBuffer());
      const headerLength = 12;
      const saltLength = 16;
      const ivLength = 12;
      const tagLength = 16;
      if (bytes.length < headerLength + saltLength + ivLength + tagLength ||
          new TextDecoder().decode(bytes.slice(0, 8)) !== "POSDBBK1") {
        throw new Error("This file is not a supported encrypted database backup.");
      }
      if (!password || password.length < 12) throw new Error("Enter the backup encryption password first.");
      const iterations = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(8);
      if (iterations !== KDF_ITERATIONS) throw new Error("Unsupported backup encryption settings.");
      const salt = bytes.slice(headerLength, headerLength + saltLength);
      const ivStart = headerLength + saltLength;
      const iv = bytes.slice(ivStart, ivStart + ivLength);
      const tagStart = ivStart + ivLength;
      const tag = bytes.slice(tagStart, tagStart + tagLength);
      const ciphertext = bytes.slice(tagStart + tagLength);
      const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
      const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations, hash: "SHA-256" }, material,
        { name: "AES-GCM", length: 256 }, false, ["decrypt"],
      );
      const encryptedWithTag = new Uint8Array(ciphertext.length + tag.length);
      encryptedWithTag.set(ciphertext);
      encryptedWithTag.set(tag, ciphertext.length);
      let dump;
      try {
        dump = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, encryptedWithTag);
      } catch {
        throw new Error("The backup password is incorrect or the backup file is damaged.");
      }
      const confirmation = window.prompt("This will REPLACE DATA in the live application database with this backup. Current data changed since the backup may be lost. Type OVERWRITE LIVE DATABASE to continue.");
      if (confirmation !== "OVERWRITE LIVE DATABASE") return;
      const response = await fetch("/api/admin/database-backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: dump,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Restore failed. Check the server logs.");
      setMessage("Backup restored successfully. The live database now contains the selected backup.");
    } catch (error) {
      if (error.name !== "AbortError") setMessage(error.message || "Could not restore this backup.");
    } finally {
      setBusy(false);
    }
  }

  async function enableAutomaticBackup(event) {
    event.preventDefault();
    setMessage("");
    if (password.length < 12) {
      setMessage("Use an encryption password with at least 12 characters.");
      return;
    }
    if (!directoryHandle) {
      setMessage("Choose the folder where backups should be saved.");
      return;
    }

    setBusy(true);
    try {
      const permission = await directoryHandle.requestPermission({ mode: "readwrite" });
      if (permission !== "granted") throw new Error("Allow access to the selected backup folder.");

      const salt = crypto.getRandomValues(new Uint8Array(16));
      const key = await deriveEncryptionKey(password, salt);
      const settings = { key, salt: Array.from(salt), directoryHandle, lastBackupDate: null };
      await saveBackupSettings(settings);
      await createEncryptedFile(settings);
      setConfigured(true);
      setPassword("");
      setMessage("Encrypted backup saved. Automatic backups are enabled on this PC.");
      setOpen(false);
    } catch (error) {
      setMessage(error.message || "Backup setup failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compact ? "p-2" : "min-w-0 p-2"}>
      <button
        type="button"
        onClick={() => {
          setMessage("");
          setActiveMode("backup");
          setOpen(true);
        }}
        aria-label={configured ? "Backup settings" : "Set up automatic backup"}
        title={compact ? (configured ? "Backup settings" : "Set up automatic backup") : undefined}
        className={`flex min-h-10 w-full min-w-0 items-center rounded-lg border border-[var(--border-soft)] px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-quiet)] ${compact ? "justify-center px-2" : "text-left"}`}
      >
        {compact ? (
          <span aria-hidden="true" className="text-base leading-none">{configured ? "✓" : "↓"}</span>
        ) : (
          <span className="block min-w-0 break-words">{configured ? "Backup settings" : "Set up automatic backup"}</span>
        )}
      </button>
      {!open && message && <p role="status" className="mt-2 break-words text-xs">{message}</p>}

      {open ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4">
          <form onSubmit={enableAutomaticBackup} className="max-h-[calc(100vh-2rem)] w-full max-w-md space-y-4 overflow-y-auto rounded-xl bg-[var(--surface-strong)] p-5 text-[var(--foreground)] shadow-xl">
            <div>
              <h2 className="text-lg font-bold">Database backup</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">Save a secure copy or recover from an existing backup.</p>
            </div>

            <div role="tablist" aria-label="Database backup actions" className="grid grid-cols-2 rounded-xl bg-[var(--surface-quiet)] p-1">
              {[
                ["backup", "Backup"],
                ["restore", "Restore"],
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={activeMode === mode}
                  onClick={() => {
                    setActiveMode(mode);
                    setMessage("");
                  }}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${activeMode === mode ? "bg-[var(--surface-strong)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {message && <p role="status" aria-live="polite" className="break-words rounded-lg bg-[var(--surface-quiet)] px-3 py-2 text-sm">{message}</p>}

            {activeMode === "backup" ? (
              <div className="space-y-4">
                <p className="text-sm text-[var(--muted-foreground)]">Create an encrypted backup in a folder on this computer. Automatic backups run when the app opens, at most once per day.</p>
                <label className="block text-sm font-medium">
                  Encryption password
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="app-input mt-1 w-full px-3 py-2"
                  />
                  <span className="mt-1 block text-xs font-normal text-[var(--muted-foreground)]">Use at least 12 characters and keep the password safe.</span>
                </label>
                <button type="button" onClick={chooseFolder} className="w-full rounded-lg border border-[var(--border-soft)] px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-quiet)]">
                  {directoryHandle ? `Backup folder: ${directoryHandle.name}` : "Choose backup folder"}
                </button>
                <button type="submit" disabled={busy} className="w-full rounded-lg bg-[var(--action)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  {busy ? "Saving backup…" : "Save encrypted backup"}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-[var(--muted-foreground)]">Choose or drop an encrypted backup file, then enter its password.</p>
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-[var(--foreground)]">
                  Restoring replaces live database objects from the backup. Changes made since that backup may be lost.
                </div>
                <input
                  ref={restoreFileInput}
                  type="file"
                  accept=".enc,application/octet-stream"
                  className="hidden"
                  onChange={(event) => setRestoreFile(event.target.files?.[0] || null)}
                />
                <button type="button" onClick={() => {
                  if (restoreFileInput.current) restoreFileInput.current.value = "";
                  restoreFileInput.current?.click();
                }} className="w-full rounded-lg border border-[var(--border-soft)] px-3 py-2 text-sm font-semibold hover:bg-[var(--surface-quiet)]">
                  {restoreFile ? "Choose a different backup file" : "Choose encrypted backup file"}
                </button>
                <div
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    setRestoreFile(event.dataTransfer.files?.[0] || null);
                  }}
                  className="rounded-lg border border-dashed border-[var(--border-soft)] px-3 py-5 text-center text-sm text-[var(--muted-foreground)]"
                >
                  {restoreFile ? <span className="break-all font-medium text-[var(--foreground)]">{restoreFile.name}</span> : "Or drag a .dump.enc file here"}
                </div>
                <label className="block text-sm font-medium">
                  Backup password
                  <input
                    type="password"
                    autoComplete="current-password"
                    minLength={12}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="app-input mt-1 w-full px-3 py-2"
                  />
                </label>
                <button type="button" onClick={() => restoreBackup(restoreFile)} disabled={busy || !restoreFile || password.length < 12} className="w-full rounded-lg bg-[var(--action)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  {busy ? "Restoring database…" : "Restore live database"}
                </button>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm">Cancel</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
