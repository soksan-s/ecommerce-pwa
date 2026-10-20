import { ok } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const setting = await prisma.setting.findUnique({ where: { key: "pos-settings" } });
  const tax = setting?.value?.tax || {};
  return ok({
    data: {
      enabled: tax.enabled !== false,
      name: tax.taxName || "VAT",
      rate: Math.max(0, Number(tax.taxRate ?? 10)),
      type: String(tax.taxType || "exclusive").toLowerCase(),
    },
  });
}
