import { db } from "@/db";
import { telegramConfig, telegramUsers, devices, systemMetrics, latencyMetrics } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; first_name: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
  };
}

async function sendTelegramMessage(botToken: string, chatId: string | number, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    });
  } catch {}
}

async function getDeviceStatus() {
  const allDevices = await db.select().from(devices);
  const lines: string[] = [];

  for (const device of allDevices) {
    const [latestSystem] = await db
      .select()
      .from(systemMetrics)
      .where(eq(systemMetrics.deviceId, device.id))
      .orderBy(desc(systemMetrics.timestamp))
      .limit(1);

    const [latestLatency] = await db
      .select()
      .from(latencyMetrics)
      .where(eq(latencyMetrics.deviceId, device.id))
      .orderBy(desc(latencyMetrics.timestamp))
      .limit(1);

    const statusIcon = device.status === "online" ? "🟢" : device.status === "offline" ? "🔴" : "🟡";
    let line = `${statusIcon} *${device.name}* (${device.host}) — ${device.status.toUpperCase()}`;

    if (latestSystem) {
      const memUsed = latestSystem.totalMemory && latestSystem.freeMemory
        ? (((latestSystem.totalMemory - latestSystem.freeMemory) / latestSystem.totalMemory) * 100).toFixed(0)
        : "?";
      line += `\n   CPU: ${latestSystem.cpuLoad ?? "?"}% | RAM: ${memUsed}% | Uptime: ${latestSystem.uptime || "?"}`;
    }

    if (latestLatency) {
      line += `\n   Latencia: ${latestLatency.rttAvg ?? "?"}ms | Pérdida: ${latestLatency.packetLoss ?? 0}%`;
    }

    lines.push(line);
  }

  return lines.length > 0 ? lines.join("\n\n") : "No hay dispositivos configurados.";
}

async function processCommand(botToken: string, chatId: string, text: string) {
  const [registeredUser] = await db
    .select()
    .from(telegramUsers)
    .where(eq(telegramUsers.telegramChatId, chatId));

  if (!registeredUser || !registeredUser.isActive) {
    await sendTelegramMessage(botToken, chatId, "⛔ No estás autorizado para usar este bot. Contacta al administrador.");
    return;
  }

  const command = text.trim().toLowerCase();

  if (command === "/start" || command === "/help") {
    const help = `*MikroTik Monitor Bot*

Comandos disponibles:
/status — Estado de todos los dispositivos
/devices — Lista de dispositivos
/cpu — Carga de CPU de cada dispositivo
/latency — Latencia de cada dispositivo
/help — Mostrar esta ayuda`;
    await sendTelegramMessage(botToken, chatId, help);
    return;
  }

  if (command === "/status") {
    const status = await getDeviceStatus();
    await sendTelegramMessage(botToken, chatId, `📊 *Estado de la Red*\n\n${status}`);
    return;
  }

  if (command === "/devices") {
    const allDevices = await db.select().from(devices);
    if (allDevices.length === 0) {
      await sendTelegramMessage(botToken, chatId, "No hay dispositivos configurados.");
      return;
    }
    const lines = allDevices.map((d) => {
      const icon = d.status === "online" ? "🟢" : d.status === "offline" ? "🔴" : "🟡";
      return `${icon} ${d.name} — ${d.host}:${d.port} [${d.status}]`;
    });
    await sendTelegramMessage(botToken, chatId, `*Dispositivos*\n\n${lines.join("\n")}`);
    return;
  }

  if (command === "/cpu") {
    const allDevices = await db.select().from(devices);
    const lines: string[] = [];
    for (const device of allDevices) {
      const [latest] = await db
        .select()
        .from(systemMetrics)
        .where(eq(systemMetrics.deviceId, device.id))
        .orderBy(desc(systemMetrics.timestamp))
        .limit(1);
      if (latest) {
        const icon = (latest.cpuLoad ?? 0) > 80 ? "🔴" : (latest.cpuLoad ?? 0) > 50 ? "🟡" : "🟢";
        lines.push(`${icon} ${device.name}: ${latest.cpuLoad ?? "?"}%`);
      }
    }
    await sendTelegramMessage(botToken, chatId, `*CPU*\n\n${lines.length > 0 ? lines.join("\n") : "Sin datos"}`);
    return;
  }

  if (command === "/latency") {
    const allDevices = await db.select().from(devices);
    const lines: string[] = [];
    for (const device of allDevices) {
      const [latest] = await db
        .select()
        .from(latencyMetrics)
        .where(eq(latencyMetrics.deviceId, device.id))
        .orderBy(desc(latencyMetrics.timestamp))
        .limit(1);
      if (latest) {
        const icon = (latest.rttAvg ?? 0) > 150 ? "🔴" : (latest.rttAvg ?? 0) > 80 ? "🟡" : "🟢";
        lines.push(`${icon} ${device.name}: ${latest.rttAvg ?? "?"}ms (pérdida: ${latest.packetLoss ?? 0}%)`);
      }
    }
    await sendTelegramMessage(botToken, chatId, `*Latencia*\n\n${lines.length > 0 ? lines.join("\n") : "Sin datos"}`);
    return;
  }

  await sendTelegramMessage(botToken, chatId, "Comando no reconocido. Usa /help para ver los comandos disponibles.");
}

