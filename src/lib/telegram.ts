import { db } from "@/db";
import {
  telegramConfig, telegramUsers, telegramAlertHistory,
  devices, systemMetrics, latencyMetrics, antennas,
} from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import {
  type MikroTikDevice, pingFromDevice,
  fetchDhcpLeases, fetchSimpleQueues,
} from "@/lib/mikrotik";

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

function toMikroTikDevice(device: typeof devices.$inferSelect): MikroTikDevice {
  return {
    id: device.id,
    name: device.name,
    host: device.host,
    port: device.port,
    username: device.username,
    encryptedPassword: device.encryptedPassword,
  };
}

async function getFirstOnlineDevice(): Promise<MikroTikDevice | null> {
  const allDevices = await db.select().from(devices);
  const online = allDevices.find((d) => d.status === "online");
  return online ? toMikroTikDevice(online) : null;
}

async function broadcastToActiveUsers(botToken: string, text: string) {
  const activeUsers = await db
    .select()
    .from(telegramUsers)
    .where(eq(telegramUsers.isActive, true));

  for (const user of activeUsers) {
    await sendTelegramMessage(botToken, user.telegramChatId, text);
  }
}

async function processCommand(botToken: string, chatId: string, text: string) {
  const [registeredUser] = await db
    .select()
    .from(telegramUsers)
    .where(eq(telegramUsers.telegramChatId, chatId));

  if (!registeredUser || !registeredUser.isActive) {
    await sendTelegramMessage(botToken, chatId, "⛔ No estás autorizado para usar este bot.");
    return;
  }

  const command = text.trim().toLowerCase();

  if (command === "/start" || command === "/help") {
    const help = `*MikroTik Monitor Bot*

*Monitoreo:*
/status — Estado de dispositivos
/devices — Lista de dispositivos
/cpu — Carga de CPU
/latency — Latencia y pérdida

*Antenas:*
/antenas — Estado de todas las antenas

*Aprovisionamiento:*
/leases — Ver leases DHCP
/queues — Ver colas de velocidad

/help — Mostrar esta ayuda`;
    await sendTelegramMessage(botToken, chatId, help);
    return;
  }

  if (command === "/status") {
    const allDevices = await db.select().from(devices);
    const lines: string[] = [];

    for (const device of allDevices) {
      const [latestSystem] = await db
        .select().from(systemMetrics)
        .where(eq(systemMetrics.deviceId, device.id))
        .orderBy(desc(systemMetrics.timestamp)).limit(1);

      const [latestLatency] = await db
        .select().from(latencyMetrics)
        .where(eq(latencyMetrics.deviceId, device.id))
        .orderBy(desc(latencyMetrics.timestamp)).limit(1);

      const icon = device.status === "online" ? "🟢" : device.status === "offline" ? "🔴" : "🟡";
      let line = `${icon} *${device.name}* (${device.host}) — ${device.status.toUpperCase()}`;

      if (latestSystem) {
        const memUsed = latestSystem.totalMemory && latestSystem.freeMemory
          ? (((latestSystem.totalMemory - latestSystem.freeMemory) / latestSystem.totalMemory) * 100).toFixed(0)
          : "?";
        line += `\n   CPU: ${latestSystem.cpuLoad ?? "?"}% | RAM: ${memUsed}% | Up: ${latestSystem.uptime || "?"}`;
      }
      if (latestLatency) {
        line += `\n   Ping: ${latestLatency.rttAvg ?? "?"}ms | Pérdida: ${latestLatency.packetLoss ?? 0}%`;
      }
      lines.push(line);
    }

    await sendTelegramMessage(botToken, chatId, `📊 *Estado de la Red*\n\n${lines.length > 0 ? lines.join("\n\n") : "Sin dispositivos."}`);
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
      return `${icon} ${d.name} — ${d.host}:${d.port}`;
    });
    await sendTelegramMessage(botToken, chatId, `*Dispositivos*\n\n${lines.join("\n")}`);
    return;
  }

  if (command === "/cpu") {
    const allDevices = await db.select().from(devices);
    const lines: string[] = [];
    for (const device of allDevices) {
      const [latest] = await db
        .select().from(systemMetrics)
        .where(eq(systemMetrics.deviceId, device.id))
        .orderBy(desc(systemMetrics.timestamp)).limit(1);
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
        .select().from(latencyMetrics)
        .where(eq(latencyMetrics.deviceId, device.id))
        .orderBy(desc(latencyMetrics.timestamp)).limit(1);
      if (latest) {
        const icon = (latest.rttAvg ?? 0) > 150 ? "🔴" : (latest.rttAvg ?? 0) > 80 ? "🟡" : "🟢";
        lines.push(`${icon} ${device.name}: ${latest.rttAvg ?? "?"}ms (pérdida: ${latest.packetLoss ?? 0}%)`);
      }
    }
    await sendTelegramMessage(botToken, chatId, `*Latencia*\n\n${lines.length > 0 ? lines.join("\n") : "Sin datos"}`);
    return;
  }

  if (command === "/antenas") {
    const allAntennas = await db.select().from(antennas);
    if (allAntennas.length === 0) {
      await sendTelegramMessage(botToken, chatId, "No hay antenas registradas.");
      return;
    }

    const lines: string[] = [];
    for (const ant of allAntennas) {
      let statusIcon = "🟡";
      let pingInfo = "sin ping";

      if (ant.ip && ant.deviceId) {
        const [device] = await db.select().from(devices).where(eq(devices.id, ant.deviceId));
        if (device && device.status === "online") {
          const result = await pingFromDevice(toMikroTikDevice(device), ant.ip, 3);
          if (result.success) {
            statusIcon = "🟢";
            pingInfo = `${result.rttAvg}ms`;
          } else {
            statusIcon = "🔴";
            pingInfo = "sin respuesta";
          }
        } else {
          statusIcon = "🟡";
          pingInfo = "router offline";
        }
      } else if (ant.ip) {
        pingInfo = "sin router";
      }

      lines.push(`${statusIcon} *${ant.name}* — ${ant.ip || "sin IP"} — ${pingInfo}${ant.location ? ` (${ant.location})` : ""}`);
    }

    await sendTelegramMessage(botToken, chatId, `📡 *Estado de Antenas*\n\n${lines.join("\n")}`);
    return;
  }

  if (command === "/leases") {
    const device = await getFirstOnlineDevice();
    if (!device) {
      await sendTelegramMessage(botToken, chatId, "No hay dispositivos en línea.");
      return;
    }

    const leases = await fetchDhcpLeases(device);
    if (leases.length === 0) {
      await sendTelegramMessage(botToken, chatId, "No hay leases DHCP.");
      return;
    }

    const lines = leases.map((l) => {
      const icon = l.status === "bound" ? "🟢" : "🟡";
      return `${icon} ${l.address} — ${l.hostName || "sin nombre"} — ${l.macAddress} [${l.status}]`;
    });

    await sendTelegramMessage(botToken, chatId, `📋 *DHCP Leases — ${device.name}*\n\n${lines.join("\n")}`);
    return;
  }

  if (command === "/queues") {
    const device = await getFirstOnlineDevice();
    if (!device) {
      await sendTelegramMessage(botToken, chatId, "No hay dispositivos en línea.");
      return;
    }

    const queues = await fetchSimpleQueues(device);
    if (queues.length === 0) {
      await sendTelegramMessage(botToken, chatId, "No hay colas configuradas.");
      return;
    }

    const lines = queues.map((q) => {
      const icon = q.disabled === "true" ? "🔴" : "🟢";
      return `${icon} ${q.name} — ${q.target} — ${q.maxLimit}`;
    });

    await sendTelegramMessage(botToken, chatId, `⚡ *Colas de Velocidad — ${device.name}*\n\n${lines.join("\n")}`);
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

async function getAlertState(alertType: string, targetId: number) {
  const [existing] = await db
    .select()
    .from(telegramAlertHistory)
    .where(and(
      eq(telegramAlertHistory.alertType, alertType),
      eq(telegramAlertHistory.targetId, targetId)
    ));
  return existing || null;
}

async function updateAlertState(alertType: string, targetId: number, targetName: string, state: string) {
  const existing = await getAlertState(alertType, targetId);
  if (existing) {
    await db
      .update(telegramAlertHistory)
      .set({ lastState: state, lastNotifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(telegramAlertHistory.id, existing.id));
  } else {
    await db.insert(telegramAlertHistory).values({
      alertType,
      targetId,
      targetName,
      lastState: state,
      lastNotifiedAt: new Date(),
    });
  }
}

export async function checkAndSendAlerts() {
  const [config] = await db.select().from(telegramConfig).limit(1);
  if (!config || !config.enabled) return;

  const allDevices = await db.select().from(devices);
  const allAntennas = await db.select().from(antennas);
  const messages: string[] = [];

  for (const device of allDevices) {
    const prevState = await getAlertState("device_status", device.id);
    const currentState = device.status;

    if (config.alertDeviceOffline && prevState?.lastState !== currentState) {
      if (currentState === "offline") {
        messages.push(`🔴 *${device.name}* (${device.host}) se CAYÓ`);
        await updateAlertState("device_status", device.id, device.name, "offline");
      } else if (currentState === "online" && prevState?.lastState === "offline") {
        messages.push(`🟢 *${device.name}* (${device.host}) se LEVANTÓ`);
        await updateAlertState("device_status", device.id, device.name, "online");
      } else {
        await updateAlertState("device_status", device.id, device.name, currentState);
      }
    }

    if (config.alertHighCpu) {
      const [latest] = await db
        .select().from(systemMetrics)
        .where(eq(systemMetrics.deviceId, device.id))
        .orderBy(desc(systemMetrics.timestamp)).limit(1);
      if (latest) {
        const cpuHigh = (latest.cpuLoad ?? 0) > config.alertHighCpuThreshold;
        const prevCpuState = await getAlertState("high_cpu", device.id);
        if (cpuHigh && prevCpuState?.lastState !== "high") {
          messages.push(`🔴 *${device.name}* — CPU al ${latest.cpuLoad}% (umbral: ${config.alertHighCpuThreshold}%)`);
          await updateAlertState("high_cpu", device.id, device.name, "high");
        } else if (!cpuHigh && prevCpuState?.lastState === "high") {
          messages.push(`🟢 *${device.name}* — CPU normalizó a ${latest.cpuLoad}%`);
          await updateAlertState("high_cpu", device.id, device.name, "normal");
        }
      }
    }

    if (config.alertHighLatency) {
      const [latest] = await db
        .select().from(latencyMetrics)
        .where(eq(latencyMetrics.deviceId, device.id))
        .orderBy(desc(latencyMetrics.timestamp)).limit(1);
      if (latest) {
        const latHigh = (latest.rttAvg ?? 0) > config.alertHighLatencyThreshold;
        const prevLatState = await getAlertState("high_latency", device.id);
        if (latHigh && prevLatState?.lastState !== "high") {
          messages.push(`🟡 *${device.name}* — Latencia ${latest.rttAvg}ms (umbral: ${config.alertHighLatencyThreshold}ms)`);
          await updateAlertState("high_latency", device.id, device.name, "high");
        } else if (!latHigh && prevLatState?.lastState === "high") {
          messages.push(`🟢 *${device.name}* — Latencia normalizó a ${latest.rttAvg}ms`);
          await updateAlertState("high_latency", device.id, device.name, "normal");
        }
      }
    }
  }

  for (const ant of allAntennas) {
    if (!ant.ip || !ant.deviceId) continue;

    const [device] = await db.select().from(devices).where(eq(devices.id, ant.deviceId));
    if (!device || device.status !== "online") continue;

    const result = await pingFromDevice(toMikroTikDevice(device), ant.ip, 3);
    const currentState = result.success ? "up" : "down";
    const prevState = await getAlertState("antenna_status", ant.id);

    if (prevState?.lastState !== currentState) {
      if (currentState === "down") {
        messages.push(`🔴📡 *${ant.name}* (${ant.ip}) se CAYÓ`);
      } else if (currentState === "up" && prevState?.lastState === "down") {
        messages.push(`🟢📡 *${ant.name}* (${ant.ip}) se LEVANTÓ — ${result.rttAvg}ms`);
      }
      await updateAlertState("antenna_status", ant.id, ant.name, currentState);
    }
  }

  if (messages.length > 0) {
    await broadcastToActiveUsers(config.botToken, `⚠️ *Alertas*\n\n${messages.join("\n")}`);
  }
}
