import { NextResponse } from "next/server";
import { prisma } from "@/features/shared/lib/db";
import bcrypt from "bcrypt";

export async function POST(req: Request) {
  try {
    const { name, email, password, division } = await req.json();

    if (!name || !email || !password || !division) {
      return NextResponse.json(
        { error: "Semua kolom input wajib diisi." },
        { status: 400 }
      );
    }

    const lowerEmail = email.trim().toLowerCase();

    // Determine role based on division
    let resolvedRole: "USER" | "HR" | "ADMIN" = "USER";
    if (division === "HR") {
      resolvedRole = "HR";
    } else if (division === "CX Engineer") {
      resolvedRole = "ADMIN";
    }

    // Enforce email domain validation for Employee/HR
    if (resolvedRole === "USER" || resolvedRole === "HR") {
      if (!lowerEmail.endsWith("@nanovest.io")) {
        return NextResponse.json(
          { error: "Pendaftaran role Employee/HR hanya diizinkan menggunakan email domain @nanovest.io." },
          { status: 400 }
        );
      }
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: lowerEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Alamat email sudah terdaftar." },
        { status: 400 }
      );
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    const isCxEngineer = division === "CX Engineer";

    // Create the new user
    const user = await prisma.user.create({
      data: {
        name,
        email: lowerEmail,
        password: hashedPassword,
        division,
        role: resolvedRole,
        isActive: isCxEngineer ? false : true,
      },
    });

    const successMessage = isCxEngineer
      ? "Pendaftaran berhasil! Akun Anda sedang menunggu persetujuan dari Admin Utama."
      : "Pendaftaran berhasil!";

    return NextResponse.json(
      { success: true, message: successMessage, userId: user.id },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[RegisterAPI] Error during registration:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal pada server. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
