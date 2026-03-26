import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, createSession, hashPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Usuario y contraseña son requeridos" },
        { status: 400 }
      );
    }

    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));

    if (!user) {
      const allUsers = await db.select().from(users);
      if (allUsers.length === 0 && username === "vmanuel" && password === "123456") {
        const passwordHash = hashPassword("123456");
        const [newUser] = await db
          .insert(users)
          .values({ username: "vmanuel", passwordHash, role: "admin" })
          .returning();
        user = newUser;
      }
    }

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: "Credenciales inválidas" },
        { status: 401 }
      );
    }

    await createSession(user.id, user.username, user.role);

    return NextResponse.json({
      success: true,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch {
    return NextResponse.json(
      { error: "Error en el inicio de sesión" },
      { status: 500 }
    );
  }
}
