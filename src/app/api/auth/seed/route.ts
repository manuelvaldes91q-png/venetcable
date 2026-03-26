import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";

export async function POST() {
  const existingUsers = await db.select().from(users);

  if (existingUsers.length > 0) {
    return NextResponse.json({
      message: "Ya existen usuarios",
      count: existingUsers.length,
    });
  }

  const passwordHash = hashPassword("vmanuel");

  await db.insert(users).values({
    username: "vmanuel",
    passwordHash,
    role: "admin",
  });

  return NextResponse.json({
    success: true,
    message: 'Usuario administrador creado: vmanuel / vmanuel',
  });
}
