import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";

export async function POST() {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.username, "vmanuel"));

  const passwordHash = hashPassword("123456");

  if (existing) {
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, existing.id));

    return NextResponse.json({
      success: true,
      message: "Contraseña de vmanuel actualizada a 123456",
    });
  }

  await db.insert(users).values({
    username: "vmanuel",
    passwordHash,
    role: "admin",
  });

  return NextResponse.json({
    success: true,
    message: "Admin creado: vmanuel / 123456",
  });
}
