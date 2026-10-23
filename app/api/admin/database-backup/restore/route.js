import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/server/auth/auth";
import { restoreDatabaseDump } from "@/lib/server/database-backup";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.startsWith("application/octet-stream")) {
      return NextResponse.json({ error: "Expected a decrypted PostgreSQL archive." }, { status: 415 });
    }
    const dump = Buffer.from(await request.arrayBuffer());
    if (!dump.length) return NextResponse.json({ error: "The backup file is empty." }, { status: 400 });
    await restoreDatabaseDump(dump);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin database restore failed:", error);
    const missingTool = error?.code === "ENOENT" || /spawn .* ENOENT/i.test(error?.message || "");
    const message = error.message === "DIRECT_URL or DATABASE_URL is required."
      ? "The server is missing its application database connection setting."
      : missingTool
        ? "PostgreSQL restore tools are missing on the application server. Install pg_restore or configure PG_RESTORE_PATH."
        : "Could not restore the backup into the live database. Check the database connection, permissions, and server logs.";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
