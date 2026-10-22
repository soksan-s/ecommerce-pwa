import dotenv from "dotenv";
import { spawn } from "node:child_process";
import {
  createCipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

dotenv.config({
  path: [
    path.join(projectRoot, ".env.local"),
    path.join(projectRoot, ".env"),
  ],
});

const backupDirectory = path.resolve(
  projectRoot,
  process.env.DB_BACKUP_DIR || "backups",
);
const retentionDays = Number.parseInt(
  process.env.DB_BACKUP_RETENTION_DAYS || "14",
  10,
);
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
const encryptionPassword = process.env.DB_BACKUP_ENCRYPTION_PASSWORD;

const MAGIC = Buffer.from("POSDBBK1");
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const KDF_ITERATIONS = 600_000;

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else {
        reject(
          new Error(
            `${path.basename(command)} exited with code ${code}${
              stderr ? `: ${stderr.trim()}` : ""
            }`,
          ),
        );
      }
    });
  });
}

function connectionEnvironment(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(
      "DIRECT_URL or DATABASE_URL is not a valid PostgreSQL connection URL.",
    );
  }

  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("The database URL must use PostgreSQL.");
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!url.hostname || !database || !url.username) {
    throw new Error(
      "The database URL must include a host, database name, and username.",
    );
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
    if (
      !entry.isFile() ||
      !/^database-\d{8}T\d{6}Z\.dump\.enc$/.test(entry.name)
    ) {
      continue;
    }

    const filename = path.join(backupDirectory, entry.name);
    const details = await stat(filename);
    if (details.mtimeMs < cutoff) await rm(filename);
  }
}

async function main() {
  if (!connectionString) {
    throw new Error("Set DIRECT_URL or DATABASE_URL in .env.");
  }
  if (!encryptionPassword || encryptionPassword.length < 12) {
    throw new Error(
      "Set DB_BACKUP_ENCRYPTION_PASSWORD to a strong secret of at least 12 characters.",
    );
  }
  if (!Number.isInteger(retentionDays) || retentionDays < 1) {
    throw new Error("DB_BACKUP_RETENTION_DAYS must be at least 1.");
  }

  const now = new Date();
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const name = `database-${stamp}.dump`;
  const plainPath = path.join(backupDirectory, `${name}.partial`);
  const encryptedPath = path.join(backupDirectory, `${name}.enc`);
  const encryptedTempPath = `${encryptedPath}.partial`;

  await mkdir(backupDirectory, { recursive: true });

  try {
    const env = connectionEnvironment(connectionString);
    const pgDump = process.env.PG_DUMP_PATH || "pg_dump";
    const pgRestore = process.env.PG_RESTORE_PATH || "pg_restore";

    console.log(`Creating PostgreSQL archive: ${name}`);
    await run(
      pgDump,
      [
        "--format=custom",
        "--no-owner",
        "--no-privileges",
        "--no-password",
        `--file=${plainPath}`,
      ],
      env,
    );

    await run(pgRestore, ["--list", plainPath], env);

    const plaintext = await readFile(plainPath);
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);
    const key = await new Promise((resolve, reject) => {
      import("node:crypto")
        .then(({ pbkdf2 }) =>
          pbkdf2(
            encryptionPassword,
            salt,
            KDF_ITERATIONS,
            KEY_LENGTH,
            "sha256",
            (error, derivedKey) =>
              error ? reject(error) : resolve(derivedKey),
          ),
        )
        .catch(reject);
    });

    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    const header = Buffer.alloc(4);
    header.writeUInt32BE(KDF_ITERATIONS);

    const encrypted = Buffer.concat([
      MAGIC,
      header,
      salt,
      iv,
      tag,
      ciphertext,
    ]);

    await writeFile(encryptedTempPath, encrypted, { flag: "wx" });
    await rename(encryptedTempPath, encryptedPath);
    await rm(plainPath, { force: true });
    await pruneOldBackups(now.getTime());

    console.log(`Encrypted backup saved: ${encryptedPath}`);
  } catch (error) {
    await rm(plainPath, { force: true });
    await rm(encryptedTempPath, { force: true });
    throw error;
  }
}

main().catch((error) => {
  console.error(`Encrypted database backup failed: ${error.message}`);
  process.exitCode = 1;
});