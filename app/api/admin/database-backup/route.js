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
    return NextResponse.json(
      { error: "Could not create the database backup. Check server logs." },
      { status: 500 },
    );
  }
}
