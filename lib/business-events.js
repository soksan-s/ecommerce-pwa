export async function createAuditLog(tx, { userId, action, module, recordId, oldValue = null, newValue = null }) {
  return tx.auditLog.create({
    data: {
      userId: userId || null,
      action,
      module,
      recordId: recordId || null,
      oldValue,
      newValue,
    },
  });
}

/**
 * Create an inventory movement record.
 * Accepts both legacy param names (productId, quantity, previousStock, nextStock)
 * and new-style names (variantId, quantityChange, quantityBefore, quantityAfter)
 * for backward compatibility.
 */
export async function createInventoryMovement(
  tx,
  { variantId, branchId = null, batchId = null, orderId = null, saleId = null, type, channel, quantity, previousStock, nextStock, quantityChange, quantityBefore, quantityAfter, note = null, userId = null, productId },
) {
  // Resolve variantId — accept explicit variantId, or derive from productId
  const resolvedVariantId = variantId || productId || null;

  if (!resolvedVariantId) {
    throw new Error("createInventoryMovement requires variantId or productId");
  }

  return tx.inventoryMovement.create({
    data: {
      variantId: resolvedVariantId,
      branchId: branchId || null,
      batchId: batchId || null,
      orderId: orderId || null,
      saleId: saleId || null,
      stockTransferId: null,
      adjustmentId: null,
      type,
      channel: channel || null,
      quantityBefore: quantityBefore ?? previousStock ?? 0,
      quantityChange: quantityChange ?? quantity ?? 0,
      quantityAfter: quantityAfter ?? nextStock ?? 0,
      costPrice: null,
      note: note || null,
      userId: userId || null,
    },
  });
}

export async function calculateDeposits(tx, items) {
  let totalDeposit = 0;
  const itemsList = [];

  for (const item of items) {
    const qty = Number(item.qty || item.quantity || 0);
    const productDeposits = await tx.productDeposit.findMany({
      where: { productId: item.productId },
    });

    for (const dep of productDeposits) {
      const lineQty = qty * dep.quantity;
      const lineAmt = lineQty * Number(dep.depositAmount);
      totalDeposit += lineAmt;
      itemsList.push({
        depositTypeId: dep.depositTypeId,
        quantity: lineQty,
        depositAmount: dep.depositAmount,
      });
    }
  }

  return {
    totalDeposit: Number(totalDeposit.toFixed(2)),
    itemsList,
  };
}

export async function createContainerIssues(tx, { customerId, branchId = null, saleId = null, itemsList }) {
  if (!customerId || !itemsList.length) {
    return [];
  }

  const logs = [];
  for (const item of itemsList) {
    const log = await tx.containerTransaction.create({
      data: {
        customerId,
        depositTypeId: item.depositTypeId,
        branchId,
        saleId,
        type: "ISSUE",
        quantity: item.quantity,
      },
    });
    logs.push(log);
  }

  return logs;
}
