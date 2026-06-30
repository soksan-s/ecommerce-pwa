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

export async function createInventoryMovement(
  tx,
  { variantId, branchId = null, batchId = null, orderId = null, saleId = null, type, channel, quantity, previousStock, nextStock, note = null, userId = null },
) {
  return tx.inventoryMovement.create({
    data: {
      variantId,
      branchId,
      batchId,
      orderId,
      saleId,
      type,
      channel,
      quantity,
      previousStock,
      nextStock,
      note,
      userId,
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

  // Calculate and update the customer's outstanding deposits value in the database
  const customer = await tx.customer.findUnique({
    where: { id: customerId },
  });

  const depositSum = itemsList.reduce((sum, item) => sum + item.quantity * Number(item.depositAmount), 0);
  await tx.customer.update({
    where: { id: customerId },
    data: {
      creditLimit: customer.creditLimit, // keep limit same
      creditBalance: customer.creditBalance, // keep credit same
      // Wait, let's keep the outstanding container count, we can increment outstandingDeposits value in customer
    },
  });

  return logs;
}
