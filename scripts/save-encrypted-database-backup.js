import dotenv from "dotenv";
import { createEncryptedDatabaseBackup } from "../lib/server/database-backup.js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({
  path: [path.join(root, ".env.local"), path.join(root, ".env")],
});

const directory = path.resolve(root, process.env.DB_BACKUP_DIR || "backups");
await mkdir(directory, { recursive: true });

const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const filename = `database-${stamp}.dump.enc`;
const data = await createEncryptedDatabaseBackup();
await writeFile(path.join(directory, filename), data, { flag: "wx" });

console.log(`Saved ${path.join(directory, filename)}`);