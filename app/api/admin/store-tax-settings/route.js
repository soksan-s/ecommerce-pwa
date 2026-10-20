import { fail, handleRouteError, ok } from "@/lib/api-response";
import { requireAdminUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/business-events";
import { prisma } from "@/lib/prisma";

const KEY = "pos-settings";

export async function GET() {
  try {
    await requireAdminUser();
    const setting = await prisma.setting.findUnique({ where: { key: KEY } });
    const tax = setting?.value?.tax || {};
    return ok({ data: { enabled: tax.enabled !== false, taxName: tax.taxName || "VAT", taxRate: Number(tax.taxRate ?? 10), taxType: tax.taxType || "exclusive" } });
  } catch (error) {
    return handleRouteError(error, "Unable to load tax settings.");
  }
}

export async function PATCH(request) {
  try {
    const user = await requireAdminUser();
    const body = await request.json();
    const taxName = String(body.taxName || "").trim();
    const taxRate = Number(body.taxRate);
    const taxType = String(body.taxType || "").toLowerCase();
    if (taxName.length < 2 || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100 || !["inclusive", "exclusive"].includes(taxType) || typeof body.enabled !== "boolean") {
      return fail("Enter a tax name, a rate from 0 to 100, a valid tax type, and enabled status.", 422);
    }
    const saved = await prisma.$transaction(async (tx) => {
      const existing = await tx.setting.findUnique({ where: { key: KEY } });
      const nextValue = { ...(existing?.value || {}), tax: { ...(existing?.value?.tax || {}), enabled: body.enabled, taxName, taxRate, taxType } };
      const setting = await tx.setting.upsert({ where: { key: KEY }, update: { value: nextValue }, create: { key: KEY, value: nextValue } });
      await createAuditLog(tx, { userId: user.id, action: existing ? "UPDATE" : "CREATE", module: "settings", recordId: setting.id, oldValue: existing?.value || null, newValue: nextValue });
      return setting;
    });
    return ok({ data: saved.value.tax });
  } catch (error) {
    return handleRouteError(error, "Unable to save tax settings.");
  }
}
