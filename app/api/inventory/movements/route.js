import { fail, handleRouteError, ok } from "@/lib/api-response";
import { requireAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request) {
  try {
    const admin = await requireAdminUser();

    if (!admin) {
      return fail("Admin access required.", 403);
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 25), 1), 100);

    const movements = await prisma.inventoryMovement.findMany({
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        variant: {
          include: {
            product: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

return ok({
      data: movements.map((movement) => ({
        id: movement.id,
        variantId: movement.variantId,
        productName: movement.variant?.product?.name || movement.variant?.name || "Unknown product",
        sku: movement.variant?.sku || movement.variantId,
        type: movement.type.toLowerCase(),
        channel: movement.channel?.toLowerCase() || "",
        // New field names (DB schema)
        quantityBefore: movement.quantityBefore,
        quantityChange: movement.quantityChange,
        quantityAfter: movement.quantityAfter,
        // Legacy field names for backward compatibility with admin UI
        quantity: movement.quantityChange,
        previousStock: movement.quantityBefore,
        nextStock: movement.quantityAfter,
        note: movement.note || "",
        createdAt: movement.createdAt,
      })),
    });
  } catch (error) {
    return handleRouteError(error, "Unable to load inventory movements.");
  }
}
