import { prisma } from "@/lib/prisma";

export async function GET(request) {
  const url = new URL(request.url);
  const phoneNumber = url.searchParams.get("phoneNumber") || "";

  if (!phoneNumber) {
    return new Response(JSON.stringify({ exists: false, error: "Missing phoneNumber" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Phone numbers are stored on User.phoneNumber in Prisma schema.
  // We use exact match here.
  const exists = await prisma.user
    .findUnique({
      where: { phoneNumber },
      select: { id: true },
    })
    .then((u) => Boolean(u));

  return new Response(JSON.stringify({ exists }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

