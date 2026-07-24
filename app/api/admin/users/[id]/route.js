import { fail, handleRouteError, ok } from "@/lib/api-response";
import { requireAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request, { params }) {
  try {
    const adminUser = await requireAdminUser();
    if (!adminUser) return fail("Unauthorized", 401);

    const { id } = await params;
    const { name, role, status } = await request.json();

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return fail("User not found", 404);

    if (user.role === "SUPER_ADMIN") {
      return fail("Cannot modify a SUPER_ADMIN account.", 403);
    }

    const allowedRoles = ["ADMIN", "MANAGER", "CASHIER", "WAREHOUSE_STAFF", "DRIVER", "CLIENT"];
    if (role && !allowedRoles.includes(role)) {
      return fail("Invalid role specified.", 400);
    }

    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name = name;
    if (role) dataToUpdate.role = role;
    if (status) dataToUpdate.status = status;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        name: true,
        username: true,
        phoneNumber: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    return ok({ user: updatedUser });
  } catch (error) {
    return handleRouteError(error, "Failed to update user");
  }
}

export async function DELETE(request, { params }) {
  try {
    const adminUser = await requireAdminUser();
    if (!adminUser) return fail("Unauthorized", 401);

    const { id } = await params;

    if (id === adminUser.id) {
      return fail("You cannot delete yourself.", 400);
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return fail("User not found", 404);

    if (user.role === "SUPER_ADMIN") {
      return fail("Cannot delete a SUPER_ADMIN.", 403);
    }

    await prisma.user.delete({
      where: { id },
    });

    return ok({ message: "User deleted successfully." });
  } catch (error) {
    return handleRouteError(error, "Failed to delete user");
  }
}