export async function pollTelegramUpdates() {
  const [config] = await db.select().from(telegramConfig).limit(1);
  if (!config || !config.enabled) return;

  const offset = (config.lastPollUpdateId || 0) + 1;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${config.botToken}/getUpdates?offset=${offset}&timeout=1`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!res.ok) return;

    const data = await res.json();
    if (!data.ok || !data.result) return;

    for (const update of data.result as TelegramUpdate[]) {
      if (update.message?.text) {
        await processCommand(config.botToken, String(update.message.chat.id), update.message.text);
      }

      await db
        .update(telegramConfig)
        .set({ lastPollUpdateId: update.update_id })
        .where(eq(telegramConfig.id, config.id));
    }
  } catch {}
}

export async function sendAlert(message: string) {
  const [config] = await db.select().from(telegramConfig).limit(1);
  if (!config || !config.enabled) return;

  const activeUsers = await db
    .select()
    .from(telegramUsers)
    .where(eq(telegramUsers.isActive, true));

  for (const user of activeUsers) {
    await sendTelegramMessage(config.botToken, user.telegramChatId, `⚠️ *Alerta MikroTik*\n\n${message}`);
  }
}

export async function checkAndSendAlerts() {
  const [config] = await db.select().from(telegramConfig).limit(1);
  if (!config || !config.enabled) return;

  const allDevices = await db.select().from(devices);
  const alerts: string[] = [];

  for (const device of allDevices) {
    if (config.alertDeviceOffline && device.status === "offline") {
      alerts.push(`🔴 *${device.name}* (${device.host}) está FUERA DE LÍNEA`);
    }

    if (config.alertHighCpu) {
      const [latest] = await db
        .select()
        .from(systemMetrics)
        .where(eq(systemMetrics.deviceId, device.id))
        .orderBy(desc(systemMetrics.timestamp))
        .limit(1);
      if (latest && (latest.cpuLoad ?? 0) > config.alertHighCpuThreshold) {
        alerts.push(`🔴 *${device.name}* — CPU al ${latest.cpuLoad}% (umbral: ${config.alertHighCpuThreshold}%)`);
      }
    }

    if (config.alertHighLatency) {
      const [latest] = await db
        .select()
        .from(latencyMetrics)
        .where(eq(latencyMetrics.deviceId, device.id))
        .orderBy(desc(latencyMetrics.timestamp))
        .limit(1);
      if (latest && (latest.rttAvg ?? 0) > config.alertHighLatencyThreshold) {
        alerts.push(`🟡 *${device.name}* — Latencia ${latest.rttAvg}ms (umbral: ${config.alertHighLatencyThreshold}ms)`);
      }
    }
  }

  if (alerts.length > 0) {
    await sendAlert(alerts.join("\n"));
  }
}
