import { fail, handleRouteError, ok } from "@/lib/api-response";
import { requireAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request, { params }) {
  try {
    const adminUser = await requireAdminUser();
    if (!adminUser) return fail("Unauthorized", 401);

    const { id } = await params;
    const { status } = await request.json();

    if (id === adminUser.id) {
      return fail("You cannot suspend yourself.", 400);
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return fail("User not found", 404);
    
    if (user.role === "SUPER_ADMIN") {
      return fail("Cannot modify a SUPER_ADMIN.", 403);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { status },
    });

    return ok({ user: updatedUser });
  } catch (error) {
    return handleRouteError(error, "Failed to update user status");
  }
}
