"use client";

import { useEffect, useState } from "react";

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

export default function DatabaseBackupButton() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [directoryHandle, setDirectoryHandle] = useState(null);
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

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
    <div className="p-2">
      <button
        type="button"
        onClick={() => {
          setMessage("");
          setOpen(true);
        }}
        className="w-full rounded-lg border border-[var(--border-soft)] px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--surface-quiet)]"
      >
        {configured ? "Backup settings" : "Set up automatic backup"}
      </button>
      {message && <p role="status" className="mt-2 break-words text-xs">{message}</p>}

      {open ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4">
          <form onSubmit={enableAutomaticBackup} className="w-full max-w-md space-y-4 rounded-xl bg-[var(--surface-strong)] p-5 text-[var(--foreground)] shadow-xl">
            <div>
              <h2 className="text-lg font-bold">Automatic database backup</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">Choose a folder and a password of at least 12 characters. This PC will save an encrypted backup when the app opens, at most once per day.</p>
            </div>

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
              <span className="mt-1 block text-xs font-normal text-[var(--muted-foreground)]">Keep this password safe; you need it to decrypt the backup.</span>
            </label>

            <button type="button" onClick={chooseFolder} className="w-full rounded-lg border border-[var(--border-soft)] px-3 py-2 text-sm font-semibold">
              {directoryHandle ? `Folder: ${directoryHandle.name}` : "Choose backup folder"}
            </button>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={busy} className="rounded-lg bg-[var(--action)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {busy ? "Saving backup..." : "Save and back up now"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
