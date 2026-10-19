import { fail, handleRouteError, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      return fail("Admin access required.", 403);
    }

    const products = await prisma.product.findMany({
      where: {
        deletedAt: null,
        OR: [
          { ratingCount: { gt: 0 } },
          { comments: { some: {} } },
        ],
      },
      select: {
        id: true,
        name: true,
        nameKh: true,
        ratingAvg: true,
        ratingCount: true,
        comments: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            message: true,
            createdAt: true,
            updatedAt: true,
            user: {
              select: {
                name: true,
                phoneNumber: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return ok({
      data: products.map((product) => ({
        id: product.id,
        name: product.name,
        nameKh: product.nameKh || "",
        rating: Number(product.ratingAvg || 0),
        ratingCount: product.ratingCount || 0,
        comments: product.comments.map((comment) => ({
          id: comment.id,
          message: comment.message,
          createdAt: comment.createdAt,
          updatedAt: comment.updatedAt,
          customerName: comment.user.name || "Customer",
          customerPhone: comment.user.phoneNumber || "",
        })),
      })),
    });
  } catch (error) {
    return handleRouteError(error, "Unable to load product feedback.");
  }
}
