import { fail, handleRouteError, ok } from "@/lib/api-response";
import { canAccessPOS, getCurrentUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/business-events";
import { prisma } from "@/lib/prisma";

const POS_SETTINGS_KEY = "pos-settings";

/**
 * GET /api/pos/cashiers
 * Returns the cashiers section from the stored POS settings.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user || !canAccessPOS(user.role)) {
      return fail("POS access required.", 403);
    }

    const setting = await prisma.setting.findUnique({
      where: { key: POS_SETTINGS_KEY },
    });

    const cashiers = setting?.value?.cashiers ?? { list: [], managerPin: "" };

    return ok({ data: cashiers });
  } catch (error) {
    return handleRouteError(error, "Unable to load cashiers.");
  }
}

/**
 * POST /api/pos/cashiers
 * Merges the submitted cashiers payload into the shared POS settings record.
 * Body shape: { list: CashierEntry[], managerPin: string }
 */
export async function POST(request) {
  try {
    const user = await getCurrentUser();

    if (!user || !canAccessPOS(user.role)) {
      return fail("POS access required.", 403);
    }

    const body = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return fail("Invalid cashiers payload.", 422);
    }

    const saved = await prisma.$transaction(async (tx) => {
      const existing = await tx.setting.findUnique({
        where: { key: POS_SETTINGS_KEY },
      });

      const currentValue = existing?.value ?? {};
      const nextValue = {
        ...currentValue,
        cashiers: {
          ...(currentValue.cashiers ?? {}),
          ...body,
        },
      };

      const setting = await tx.setting.upsert({
        where: { key: POS_SETTINGS_KEY },
        update: { value: nextValue },
        create: { key: POS_SETTINGS_KEY, value: nextValue },
      });

      await createAuditLog(tx, {
        userId: user.id,
        action: existing ? "UPDATE" : "CREATE",
        module: "settings",
        recordId: setting.id,
        oldValue: existing?.value ?? null,
        newValue: nextValue,
      });

      return setting;
    });

    return ok({ data: saved.value?.cashiers });
  } catch (error) {
    return handleRouteError(error, "Unable to save cashiers.");
  }
}
