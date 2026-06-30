"use server";

import { getServerSession } from "next-auth/next";
import bcrypt from "bcrypt";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/features/shared/lib/db";
import { AuditService } from "@/features/audit/services/audit.service";

type SessionUser = {
  id: string;
  role?: string;
};

interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export async function createUserAction(data: CreateUserInput) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const sessionUser = session.user as SessionUser;
  if (sessionUser.role !== "ADMIN") {
    return { success: false, error: "Hanya admin yang dapat membuat user baru." };
  }

  const name = data.name.trim();
  const email = data.email.trim().toLowerCase();
  const password = data.password.trim();

  if (!name || !email || !password) {
    return { success: false, error: "Nama, email, dan kata sandi wajib diisi." };
  }

  if (password.length < 8) {
    return { success: false, error: "Kata sandi minimal 8 karakter." };
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return { success: false, error: "Email sudah digunakan oleh user lain." };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: data.role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    await AuditService.log({
      userId: sessionUser.id,
      action: "CREATE_USER",
      entity: "User",
      entityId: newUser.id,
      newValue: {
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/hr");
    revalidatePath("/dashboard/admin");

    return {
      success: true,
      data: newUser,
      message: `User ${newUser.name} berhasil dibuat.`,
    };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Gagal membuat user baru.") };
  }
}

export async function updateUserRoleAction(userId: string, role: Role) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const sessionUser = session.user as SessionUser;
  if (sessionUser.role !== "ADMIN") {
    return { success: false, error: "Hanya admin yang dapat mengubah peran akun." };
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    await AuditService.log({
      userId: sessionUser.id,
      action: "UPDATE_USER_ROLE",
      entity: "User",
      entityId: updatedUser.id,
      newValue: { role: updatedUser.role },
    });

    revalidatePath("/dashboard/admin");
    revalidatePath("/dashboard/hr");
    return { success: true, data: updatedUser };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Gagal mengubah peran akun.") };
  }
}

export async function updateUserPasswordAction(userId: string, password: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const sessionUser = session.user as SessionUser;
  if (sessionUser.role !== "ADMIN") {
    return { success: false, error: "Hanya admin yang dapat mereset kata sandi akun." };
  }

  const normalizedPassword = password.trim();
  if (normalizedPassword.length < 8) {
    return { success: false, error: "Kata sandi baru minimal 8 karakter." };
  }

  try {
    const hashedPassword = await bcrypt.hash(normalizedPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
      select: { id: true },
    });

    await AuditService.log({
      userId: sessionUser.id,
      action: "RESET_USER_PASSWORD",
      entity: "User",
      entityId: userId,
      newValue: { resetBy: sessionUser.id },
    });

    revalidatePath("/dashboard/admin");
    return { success: true, message: "Kata sandi akun berhasil diperbarui." };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Gagal memperbarui kata sandi akun.") };
  }
}

export async function toggleUserStatusAction(userId: string, nextActiveState: boolean) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { success: false, error: "Akses tidak diizinkan." };
  }

  const sessionUser = session.user as SessionUser;
  if (sessionUser.role !== "ADMIN") {
    return { success: false, error: "Hanya admin yang dapat mengaktifkan atau menonaktifkan akun." };
  }

  if (sessionUser.id === userId && !nextActiveState) {
    return { success: false, error: "Admin tidak dapat menonaktifkan akun yang sedang dipakai." };
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive: nextActiveState },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });

    await AuditService.log({
      userId: sessionUser.id,
      action: nextActiveState ? "ACTIVATE_USER" : "DEACTIVATE_USER",
      entity: "User",
      entityId: userId,
      newValue: { isActive: updatedUser.isActive },
    });

    revalidatePath("/dashboard/admin");
    return { success: true, data: updatedUser };
  } catch (error: unknown) {
    return { success: false, error: getErrorMessage(error, "Gagal memperbarui status akun.") };
  }
}
