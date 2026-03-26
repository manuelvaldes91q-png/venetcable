import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const allUsers = await db
    .select({ id: users.id, username: users.username, role: users.role, createdAt: users.createdAt })
    .from(users);

  return NextResponse.json(allUsers);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { username, password, role } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Usuario y contraseña son requeridos" },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));

    if (existing) {
      return NextResponse.json(
        { error: "El usuario ya existe" },
        { status: 409 }
      );
    }

    const passwordHash = hashPassword(password);

    const [newUser] = await db
      .insert(users)
      .values({ username, passwordHash, role: role || "user" })
      .returning({ id: users.id, username: users.username, role: users.role });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Error al crear usuario" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  if (parseInt(id, 10) === parseInt(session.sub, 10)) {
    return NextResponse.json(
      { error: "No puede eliminarse a sí mismo" },
      { status: 400 }
    );
  }

  await db.delete(users).where(eq(users.id, parseInt(id, 10)));
  return NextResponse.json({ success: true });
}
