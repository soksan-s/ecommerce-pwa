import { spawn } from "node:child_process";
import {
  createCipheriv,
  pbkdf2 as pbkdf2Callback,
  randomBytes,
} from "node:crypto";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const pbkdf2 = promisify(pbkdf2Callback);

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    });

    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(command)} failed: ${stderr.trim()}`));
    });
  });
}

function postgresEnvironment(rawUrl) {
  const url = new URL(rawUrl);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("Database URL must use PostgreSQL.");
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!url.hostname || !database || !url.username) {
    throw new Error("Database URL is missing its host, database, or username.");
  }

  const env = { ...process.env };
  env.PGHOST = url.hostname;
  env.PGPORT = url.port || "5432";
  env.PGDATABASE = database;
  env.PGUSER = decodeURIComponent(url.username);
  env.PGPASSWORD = decodeURIComponent(url.password || "");

  for (const [parameter, variable] of [
    ["sslmode", "PGSSLMODE"],
    ["sslrootcert", "PGSSLROOTCERT"],
    ["sslcert", "PGSSLCERT"],
    ["sslkey", "PGSSLKEY"],
  ]) {
    const value = url.searchParams.get(parameter);
    if (value) env[variable] = value;
  }

  return env;
}

export async function createDatabaseDump() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL is required.");

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "db-backup-"));
  const dumpPath = path.join(tempDir, "database.dump");

  try {
    const env = postgresEnvironment(connectionString);
    await run(
      process.env.PG_DUMP_PATH || "pg_dump",
      [
        "--format=custom",
        "--no-owner",
        "--no-privileges",
        "--no-password",
        `--file=${dumpPath}`,
      ],
      env,
    );
    await run(process.env.PG_RESTORE_PATH || "pg_restore", ["--list", dumpPath], env);
    return await readFile(dumpPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function createEncryptedDatabaseBackup() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const password = process.env.DB_BACKUP_ENCRYPTION_PASSWORD;

  if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL is required.");
  if (!password || password.length < 12) {
    throw new Error("Set DB_BACKUP_ENCRYPTION_PASSWORD to at least 12 characters.");
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "db-backup-"));
  const dumpPath = path.join(tempDir, "database.dump");

  try {
    const env = postgresEnvironment(connectionString);
    await run(
      process.env.PG_DUMP_PATH || "pg_dump",
      [
        "--format=custom",
        "--no-owner",
        "--no-privileges",
        "--no-password",
        `--file=${dumpPath}`,
      ],
      env,
    );
    await run(
      process.env.PG_RESTORE_PATH || "pg_restore",
      ["--list", dumpPath],
      env,
    );

    const plaintext = await readFile(dumpPath);
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const iterations = 600_000;
    const key = await pbkdf2(password, salt, iterations, 32, "sha256");

    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    const header = Buffer.alloc(4);
    header.writeUInt32BE(iterations);

    return Buffer.concat([
      Buffer.from("POSDBBK1"),
      header,
      salt,
      iv,
      tag,
      ciphertext,
    ]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function restoreDatabaseDump(dumpBytes) {
  const targetUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!targetUrl) throw new Error("DIRECT_URL or DATABASE_URL is required.");

  const target = new URL(targetUrl);
  if (!["postgres:", "postgresql:"].includes(target.protocol)) throw new Error("Application database URL must use PostgreSQL.");

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "db-restore-"));
  const dumpPath = path.join(tempDir, "database.dump");
  try {
    await writeFile(dumpPath, dumpBytes, { flag: "wx" });
    await run(process.env.PG_RESTORE_PATH || "pg_restore", ["--list", dumpPath], process.env);

    const env = { ...process.env };
    env.PGHOST = target.hostname;
    env.PGPORT = target.port || "5432";
    env.PGDATABASE = decodeURIComponent(target.pathname.replace(/^\//, ""));
    env.PGUSER = decodeURIComponent(target.username);
    env.PGPASSWORD = decodeURIComponent(target.password || "");
    for (const [parameter, variable] of [
      ["sslmode", "PGSSLMODE"], ["sslrootcert", "PGSSLROOTCERT"],
      ["sslcert", "PGSSLCERT"], ["sslkey", "PGSSLKEY"],
    ]) {
      const value = target.searchParams.get(parameter);
      if (value) env[variable] = value;
    }
    await run(process.env.PG_RESTORE_PATH || "pg_restore", [
      "--dbname", env.PGDATABASE,
      "--no-owner", "--no-privileges", "--clean", "--if-exists", "--exit-on-error", "--single-transaction",
      dumpPath,
    ], env);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
