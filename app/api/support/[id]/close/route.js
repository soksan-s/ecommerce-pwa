import { fail, handleRouteError, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeSupportTicket } from "@/lib/serializers";

export async function PATCH(request, { params }) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return fail("Not authenticated.", 401);
    }

    const { id } = await params;
    const existing = await prisma.supportTicket.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!existing) {
      return fail("Ticket not found.", 404);
    }

    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN" && existing.userId !== user.id) {
      return fail("Forbidden.", 403);
    }

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: {
        status: "closed",
      },
      include: {
        messages: {
          include: {
            user: {
              select: {
                email: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    return ok({
      data: serializeSupportTicket(ticket),
    });
  } catch (error) {
    return handleRouteError(error, "Unable to close support ticket.", {
      notFoundMessage: "Ticket not found.",
    });
  }
}
