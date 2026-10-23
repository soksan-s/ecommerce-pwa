import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/server/auth/auth";
import { createDatabaseDump } from "@/lib/server/database-backup";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const file = await createDatabaseDump();

    return new Response(file, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": 'attachment; filename="database.dump"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Admin database backup failed:", error);
    const missingTool = error?.code === "ENOENT" || /spawn .* ENOENT/i.test(error?.message || "");
    return NextResponse.json(
      { error: missingTool
        ? "PostgreSQL backup tools are missing on the application server. Install pg_dump and pg_restore or configure PG_DUMP_PATH and PG_RESTORE_PATH."
        : "Could not create the database backup. Check the server database connection and logs." },
      { status: 500 },
    );
  }
}
