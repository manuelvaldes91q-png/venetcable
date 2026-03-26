import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { telegramConfig, telegramUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const [config] = await db.select().from(telegramConfig).limit(1);
    const users = await db.select().from(telegramUsers);

    return NextResponse.json({
      config: config || null,
      users,
    });
  } catch {
    return NextResponse.json({ error: "Error al obtener configuración" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (action === "save_config") {
      const { botToken, enabled, alertDeviceOffline, alertHighCpu, alertHighCpuThreshold, alertHighLatency, alertHighLatencyThreshold, alertAntennas, alertIntervalMinutes } = body;

      if (!botToken) {
        return NextResponse.json({ error: "Token del bot es requerido" }, { status: 400 });
      }

      let botUsername: string | null = null;
      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
        if (tgRes.ok) {
          const tgData = await tgRes.json();
          botUsername = tgData.result?.username || null;
        }
      } catch {}

      const [existing] = await db.select().from(telegramConfig).limit(1);

      const configData = {
        botToken,
        botUsername,
        enabled: enabled ?? false,
        alertDeviceOffline: alertDeviceOffline ?? true,
        alertHighCpu: alertHighCpu ?? true,
        alertHighCpuThreshold: alertHighCpuThreshold ?? 80,
        alertHighLatency: alertHighLatency ?? true,
        alertHighLatencyThreshold: alertHighLatencyThreshold ?? 150,
        alertAntennas: alertAntennas ?? true,
        alertIntervalMinutes: alertIntervalMinutes ?? 5,
        updatedAt: new Date(),
      };

      if (existing) {
        await db.update(telegramConfig).set(configData).where(eq(telegramConfig.id, existing.id));
      } else {
        await db.insert(telegramConfig).values(configData);
      }

      return NextResponse.json({ success: true, botUsername });
    }

    if (action === "add_user") {
      const { telegramChatId, telegramUsername, telegramFirstName } = body;

      if (!telegramChatId) {
        return NextResponse.json({ error: "Chat ID es requerido" }, { status: 400 });
      }

      const [existingUser] = await db
        .select()
        .from(telegramUsers)
        .where(eq(telegramUsers.telegramChatId, telegramChatId));

      if (existingUser) {
        return NextResponse.json({ error: "Este usuario de Telegram ya está registrado" }, { status: 409 });
      }

      const [newUser] = await db
        .insert(telegramUsers)
        .values({
          telegramChatId,
          telegramUsername: telegramUsername || null,
          telegramFirstName: telegramFirstName || null,
          addedByUserId: parseInt(session.sub, 10),
        })
        .returning();

      return NextResponse.json(newUser, { status: 201 });
    }

    if (action === "remove_user") {
      const { userId } = body;
      if (!userId) {
        return NextResponse.json({ error: "ID de usuario requerido" }, { status: 400 });
      }
      await db.delete(telegramUsers).where(eq(telegramUsers.id, userId));
      return NextResponse.json({ success: true });
    }

    if (action === "toggle_user") {
      const { userId, isActive } = body;
      if (!userId) {
        return NextResponse.json({ error: "ID de usuario requerido" }, { status: 400 });
      }
      await db
        .update(telegramUsers)
        .set({ isActive, updatedAt: new Date() })
        .where(eq(telegramUsers.id, userId));
      return NextResponse.json({ success: true });
    }

    if (action === "test_bot") {
      const [config] = await db.select().from(telegramConfig).limit(1);
      if (!config) {
        return NextResponse.json({ error: "No hay configuración guardada" }, { status: 400 });
      }

      const tgRes = await fetch(`https://api.telegram.org/bot${config.botToken}/getMe`);
      if (!tgRes.ok) {
        return NextResponse.json({ success: false, error: "Token inválido" });
      }
      const tgData = await tgRes.json();
      return NextResponse.json({ success: true, bot: tgData.result });
    }

    if (action === "send_test") {
      const [config] = await db.select().from(telegramConfig).limit(1);
      if (!config) {
        return NextResponse.json({ error: "No hay configuración guardada" }, { status: 400 });
      }

      const activeUsers = await db
        .select()
        .from(telegramUsers)
        .where(eq(telegramUsers.isActive, true));

      if (activeUsers.length === 0) {
        return NextResponse.json({ error: "No hay usuarios activos" }, { status: 400 });
      }

      const results: { chatId: string; success: boolean }[] = [];
      for (const user of activeUsers) {
        try {
          const res = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: user.telegramChatId,
              text: "✅ *Mensaje de prueba*\n\nEl bot de MikroTik Monitor está funcionando correctamente.",
              parse_mode: "Markdown",
            }),
          });
          results.push({ chatId: user.telegramChatId, success: res.ok });
        } catch {
          results.push({ chatId: user.telegramChatId, success: false });
        }
      }

      return NextResponse.json({ results });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Error en la operación" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      await db.delete(telegramUsers).where(eq(telegramUsers.id, parseInt(id, 10)));
      return NextResponse.json({ success: true });
    }

    await db.delete(telegramConfig);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
