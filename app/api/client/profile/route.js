import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail, handleRouteError, ok } from "@/lib/api-response";

const profileFields = ["name", "nameKh", "email", "addressLine", "province", "district", "commune", "village", "landmark", "deliveryInstructions"];

function clean(value, maxLength) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

export async function GET() {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser?.id || sessionUser.role !== "CLIENT") return fail("Sign in to view your profile.", 401);
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { id: true, name: true, nameKh: true, email: true, phoneNumber: true, ...Object.fromEntries(profileFields.slice(3).map((field) => [field, true])) },
    });
    return ok({ data: user });
  } catch (error) {
    return handleRouteError(error, "Unable to load your profile.");
  }
}

export async function PATCH(request) {
  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser?.id || sessionUser.role !== "CLIENT") return fail("Sign in to update your profile.", 401);
    const body = await request.json();
    const data = Object.fromEntries(profileFields.map((field) => [field, clean(body[field], field === "deliveryInstructions" ? 500 : field === "addressLine" ? 250 : field === "email" ? 254 : 120)]));
    if (data.name && data.name.length < 2) return fail("Please enter a name with at least 2 characters.", 422);
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return fail("Please enter a valid email address.", 422);
    const user = await prisma.user.update({
      where: { id: sessionUser.id },
      data,
      select: { id: true, name: true, nameKh: true, email: true, phoneNumber: true, addressLine: true, province: true, district: true, commune: true, village: true, landmark: true, deliveryInstructions: true },
    });
    return ok({ data: user });
  } catch (error) {
    return handleRouteError(error, "Unable to update your profile.");
  }
}
