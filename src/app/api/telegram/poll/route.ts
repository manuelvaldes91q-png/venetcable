import { NextResponse } from "next/server";
import { pollTelegramUpdates, checkAndSendAlerts } from "@/lib/telegram";
import { db } from "@/db";
import { telegramConfig } from "@/db/schema";

let lastAlertCheck = 0;
const ALERT_INTERVAL = 300000;

export async function POST() {
  try {
    const [config] = await db.select().from(telegramConfig).limit(1);
    if (!config || !config.enabled) {
      return NextResponse.json({ error: "Deshabilitado" }, { status: 400 });
    }

    await pollTelegramUpdates();

    const now = Date.now();
    if (now - lastAlertCheck > ALERT_INTERVAL) {
      lastAlertCheck = now;
      checkAndSendAlerts().catch((e) => console.error("Alert error:", e));
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Telegram poll error:", e);
    return NextResponse.json({ error: "Error en polling" }, { status: 500 });
  }
}
