# PostgreSQL backups

This project uses PostgreSQL through Prisma. `npm run db:backup` creates a compressed PostgreSQL custom-format archive of the database and checks that PostgreSQL can read its archive index before keeping it. Successful files are named `database-YYYYMMDDTHHMMSSZ.dump`. The last 14 days are retained by default; older files with this naming pattern are removed after a successful backup.

## Run a backup manually

1. Install the PostgreSQL command-line tools (`pg_dump` and `pg_restore`). Use a client version at least as new as the database server. If Windows cannot find them on `PATH`, set `PG_DUMP_PATH` and `PG_RESTORE_PATH` to their full executable paths.
2. Confirm `.env` has `DIRECT_URL` or `DATABASE_URL` for the PostgreSQL database. `DIRECT_URL` is preferred because hosted Prisma applications often use a pooled `DATABASE_URL`; the backup should use the provider's direct connection URL.
3. Run `npm run db:backup` from the project directory. The default output folder is `backups/`, which is ignored by Git. You can set `DB_BACKUP_DIR` to a different folder and `DB_BACKUP_RETENTION_DAYS` to a value from 1 through 3650.

The backup contains customer contact details, orders, and password hashes. Store it with access controls and encryption at rest. Keep a copy on a different machine or backup service; a copy on the same disk does not protect against disk loss. Never commit a dump to Git or send it in chat.

## Schedule it on Windows

Use Windows Task Scheduler to run `npm run db:backup` daily. Set **Start in** to the project directory and set the task to run under an account that can read the environment file and write to the backup folder. Choose a backup folder on a protected drive. Check Task Scheduler's Last Run Result and confirm a new `.dump` appears. For a hosted Vercel deployment, the app's function disk is temporary, so run this script on a persistent machine or CI runner with the production direct database URL, and write the output to durable off-site storage. Do not schedule a database dump in a Vercel function: functions have execution duration limits and do not provide persistent local storage.

## Restore

Restore into a new, empty database first so you can verify the backup without overwriting production. Configure the PostgreSQL client environment for the target database, then run:

```powershell
pg_restore --no-owner --no-privileges --dbname="$env:RESTORE_DATABASE_URL" .\backups\database-YYYYMMDDTHHMMSSZ.dump
```

If the provider's URL uses a connection pooler, use its direct URL for restore. Review the PostgreSQL server logs and verify the app against the restored database before considering a production recovery. A database dump does not back up product image files hosted by Cloudinary or credentials and environment variables; those need separate recovery plans.

## Use the admin/POS backup button

The admin/POS backup button creates an encrypted `.dump.enc` file on the selected computer. Choose a folder and password once; after setup, the browser attempts one backup per day when the app is opened. To restore, choose that `.dump.enc` file, enter its password, then confirm the overwrite prompt. The user must be signed in as `ADMIN` or `SUPER_ADMIN`; automatic folder access requires a browser that supports the File System Access API (Chrome or Edge over HTTPS).

The browser decrypts the file locally and uploads the archive to the app server. The server restores it into the live application database identified by `DIRECT_URL` (preferred) or `DATABASE_URL`. The server needs `pg_restore` (or `PG_RESTORE_PATH`), network access, and a database role with permission to drop and recreate the archived objects; use a direct database connection rather than a transaction pooler. The restore replaces objects included in the archive, so live records changed since the backup may be lost. The UI requires typing `OVERWRITE LIVE DATABASE` before it sends the restore request. Configure database URLs only in the server environment, never in browser code or a public `NEXT_PUBLIC_` variable.

The application server also needs `pg_dump` to create backups. The admin's computer does not need PostgreSQL tools. Install PostgreSQL client tools on the machine running the Next.js server; their version should be at least as new as the database server. On Windows, add them to `PATH` or set `PG_DUMP_PATH` and `PG_RESTORE_PATH`. Each computer running the app needs its own private environment configuration because `.env*` files are ignored by Git. Never share database credentials in the repository. The browser's selected backup folder and saved encryption key live in that browser profile; another computer can restore a copied `.dump.enc` file by entering its password, but it does not inherit the first computer's folder or settings.

The operation uses `pg_restore --clean --if-exists --single-transaction`; a failed restore rolls back. Keep a separate backup before recovering, because this action replaces live database objects from the selected archive. The encrypted backup format starts with `POSDBBK1`, followed by the KDF iteration count, salt, IV, authentication tag, and ciphertext. Keep the password; the project does not store it or provide a way to recover it.

## What public Cambodian shop information tells us

Popular Cambodian shopping sites such as [Smile Shop](https://www.smileshop.com.kh/) describe their ecommerce service and customer trust features publicly. Public-facing pages and policies do not establish their internal backup frequency or storage design, so this project uses documented PostgreSQL backup practices instead of guessing at a competitor's infrastructure. Cambodia's Ministry of Commerce ecommerce strategy also discusses backup and disaster-recovery considerations in the broader digital infrastructure context.

The backup archive uses PostgreSQL's custom format, which is compressed and can be inspected or restored with `pg_restore`. See the [PostgreSQL `pg_dump` documentation](https://www.postgresql.org/docs/current/app-pgdump.html) and [PostgreSQL `pg_restore` documentation](https://www.postgresql.org/docs/current/app-pgrestore.html). Vercel documents Cron as a way to trigger functions, but function duration limits apply and function filesystems are not a durable backup destination; see its [Cron documentation](https://vercel.com/docs/cron-jobs) and [function duration limits](https://vercel.com/docs/functions/configuring-functions/duration).
