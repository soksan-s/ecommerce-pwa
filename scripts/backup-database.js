import dotenv from "dotenv";
import { spawn } from "node:child_process";
import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: [path.join(projectRoot, ".env.local"), path.join(projectRoot, ".env")] });
const backupDirectory = path.resolve(projectRoot, process.env.DB_BACKUP_DIR || "backups");
const retentionDays = Number.parseInt(process.env.DB_BACKUP_RETENTION_DAYS || "14", 10);
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

function fail(message) {
  console.error(`Database backup failed: ${message}`);
  process.exitCode = 1;
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(command)} exited with code ${code}${stderr ? `: ${stderr.trim()}` : ""}`));
    });
  });
}

function connectionEnvironment(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("DIRECT_URL or DATABASE_URL is not a valid PostgreSQL connection URL.");
  }

  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("The configured database URL must use PostgreSQL.");
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!url.hostname || !database || !url.username) {
    throw new Error("The database URL must include a host, database name, and username.");
  }

  const env = { ...process.env };
  env.PGHOST = url.hostname;
  env.PGPORT = url.port || "5432";
  env.PGDATABASE = database;
  env.PGUSER = decodeURIComponent(url.username);
  if (url.password) env.PGPASSWORD = decodeURIComponent(url.password);

  const sslMode = url.searchParams.get("sslmode");
  if (sslMode) env.PGSSLMODE = sslMode;
  for (const [parameter, variable] of [
    ["sslrootcert", "PGSSLROOTCERT"],
    ["sslcert", "PGSSLCERT"],
    ["sslkey", "PGSSLKEY"],
  ]) {
    const value = url.searchParams.get(parameter);
    if (value) env[variable] = value;
  }
  return env;
}

async function pruneOldBackups(now) {
  const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
  const files = await readdir(backupDirectory, { withFileTypes: true });
  for (const entry of files) {
    if (!entry.isFile() || !/^database-\d{8}T\d{6}Z\.dump$/.test(entry.name)) continue;
    const fullPath = path.join(backupDirectory, entry.name);
    const details = await stat(fullPath);
    if (details.mtimeMs < cutoff) await rm(fullPath);
  }
}

async function main() {
  if (!connectionString) throw new Error("Set DIRECT_URL or DATABASE_URL in the environment or .env file.");
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) {
    throw new Error("DB_BACKUP_RETENTION_DAYS must be a whole number from 1 to 3650.");
  }

  const env = connectionEnvironment(connectionString);
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const filename = `database-${stamp}.dump`;
  const finalPath = path.join(backupDirectory, filename);
  const temporaryPath = `${finalPath}.partial`;
  const pgDump = process.env.PG_DUMP_PATH || "pg_dump";
  const pgRestore = process.env.PG_RESTORE_PATH || "pg_restore";

  await mkdir(backupDirectory, { recursive: true });
  try {
    console.log(`Creating PostgreSQL backup: ${filename}`);
    await run(pgDump, ["--format=custom", "--no-owner", "--no-privileges", "--no-password", `--file=${temporaryPath}`], env);
    await run(pgRestore, ["--list", temporaryPath], env);
    await rename(temporaryPath, finalPath);
    await pruneOldBackups(now.getTime());
    const details = await stat(finalPath);
    console.log(`Backup saved and verified: ${finalPath} (${details.size.toLocaleString()} bytes)`);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

main().catch((error) => fail(error.message));
