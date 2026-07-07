import { requireAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminUsersClient } from "./admin-users-client";

export const metadata = {
  title: "User Management | Admin Soksan",
};

export default async function AdminUsersPage() {
  const adminUser = await requireAdminUser();

  if (!adminUser) {
    return (
      <div className="flex h-screen items-center justify-center">
        <h1 className="text-2xl font-bold text-red-500">Access Denied</h1>
      </div>
    );
  }

  // Fetch all users
  const users = await prisma.user.findMany({
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
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">User Management</h1>
          <p className="mt-2 text-slate-500">Manage system administrators, cashiers, managers, and clients.</p>
        </div>
      </div>

      <AdminUsersClient initialUsers={users} currentUserId={adminUser.id} />
    </div>
  );
}
