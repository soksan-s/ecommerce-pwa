import { NextResponse } from "next/server";
import { fail, handleRouteError, ok } from "@/lib/api-response";
import { createAuditLog, createInventoryMovement } from "@/lib/business-events";
import { requireAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request) {
  try {
    const admin = await requireAdminUser();
    if (!admin) {
      return fail("Admin access required.", 403);
    }

    const body = await request.json();
    const productId = body.productId;
    const variantId = body.variantId || null;
    const action = String(body.action || "").toUpperCase(); // "STOCK_IN", "ADJUSTMENT_INCREASE", "ADJUSTMENT_DECREASE"
    const quantity = Number(body.quantity || 0);
    const reason = String(body.reason || "").trim();

    if (!productId) {
      return fail("Product ID is required.", 422);
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return fail("Quantity must be a positive whole number.", 422);
    }

    if (!["STOCK_IN", "ADJUSTMENT_INCREASE", "ADJUSTMENT_DECREASE"].includes(action)) {
      return fail("Invalid action. Must be STOCK_IN, ADJUSTMENT_INCREASE, or ADJUSTMENT_DECREASE.", 422);
    }

    if ((action === "ADJUSTMENT_INCREASE" || action === "ADJUSTMENT_DECREASE") && !reason) {
      return fail("A reason is required for stock adjustments.", 422);
    }

    const updatedProduct = await prisma.$transaction(async (tx) => {
      const existingProduct = await tx.product.findUnique({
        where: { id: productId },
        include: {
          variants: true,
        },
      });

      if (!existingProduct) {
        throw Object.assign(new Error("PRODUCT_NOT_FOUND"), { code: "P2025" });
      }

      // Resolve variant
      let targetVariant = null;
      if (variantId) {
        targetVariant = existingProduct.variants.find((v) => v.id === variantId);
      } else if (existingProduct.variants && existingProduct.variants.length > 0) {
        targetVariant = existingProduct.variants.find((v) => v.isActive !== false) || existingProduct.variants[0];
      }

      const previousProductStock = Number(existingProduct.stock || 0);
      let nextProductStock = previousProductStock;

      if (action === "STOCK_IN" || action === "ADJUSTMENT_INCREASE") {
        nextProductStock = previousProductStock + quantity;
      } else if (action === "ADJUSTMENT_DECREASE") {
        if (quantity > previousProductStock) {
          throw new Error("CANNOT_DECREASE_BELOW_ZERO");
        }
        nextProductStock = previousProductStock - quantity;
      }

      // Update product stock
      const product = await tx.product.update({
        where: { id: productId },
        data: { stock: nextProductStock },
      });

      // Target variant ID for inventory movement
      const movementVariantId = targetVariant ? targetVariant.id : existingProduct.id;

      // Sync Branch Inventory (HQ)
      const branch = await tx.branch.findFirst({ where: { code: "HQ" } });
      if (branch && movementVariantId) {
        const stockDiff =
          action === "STOCK_IN" || action === "ADJUSTMENT_INCREASE" ? quantity : -quantity;

        await tx.inventory.upsert({
          where: {
            variantId_branchId: {
              variantId: movementVariantId,
              branchId: branch.id,
            },
          },
          update: {
            quantity: { increment: stockDiff },
            availableQuantity: { increment: stockDiff },
          },
          create: {
            variantId: movementVariantId,
            branchId: branch.id,
            quantity: Math.max(stockDiff, 0),
            availableQuantity: Math.max(stockDiff, 0),
          },
        });
      }

      // Record Inventory Movement
      await createInventoryMovement(tx, {
        variantId: movementVariantId,
        type: action,
        channel: "ADMIN",
        quantity,
        previousStock: previousProductStock,
        nextStock: nextProductStock,
        note: reason || (action === "STOCK_IN" ? "Stock In receipt" : "Inventory adjustment"),
        userId: admin.id,
      });

      // Record Audit Log
      await createAuditLog(tx, {
        userId: admin.id,
        action: action === "STOCK_IN" ? "STOCK_IN" : "STOCK_ADJUSTMENT",
        module: "inventory",
        recordId: productId,
        oldValue: { stock: previousProductStock },
        newValue: { stock: nextProductStock, action, quantity, reason },
      });

      return product;
    });

    return ok({
      data: updatedProduct,
      message:
        action === "STOCK_IN"
          ? `Successfully added ${quantity} units to stock.`
          : `Stock adjusted successfully. New stock: ${updatedProduct.stock} units.`,
    });
  } catch (error) {
    if (error?.message === "CANNOT_DECREASE_BELOW_ZERO") {
      return fail("Cannot decrease stock below 0. Adjustment quantity exceeds current stock.", 422);
    }

    return handleRouteError(error, "Unable to adjust inventory.", {
      notFoundMessage: "Product not found.",
    });
  }
}
