import { fail, handleRouteError, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeSupportTicket } from "@/lib/serializers";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return fail("Not authenticated.", 401);
    }

    const tickets = await prisma.supportTicket.findMany({
      where: (user.role === "ADMIN" || user.role === "SUPER_ADMIN") ? {} : { userId: user.id },
      include: {
        messages: {
          include: {
            user: {
              select: {
                email: true,
                role: true,
                name: true,
                phoneNumber: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return ok({
      data: tickets.map(serializeSupportTicket),
    });
  } catch (error) {
    return handleRouteError(error, "Unable to load support tickets.");
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return fail("Not authenticated.", 401);
    }

    const body = await request.json();

    if (!body.subject || !body.message || body.subject.trim().length < 3 || body.message.trim().length < 3) {
      return fail("Invalid support payload.", 422);
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: user.id,
        subject: body.subject.trim(),
        status: "open",
        messages: {
          create: {
            userId: user.id,
            message: body.message.trim(),
          },
        },
      },
      include: {
        messages: {
          include: {
            user: {
              select: {
                email: true,
                role: true,
                name: true,
                phoneNumber: true,
              },
            },
          },
        },
      },
    });

    return ok({
      data: serializeSupportTicket(ticket),
    });
  } catch (error) {
    return handleRouteError(error, "Unable to create support ticket.");
  }
}
