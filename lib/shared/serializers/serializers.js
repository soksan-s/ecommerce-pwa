export function serializeOrder(order) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    channel: (order.channel || "ONLINE").toLowerCase(),
    shippingAddress: order.shippingAddress,
    paymentMethod: order.paymentMethod,
    paymentStatus: (order.paymentStatus || "PENDING").toLowerCase(),
    status: order.status.toLowerCase(),
    trackingNumber: order.trackingNumber,
    trackingCarrier: order.trackingCarrier,
    trackingStatus: order.trackingStatus,
    couponCode: order.couponCode,
    couponDiscount: Number(order.couponDiscount || 0),
    total: Number(order.total || 0),
    items: (order.items || order.lines || []).map((item) => ({
      id: item.id,
      variantId: item.variantId,
      productName: item.productName,
      variantName: item.variantName,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal || (item.quantity * item.unitPrice)),
    })),
    // Legacy alias for backward compatibility
    lines: (order.items || order.lines || []).map((item) => ({
      productId: item.variantId || item.productId,
      productName: item.productName || item.variantName,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      discountPercent: item.discountPercent || 0,
    })),
  };
}

export function serializeCoupon(coupon) {
  return {
    id: coupon.id,
    code: coupon.code,
    type: coupon.type.toLowerCase(),
    value: Number(coupon.value),
    isActive: coupon.isActive,
    description: coupon.description,
    audience: coupon.audience.toLowerCase(),
    userEmail: coupon.userEmail || "",
  };
}

export function serializeSupportTicket(ticket) {
  return {
    id: ticket.id,
    subject: ticket.subject,
    status: ticket.status,
    createdAt: ticket.createdAt,
    messages: (ticket.messages || []).map((entry) => ({
      id: entry.id,
      authorRole: entry.user.role,
      authorEmail: entry.user.email,
      message: entry.message,
      createdAt: entry.createdAt,
    })),
  };
}

export function serializeComment(comment) {
  return {
    id: comment.id,
    userEmail: comment.user.email,
    message: comment.message,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    isEdited: comment.updatedAt?.getTime?.() !== comment.createdAt?.getTime?.(),
  };
}
