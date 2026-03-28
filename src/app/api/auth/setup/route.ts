import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, createSession } from "@/lib/auth";

export async function GET() {
  try {
    const allUsers = await db.select().from(users);
    return NextResponse.json({ hasUsers: allUsers.length > 0 });
  } catch {
    return NextResponse.json({ hasUsers: false });
  }
}

export async function POST(request: NextRequest) {
  try {
    const allUsers = await db.select().from(users);
    if (allUsers.length > 0) {
      return NextResponse.json(
        { error: "Ya existe un administrador. Use el login normal." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Usuario y contraseña son requeridos" },
        { status: 400 }
      );
    }

    if (username.length < 3) {
      return NextResponse.json(
        { error: "El usuario debe tener al menos 3 caracteres" },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 4 caracteres" },
        { status: 400 }
      );
    }

    const passwordHash = hashPassword(password);
    const [newUser] = await db
      .insert(users)
      .values({ username, passwordHash, role: "admin" })
      .returning();

    await createSession(newUser.id, newUser.username, newUser.role);

    return NextResponse.json({
      success: true,
      user: { id: newUser.id, username: newUser.username, role: newUser.role },
    });
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: `Error: ${error instanceof Error ? error.message : "desconocido"}` },
      { status: 500 }
    );
  }
}
