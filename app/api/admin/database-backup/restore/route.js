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
    const message = error.message === "DIRECT_URL or DATABASE_URL is required."
      ? "The server is missing its application database connection setting."
      : "Could not restore the backup into the live database. Check server logs and confirm PostgreSQL is reachable.";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
