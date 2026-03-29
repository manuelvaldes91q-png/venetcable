import { NextResponse } from "next/server";
import { pollTelegramUpdates, checkAndSendAlerts } from "@/lib/telegram";
import { db } from "@/db";
import { telegramConfig } from "@/db/schema";

export async function POST() {
  try {
    const [config] = await db.select().from(telegramConfig).limit(1);
    if (!config || !config.enabled) {
      return NextResponse.json({ error: "Telegram no está habilitado" }, { status: 400 });
    }

    await pollTelegramUpdates();
    await checkAndSendAlerts().catch((e) => console.error("Alert error:", e));

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Telegram poll error:", e);
    return NextResponse.json({ error: "Error en polling" }, { status: 500 });
  }
}
