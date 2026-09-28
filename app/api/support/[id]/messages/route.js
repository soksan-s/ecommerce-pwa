import { fail, handleRouteError, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeSupportTicket } from "@/lib/serializers";

export async function POST(request, { params }) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return fail("Not authenticated.", 401);
    }

    const { id } = await params;
    const body = await request.json();

    if (!body.message || body.message.trim().length < 2) {
      return fail("Message is too short.", 422);
    }

    const existing = await prisma.supportTicket.findUnique({
      where: {
        id,
      },
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

    await prisma.supportMessage.create({
      data: {
        ticketId: id,
        userId: user.id,
        message: body.message.trim(),
      },
    });

    await prisma.supportTicket.update({
      where: { id },
      data: {
        status: user.role === "ADMIN" ? "answered" : "open",
      },
    });

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
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
    return handleRouteError(error, "Unable to send support reply.", {
      notFoundMessage: "Ticket not found.",
    });
  }
}
