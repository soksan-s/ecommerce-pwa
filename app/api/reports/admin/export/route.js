import { fail, handleRouteError } from "@/lib/api-response";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request) {
  try {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user, "admin:reports")) {
      return new Response("Unauthorized", { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "sales"; // "sales" | "inventory" | "credits" | "containers" | "procurement"
    const branchId = searchParams.get("branchId");

    let csvContent = "";
    let filename = `report_${type}.csv`;

    if (type === "sales") {
      const where = branchId ? { branchId } : {};
      const sales = await prisma.sale.findMany({
        where,
        include: {
          customer: true,
          branch: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const headers = ["Date", "Sale ID", "Channel", "Branch", "Customer", "Cashier", "Subtotal", "Discount", "Tax", "Total", "Currency"];
      const rows = sales.map((sale) => [
        new Date(sale.createdAt).toISOString().slice(0, 10),
        sale.id,
        sale.channel,
        sale.branch?.name || "Main",
        sale.customer?.name || "Walk-in",
        sale.cashierName || "System",
        sale.subtotal,
        sale.discount,
        sale.tax,
        sale.total,
        sale.currency,
      ]);

      csvContent = [headers.join(","), ...rows.map((r) => r.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))].join("\n");
      filename = `sales_report_${new Date().toISOString().slice(0, 10)}.csv`;
    } 
    
    else if (type === "inventory") {
      const products = await prisma.product.findMany({
        include: {
          categoryRef: true,
          brandRef: true,
          variants: {
            include: {
              inventory: {
                include: { branch: true },
              },
            },
          },
        },
      });

      const headers = ["SKU", "Product Name", "Category", "Brand", "Cost Price", "Price (Retail)", "Wholesale Price", "Branch", "Stock"];
      const rows = [];

      for (const prod of products) {
        const invList = prod.variants.flatMap((v) => v.inventory || []);
        if (invList.length > 0) {
          for (const inv of invList) {
            rows.push([
              prod.sku || "",
              prod.name,
              prod.categoryRef?.name || prod.category,
              prod.brandRef?.name || prod.brand || "",
              prod.costPrice || 0,
              prod.price,
              prod.wholesalePrice || 0,
              inv.branch?.name || "Main",
              inv.quantity ?? inv.stock ?? prod.stock,
            ]);
          }
        } else {
          rows.push([
            prod.sku || "",
            prod.name,
            prod.categoryRef?.name || prod.category,
            prod.brandRef?.name || prod.brand || "",
            prod.costPrice || 0,
            prod.price,
            prod.wholesalePrice || 0,
            "Unassigned",
            prod.stock,
          ]);
        }
      }

      csvContent = [headers.join(","), ...rows.map((r) => r.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))].join("\n");
      filename = `inventory_valuation_${new Date().toISOString().slice(0, 10)}.csv`;
    } 
    
    else if (type === "credits") {
      const customers = await prisma.customer.findMany({
        include: { customerType: true },
        where: {
          creditBalance: { gt: 0 },
        },
      });

      const headers = ["Customer Name", "Phone", "Customer Type", "Credit Limit", "Credit Balance"];
      const rows = customers.map((cust) => [
        cust.name,
        cust.phone,
        cust.customerType.name,
        cust.creditLimit,
        cust.creditBalance,
      ]);

      csvContent = [headers.join(","), ...rows.map((r) => r.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))].join("\n");
      filename = `receivables_credit_${new Date().toISOString().slice(0, 10)}.csv`;
    } 
    
    else if (type === "containers") {
      const containerTx = await prisma.containerTransaction.findMany({
        include: {
          customer: true,
          depositType: true,
          branch: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const headers = ["Date", "Customer Name", "Phone", "Container Type", "Transaction Type", "Quantity", "Branch"];
      const rows = containerTx.map((tx) => [
        new Date(tx.createdAt).toISOString().slice(0, 10),
        tx.customer.name,
        tx.customer.phone,
        tx.depositType.name,
        tx.type,
        tx.quantity,
        tx.branch?.name || "Main",
      ]);

      csvContent = [headers.join(","), ...rows.map((r) => r.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))].join("\n");
      filename = `containers_report_${new Date().toISOString().slice(0, 10)}.csv`;
    } 
    
    else if (type === "procurement") {
      const pos = await prisma.purchaseOrder.findMany({
        include: {
          supplier: true,
          branch: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const headers = ["PO ID", "Supplier Name", "Branch", "Status", "Total Amount", "Date Created"];
      const rows = pos.map((po) => [
        po.id,
        po.supplier.name,
        po.branch.name,
        po.status,
        po.totalAmount,
        new Date(po.createdAt).toISOString().slice(0, 10),
      ]);

      csvContent = [headers.join(","), ...rows.map((r) => r.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))].join("\n");
      filename = `procurement_report_${new Date().toISOString().slice(0, 10)}.csv`;
    } 
    
    else {
      return new Response("Invalid report type.", { status: 422 });
    }

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}
