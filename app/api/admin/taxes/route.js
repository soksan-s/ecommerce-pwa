import { fail, handleRouteError, ok } from "@/lib/api-response";
import { requireAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAdminUser();
    const data = await prisma.tax.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
    return ok({ data: data.map((tax) => ({ ...tax, rate: Number(tax.rate) })) });
  } catch (error) {
    return handleRouteError(error, "Unable to load tax rules.");
  }
}

export async function POST(request) {
  try {
    await requireAdminUser();
    const body = await request.json();
    const name = String(body.name || "").trim();
    const rate = Number(body.rate);
    const type = String(body.type || "EXCLUSIVE").toUpperCase();
    if (name.length < 2 || !Number.isFinite(rate) || rate < 0 || rate > 100 || !["INCLUSIVE", "EXCLUSIVE"].includes(type)) {
      return fail("Enter a name, a rate between 0 and 100, and an inclusive or exclusive type.", 422);
    }
    const data = await prisma.tax.create({ data: { name, rate: rate / 100, type, isActive: true } });
    return ok({ data: { ...data, rate: Number(data.rate) } }, 201);
  } catch (error) {
    return handleRouteError(error, "Unable to create tax rule.");
  }
}
