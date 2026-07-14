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

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Alamat email sudah terdaftar." },
        { status: 400 }
      );
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the new user with default role USER (Employee)
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        division,
        role: "USER",
        isActive: true,
      },
    });

    return NextResponse.json(
      { success: true, message: "Pendaftaran berhasil!", userId: user.id },
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
