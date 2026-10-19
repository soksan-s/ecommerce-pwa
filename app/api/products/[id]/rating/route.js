import { fail, handleRouteError, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request, { params }) {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("Not authenticated.", 401);

    const { id } = await params;
    const body = await request.json();
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return fail("Rating must be between 1 and 5.", 422);
    }

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id, isActive: true, deletedAt: null },
        select: { id: true, ratingAvg: true, ratingCount: true },
      });
      if (!product) return null;

      const previousCount = Number(product.ratingCount || 0);
      const ratingCount = previousCount + 1;
      const ratingAvg = Number((
        (Number(product.ratingAvg || 0) * previousCount + rating) / ratingCount
      ).toFixed(2));

      await tx.product.update({
        where: { id },
        data: { ratingAvg, ratingCount },
      });

      return { ratingAvg, ratingCount };
    });

    if (!result) return fail("Product not found.", 404);
    return ok({ data: result });
  } catch (error) {
    return handleRouteError(error, "Unable to save product rating.");
  }
}
