import { NextResponse } from "next/server";

import { fail, handleRouteError } from "@/lib/api-response";
import { canAccessPOS, getCurrentUser } from "@/lib/auth";
import { listCatalogProducts } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

export async function GET(request) {
  try {
    const user = await getCurrentUser({ suppressDatabaseErrors: true });

    if (!user || !canAccessPOS(user.role)) {
      return fail("POS access required.", 403);
    }

    const { searchParams } = new URL(request.url);
    const sinceParam = searchParams.get("since");
    const sinceDate = sinceParam ? new Date(sinceParam) : null;

    const catalogProducts = await listCatalogProducts();

    let filteredProducts = catalogProducts;
    if (sinceDate && !isNaN(sinceDate.getTime())) {
      filteredProducts = catalogProducts.filter((p) => {
        const updatedAt = p.updatedAt ? new Date(p.updatedAt) : null;
        return !updatedAt || updatedAt >= sinceDate;
      });
    }

    let branchId = user.branchId;
    if (!branchId) {
      const hq = await prisma.branch.findFirst({ where: { code: "HQ" } });
      branchId = hq?.id;
    }

    let inventory = [];
    if (branchId) {
      const invRecords = await prisma.inventory.findMany({
        where: { branchId },
        select: {
          variantId: true,
          quantity: true,
          availableQuantity: true,
          minStockLevel: true,
          variant: {
            select: { productId: true },
          },
        },
      });
      inventory = invRecords.map((i) => ({
        variantId: i.variantId,
        productId: i.variant.productId,
        quantity: Number(i.quantity),
        availableQuantity: Number(i.availableQuantity),
        minStockAlert: Number(i.minStockLevel || 5),
      }));
    }

    return NextResponse.json({
      data: {
        timestamp: new Date().toISOString(),
        isDelta: Boolean(sinceDate),
        products: filteredProducts,
        inventory,
      },
    });
  } catch (error) {
    return handleRouteError(error, "Unable to perform POS catalog sync.");
  }
}
