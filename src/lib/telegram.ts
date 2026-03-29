import { db } from "@/db";
import {
  telegramConfig, telegramUsers, telegramAlertHistory,
  devices, systemMetrics, latencyMetrics, antennas, interfaceMetrics,
} from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import {
  type MikroTikDevice, type DhcpLease, pingFromDevice,
  fetchDhcpLeases, fetchSimpleQueues, fetchInterfaceNames,
  convertDhcpToStatic, addArpBinding, addSimpleQueue,
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

interface ProvisionSession {
  step: "select_lease" | "enter_name" | "enter_interface" | "enter_speed";
  device: MikroTikDevice;
  leases: DhcpLease[];
  selectedLease: DhcpLease;
  clientName: string;
  arpInterface: string;
}

interface AntennaSession {
  step: "enter_name" | "enter_ip" | "select_device" | "enter_location";
  name: string;
  ip: string;
  deviceId: number | null;
  deviceList: typeof devices.$inferSelect[];
  location: string;
}

const conversationState = new Map<string, { type: "provision"; session: ProvisionSession } | { type: "antenna"; session: AntennaSession }>();

async function sendTelegramMessage(botToken: string, chatId: string | number, text: string, keyboard?: boolean) {
  try {
    const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: "Markdown" };
    if (keyboard) {
      body.reply_markup = {
        keyboard: [
          [{ text: "📊 Estado" }, { text: "📡 Antenas" }],
          [{ text: "📋 Leases" }, { text: "⚡ Colas" }],
          [{ text: "🔧 Aprovisionar" }, { text: "➕ Agregar Antena" }],
        ],
        resize_keyboard: true,
        one_time_keyboard: false,
      };
    }
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const bodyPlain: Record<string, unknown> = { chat_id: chatId, text };
      if (keyboard) {
        bodyPlain.reply_markup = body.reply_markup;
      }
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPlain),
      });
    }
  } catch (e) {
    console.error("Telegram send error:", e);
  }
}

const COMMAND_MAP: Record<string, string> = {
  "📊 Estado": "/status",
  "📡 Antenas": "/antenas",
  "📋 Leases": "/leases",
  "⚡ Colas": "/queues",
  "🔧 Aprovisionar": "/provision",
  "➕ Agregar Antena": "/addantena",
  "❌ Cancelar": "/cancel",
};

function resolveCommand(text: string): string {
  return COMMAND_MAP[text.trim()] || text;
}

function toMikroTikDevice(device: typeof devices.$inferSelect): MikroTikDevice {
  return {
    id: device.id, name: device.name, host: device.host,
    port: device.port, username: device.username,
    encryptedPassword: device.encryptedPassword,
  };
}

async function getFirstOnlineDevice(): Promise<MikroTikDevice | null> {
  const allDevices = await db.select().from(devices);
  const online = allDevices.find((d) => d.status === "online");
  return online ? toMikroTikDevice(online) : null;
}

async function broadcastToActiveUsers(botToken: string, text: string) {
  const activeUsers = await db.select().from(telegramUsers).where(eq(telegramUsers.isActive, true));
  for (const user of activeUsers) {
    await sendTelegramMessage(botToken, user.telegramChatId, text);
  }
}

async function handleProvisionInput(botToken: string, chatId: string, text: string) {
  const state = conversationState.get(chatId);
  if (!state || state.type !== "provision") return false;

  const session = state.session;
  const input = text.trim();

  if (input.toLowerCase() === "/cancel") {
    conversationState.delete(chatId);
    await sendTelegramMessage(botToken, chatId, "❌ Aprovisionamiento cancelado.");
    return true;
  }

  if (session.step === "select_lease") {
    const num = parseInt(input, 10);
    if (isNaN(num) || num < 1 || num > session.leases.length) {
      await sendTelegramMessage(botToken, chatId, `Número inválido. Escribe un número del 1 al ${session.leases.length} o /cancel para cancelar.`);
      return true;
    }
    session.selectedLease = session.leases[num - 1];
    session.step = "enter_name";
    await sendTelegramMessage(botToken, chatId,
      `*Paso 2/4 — Nombre del cliente*\n\n` +
      `IP: ${session.selectedLease.address}\n` +
      `MAC: ${session.selectedLease.macAddress}\n` +
      `Host: ${session.selectedLease.hostName || "sin nombre"}\n\n` +
      `Escribe el nombre del cliente:\n(Ej: Juan Pérez, Tienda Norte)`
    );
    return true;
  }

  if (session.step === "enter_name") {
    session.clientName = input;
    session.step = "enter_interface";

    let interfaces: string[] = [];
    try {
      interfaces = await Promise.race([
        fetchInterfaceNames(session.device),
        new Promise<string[]>((_, reject) => setTimeout(() => reject(new Error("timeout")), 8000)),
      ]);
    } catch {}

    const ifaceList = interfaces.length > 0
      ? `\nInterfaces: ${interfaces.join(", ")}`
      : "";

    await sendTelegramMessage(botToken, chatId,
      `*Paso 3/4 — Interfaz ARP*\n\n` +
      `Cliente: ${session.clientName}\n` +
      `IP: ${session.selectedLease.address}\n\n` +
      `Escribe la interfaz para el binding ARP:${ifaceList}\n(Ej: ether2, bridge1)`
    );
    return true;
  }

  if (session.step === "enter_interface") {
    session.arpInterface = input;
    session.step = "enter_speed";

    await sendTelegramMessage(botToken, chatId,
      `🔄 Fijando IP y creando ARP en segundo plano...`
    );

    convertDhcpToStatic(session.device, session.selectedLease.id, session.clientName)
      .then(() => sendTelegramMessage(botToken, chatId, "✅ IP fijada como estática."))
      .catch(() => sendTelegramMessage(botToken, chatId, "⚠️ No se pudo fijar IP estática."));

    addArpBinding(session.device, session.selectedLease.macAddress, session.selectedLease.address, session.arpInterface, session.clientName)
      .then(() => sendTelegramMessage(botToken, chatId, "✅ Binding ARP creado."))
      .catch(() => sendTelegramMessage(botToken, chatId, "⚠️ No se pudo crear ARP."));

    await sendTelegramMessage(botToken, chatId,
      `*Paso 4/4 — Velocidad*\n\n` +
      `Cliente: ${session.clientName}\n` +
      `IP: ${session.selectedLease.address}\n` +
      `ARP: ${session.arpInterface}\n\n` +
      `Escribe la velocidad SUBIDA/BAJADA:\n(Ej: 10M/10M, 5M/20M)\n\n` +
      `M = Mbps, K = Kbps`
    );
    return true;
  }

  if (session.step === "enter_speed") {
    const speedParts = input.split("/");
    if (speedParts.length !== 2) {
      await sendTelegramMessage(botToken, chatId, "Formato inválido. Usa SUBIDA/BAJADA (ej: 10M/10M)");
      return true;
    }

    const upload = speedParts[0].trim();
    const download = speedParts[1].trim();

    conversationState.delete(chatId);

    addSimpleQueue(session.device, session.clientName, session.selectedLease.address, upload, download)
      .then(() => sendTelegramMessage(botToken, chatId, "✅ Cola de velocidad creada."))
      .catch(() => sendTelegramMessage(botToken, chatId, "⚠️ No se pudo crear la cola. Configurar manualmente."));

    await sendTelegramMessage(botToken, chatId,
      `✅ *Aprovisionamiento enviado*\n\n` +
      `👤 Cliente: ${session.clientName}\n` +
      `🌐 IP: ${session.selectedLease.address}\n` +
      `🔗 MAC: ${session.selectedLease.macAddress}\n` +
      `📡 Interfaz: ${session.arpInterface}\n` +
      `⚡ Velocidad: ${upload}↑ / ${download}↓\n\n` +
      `Las acciones se están ejecutando en el router.`
    );
    return true;
  }

  return false;
}

async function handleAntennaInput(botToken: string, chatId: string, text: string) {
  const state = conversationState.get(chatId);
  if (!state || state.type !== "antenna") return false;

  const session = state.session;
  const input = text.trim();

  if (input.toLowerCase() === "/cancel") {
    conversationState.delete(chatId);
    await sendTelegramMessage(botToken, chatId, "❌ Agregar antena cancelado.");
    return true;
  }

  if (session.step === "enter_name") {
    session.name = input;
    session.step = "enter_ip";
    await sendTelegramMessage(botToken, chatId,
      `*Paso 2/4 — IP de la antena*\n\n` +
      `Nombre: ${session.name}\n\n` +
      `Escribe la IP de la antena:\n(Ej: 192.168.1.10)`
    );
    return true;
  }

  if (session.step === "enter_ip") {
    session.ip = input;
    session.step = "select_device";

    const allDevices = await db.select().from(devices);
    session.deviceList = allDevices;

    if (allDevices.length === 0) {
      session.deviceId = null;
      session.step = "enter_location";
      await sendTelegramMessage(botToken, chatId,
        `*Paso 4/4 — Ubicación*\n\n` +
        `No hay routers configurados. La antena se guardará sin ping.\n\n` +
        `Escribe la ubicación (o escribe "no" para omitir):`
      );
      return true;
    }

    const lines = allDevices.map((d, i) => {
      const icon = d.status === "online" ? "🟢" : "🔴";
      return `${i + 1}. ${icon} ${d.name} (${d.host})`;
    });

    await sendTelegramMessage(botToken, chatId,
      `*Paso 3/4 — Router MikroTik*\n\n` +
      `Nombre: ${session.name}\nIP: ${session.ip}\n\n` +
      `Selecciona el router que hará el ping:\n\n${lines.join("\n")}\n\n` +
      `Escribe el número, o "no" para omitir:`
    );
    return true;
  }

  if (session.step === "select_device") {
    if (input.toLowerCase() === "no") {
      session.deviceId = null;
    } else {
      const num = parseInt(input, 10);
      if (isNaN(num) || num < 1 || num > session.deviceList.length) {
        await sendTelegramMessage(botToken, chatId, `Número inválido. Escribe 1-${session.deviceList.length} o "no" para omitir.`);
        return true;
      }
      session.deviceId = session.deviceList[num - 1].id;
    }

    session.step = "enter_location";
    await sendTelegramMessage(botToken, chatId,
      `*Paso 4/4 — Ubicación*\n\n` +
      `Nombre: ${session.name}\nIP: ${session.ip}\n` +
      `Router: ${session.deviceId ? session.deviceList.find(d => d.id === session.deviceId)?.name : "ninguno"}\n\n` +
      `Escribe la ubicación (o escribe "no" para omitir):`
    );
    return true;
  }

  if (session.step === "enter_location") {
    session.location = input.toLowerCase() === "no" ? "" : input;

    const [newAntenna] = await db.insert(antennas).values({
      name: session.name,
      ip: session.ip || null,
      deviceId: session.deviceId,
      location: session.location || null,
    }).returning();

    conversationState.delete(chatId);

    const deviceName = session.deviceId
      ? session.deviceList.find(d => d.id === session.deviceId)?.name || "desconocido"
      : "ninguno";

    await sendTelegramMessage(botToken, chatId,
      `✅ *Antena agregada*\n\n` +
      `📡 Nombre: ${newAntenna.name}\n` +
      `🌐 IP: ${newAntenna.ip || "sin IP"}\n` +
      `🔧 Router: ${deviceName}\n` +
      `📍 Ubicación: ${newAntenna.location || "sin ubicación"}\n\n` +
      `La antena está siendo monitoreada.`
    );
    return true;
  }

  return false;
}

async function processCommand(botToken: string, chatId: string, rawText: string) {
  const text = resolveCommand(rawText);

  const [registeredUser] = await db
    .select().from(telegramUsers)
    .where(eq(telegramUsers.telegramChatId, chatId));

  if (!registeredUser || !registeredUser.isActive) {
    await sendTelegramMessage(botToken, chatId, "⛔ No estás autorizado.");
    return;
  }

  const isProvision = await handleProvisionInput(botToken, chatId, text);
  if (isProvision) return;

  const isAntenna = await handleAntennaInput(botToken, chatId, text);
  if (isAntenna) return;

  const command = text.trim().toLowerCase();

  if (command === "/start" || command === "/help") {
    const help = `*MikroTik Monitor Bot*

Usa los botones de abajo para navegar:

📊 *Estado* — Ver dispositivos y métricas
📡 *Antenas* — Estado de antenas (up/down)
📋 *Leases* — Ver clientes DHCP
⚡ *Colas* — Ver velocidades asignadas
🔧 *Aprovisionar* — Agregar cliente nuevo
➕ *Agregar Antena* — Monitorear antena nueva`;
    await sendTelegramMessage(botToken, chatId, help, true);
    return;
  }

  if (command === "/status") {
    const allDevices = await db.select().from(devices);
    if (allDevices.length === 0) {
      await sendTelegramMessage(botToken, chatId, "No hay dispositivos configurados.");
      return;
    }

    const online = allDevices.filter((d) => d.status === "online").length;
    const offline = allDevices.filter((d) => d.status === "offline").length;

    let msg = `📊 *RESUMEN DE RED*\n`;
    msg += `${"─".repeat(24)}\n`;
    msg += `🟢 En línea: ${online}  |  🔴 Caídos: ${offline}\n\n`;

    for (const device of allDevices) {
      const icon = device.status === "online" ? "🟢" : "🔴";
      msg += `${icon} *${device.name}*\n`;

      const [sys] = await db
        .select().from(systemMetrics)
        .where(eq(systemMetrics.deviceId, device.id))
        .orderBy(desc(systemMetrics.timestamp)).limit(1);

      const [lat] = await db
        .select().from(latencyMetrics)
        .where(eq(latencyMetrics.deviceId, device.id))
        .orderBy(desc(latencyMetrics.timestamp)).limit(1);

      if (sys) {
        const cpuBar = (sys.cpuLoad ?? 0) > 80 ? "🔴" : (sys.cpuLoad ?? 0) > 50 ? "🟡" : "🟢";
        const memUsed = sys.totalMemory && sys.freeMemory
          ? (((sys.totalMemory - sys.freeMemory) / sys.totalMemory) * 100).toFixed(0) : "?";
        msg += `   CPU: ${cpuBar} ${sys.cpuLoad ?? "?"}%\n`;
        msg += `   RAM: ${memUsed}%\n`;
        msg += `   Uptime: ${sys.uptime || "?"}\n`;
      }

      if (lat) {
        const latIcon = (lat.rttAvg ?? 0) > 150 ? "🔴" : (lat.rttAvg ?? 0) > 80 ? "🟡" : "🟢";
        msg += `   Ping: ${latIcon} ${lat.rttAvg ?? "?"}ms\n`;
        msg += `   Pérdida: ${lat.packetLoss ?? 0}%\n`;
      }

      if (device.status === "online" && device.wanInterfaceName) {
        const wanName = device.wanInterfaceName;
        const wanIfaces = await db
          .select()
          .from(interfaceMetrics)
          .where(eq(interfaceMetrics.deviceId, device.id))
          .orderBy(desc(interfaceMetrics.timestamp))
          .limit(10);

        const wanEntries = wanIfaces.filter((i) => i.interfaceName === wanName);

        if (wanEntries.length >= 2) {
          const t0 = wanEntries[0].timestamp;
          const t1 = wanEntries[1].timestamp;
          if (t0 && t1) {
            const dt = Math.max(1, (t0.getTime() - t1.getTime()) / 1000);
            const rxRate = Math.max(0, ((wanEntries[0].rxBytes ?? 0) - (wanEntries[1].rxBytes ?? 0)) * 8 / dt);
            const txRate = Math.max(0, ((wanEntries[0].txBytes ?? 0) - (wanEntries[1].txBytes ?? 0)) * 8 / dt);
            const fmtBps = (bps: number) => bps > 1_000_000 ? `${(bps / 1_000_000).toFixed(1)} Mbps` : bps > 1_000 ? `${(bps / 1_000).toFixed(0)} Kbps` : `${bps} bps`;
            msg += `   WAN (${wanName}):\n`;
            msg += `      ⬇️ Descarga: ${fmtBps(rxRate)}\n`;
            msg += `      ⬆️ Subida: ${fmtBps(txRate)}\n`;
          }
        }
      }

      msg += `\n`;
    }

    await sendTelegramMessage(botToken, chatId, msg);
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

    const down: string[] = [];
    const up: string[] = [];

    for (const ant of allAntennas) {
      if (ant.ip && ant.deviceId) {
        const [device] = await db.select().from(devices).where(eq(devices.id, ant.deviceId));
        if (device && device.status === "online") {
          const result = await pingFromDevice(toMikroTikDevice(device), ant.ip, 3);
          if (result.success) {
            up.push(`${ant.name} — ${ant.ip} — ${result.rttAvg}ms`);
          } else {
            down.push(`${ant.name} — ${ant.ip}`);
          }
        } else {
          down.push(`${ant.name} — ${ant.ip} (router offline)`);
        }
      } else {
        down.push(`${ant.name} — ${ant.ip || "sin IP"}`);
      }
    }

    let msg = "";
    if (down.length > 0) {
      msg += `🔴 *CAÍDAS (${down.length})*\n${down.map((l) => `  • ${l}`).join("\n")}\n\n`;
    }
    if (up.length > 0) {
      msg += `🟢 *PRENDIDAS (${up.length})*\n${up.map((l) => `  • ${l}`).join("\n")}`;
    }

    await sendTelegramMessage(botToken, chatId, msg || "No hay antenas.");
    return;
  }

  if (command === "/addantena") {
    const allDevices = await db.select().from(devices);

    conversationState.set(chatId, {
      type: "antenna",
      session: {
        step: "enter_name",
        name: "",
        ip: "",
        deviceId: null,
        deviceList: allDevices,
        location: "",
      },
    });

    await sendTelegramMessage(botToken, chatId,
      `*Agregar Antena — Paso 1/4*\n\nEscribe el nombre de la antena:\n(Ej: Sector Norte, Torre A)`
    );
    return;
  }

  if (command === "/leases") {
    await sendTelegramMessage(botToken, chatId, "⏳ Consultando leases...");
    try {
      const device = await getFirstOnlineDevice();
      if (!device) {
        await sendTelegramMessage(botToken, chatId, "No hay dispositivos en línea.");
        return;
      }

      const allLeases = await fetchDhcpLeases(device);
      const activeLeases = allLeases.filter((l) => l.status === "bound");

      if (activeLeases.length === 0) {
        await sendTelegramMessage(botToken, chatId, "No hay leases activos.");
        return;
      }

      const lines = activeLeases.map((l) => {
        const type = l.dynamic ? "DHCP" : "Estático";
        return `🟢 ${l.address} — ${l.hostName || "sin nombre"} — ${type}`;
      });

      await sendTelegramMessage(botToken, chatId, `📋 *Leases Activos — ${device.name}* (${activeLeases.length})\n\n${lines.join("\n")}`);
    } catch (e) {
      console.error("Leases error:", e);
      await sendTelegramMessage(botToken, chatId, "⚠️ Error al consultar leases. Verifica la conexión del router.");
    }
    return;
  }

  if (command === "/provision") {
    try {
      const device = await getFirstOnlineDevice();
      if (!device) {
        await sendTelegramMessage(botToken, chatId, "No hay dispositivos en línea.");
        return;
      }

      const allLeases = await fetchDhcpLeases(device);
      const dynamicLeases = allLeases.filter((l) => l.dynamic && l.status === "bound");

      if (dynamicLeases.length === 0) {
        await sendTelegramMessage(botToken, chatId, "No hay leases dinámicos activos para aprovisionar.");
        return;
      }

      conversationState.set(chatId, {
        type: "provision",
        session: {
          step: "select_lease",
          device,
          leases: dynamicLeases,
          selectedLease: dynamicLeases[0],
          clientName: "",
          arpInterface: "",
        },
      });

      const lines = dynamicLeases.map((l, i) =>
        `${i + 1}. 🟢 ${l.address} — ${l.hostName || "sin nombre"} — ${l.macAddress}`
      );

      await sendTelegramMessage(botToken, chatId,
        `*Paso 1/4 — Seleccionar cliente*\n\n` +
        `📋 *Leases dinámicos en ${device.name}:*\n\n${lines.join("\n")}\n\n` +
        `Escribe el *número* del cliente:\n(o /cancel para cancelar)`
      );
    } catch (e) {
      console.error("Provision error:", e);
      await sendTelegramMessage(botToken, chatId, "⚠️ Error al consultar leases. Verifica la conexión del router.");
    }
    return;
  }

  if (command === "/queues") {
    await sendTelegramMessage(botToken, chatId, "⏳ Consultando tráfico...");
    try {
      const device = await getFirstOnlineDevice();
      if (!device) {
        await sendTelegramMessage(botToken, chatId, "No hay dispositivos en línea.");
        return;
      }

      const queues = await fetchSimpleQueues(device);
      const activeQueues = queues.filter((q) => {
        const rateParts = (q.rate || "0/0").split("/");
        const rUp = parseInt(rateParts[0] || "0", 10);
        const rDown = parseInt(rateParts[1] || "0", 10);
        return rUp > 0 || rDown > 0;
      });

      if (activeQueues.length === 0) {
        await sendTelegramMessage(botToken, chatId, "No hay clientes con tráfico activo en este momento.");
        return;
      }

      const fmtRate = (bps: number) => bps > 1_000_000 ? `${(bps / 1_000_000).toFixed(1)} Mbps` : bps > 1_000 ? `${(bps / 1_000).toFixed(0)} Kbps` : `${bps} bps`;

      const lines = activeQueues.map((q) => {
        const rateParts = (q.rate || "0/0").split("/");
        const rUp = parseInt(rateParts[0] || "0", 10);
        const rDown = parseInt(rateParts[1] || "0", 10);
        return `🟢 *${q.name}* — ${q.target.replace("/32", "")}\n   ${fmtRate(rUp)}↑ / ${fmtRate(rDown)}↓`;
      });

      await sendTelegramMessage(botToken, chatId, `⚡ *Clientes con Tráfico — ${device.name}* (${activeQueues.length})\n\n${lines.join("\n\n")}`);
    } catch (e) {
      console.error("Queues error:", e);
      await sendTelegramMessage(botToken, chatId, "⚠️ Error al consultar colas. Verifica la conexión del router.");
    }
    return;
  }

  await sendTelegramMessage(botToken, chatId, "Comando no reconocido. Usa /help para ver los comandos disponibles.");
}

export async function pollTelegramUpdates() {
  try {
    const [config] = await db.select().from(telegramConfig).limit(1);
    if (!config || !config.enabled) return;

    const offset = (config.lastPollUpdateId || 0) + 1;

    const res = await fetch(
      `https://api.telegram.org/bot${config.botToken}/getUpdates?offset=${offset}&timeout=1`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) {
      console.error("Telegram getUpdates failed:", res.status);
      return;
    }

    const data = await res.json();
    if (!data.ok) {
      console.error("Telegram getUpdates error:", data.description);
      return;
    }
    if (!data.result || data.result.length === 0) return;

    for (const update of data.result as TelegramUpdate[]) {
      if (update.message?.text) {
        try {
          await processCommand(config.botToken, String(update.message.chat.id), update.message.text);
        } catch (e) {
          console.error("Telegram command error:", e);
          await sendTelegramMessage(config.botToken, String(update.message.chat.id), "⚠️ Error procesando el comando. Intenta de nuevo.");
        }
      }
      await db
        .update(telegramConfig)
        .set({ lastPollUpdateId: update.update_id })
        .where(eq(telegramConfig.id, config.id));
    }
  } catch (e) {
    console.error("Telegram poll error:", e);
  }
}

async function getAlertState(alertType: string, targetId: number) {
  try {
    const [existing] = await db
      .select().from(telegramAlertHistory)
      .where(and(
        eq(telegramAlertHistory.alertType, alertType),
        eq(telegramAlertHistory.targetId, targetId)
      ));
    return existing || null;
  } catch {
    return null;
  }
}

async function updateAlertState(alertType: string, targetId: number, targetName: string, state: string) {
  try {
    const existing = await getAlertState(alertType, targetId);
    if (existing) {
      await db.update(telegramAlertHistory)
        .set({ lastState: state, lastNotifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(telegramAlertHistory.id, existing.id));
    } else {
      await db.insert(telegramAlertHistory).values({
        alertType, targetId, targetName, lastState: state, lastNotifiedAt: new Date(),
      });
    }
  } catch {}
}

export async function checkAndSendAlerts() {
  try {
    const [config] = await db.select().from(telegramConfig).limit(1);
    if (!config || !config.enabled) return;

    const allDevices = await db.select().from(devices);
    const allAntennas = await db.select().from(antennas);
    const messages: string[] = [];

  for (const device of allDevices) {
    if (config.alertDeviceOffline) {
      const prevState = await getAlertState("device_status", device.id);
      const currentState = device.status;

      if (!prevState) {
        if (currentState === "offline") {
          messages.push(`🔴 *${device.name}* (${device.host}) está FUERA DE LÍNEA`);
        }
        await updateAlertState("device_status", device.id, device.name, currentState);
      } else if (prevState.lastState !== currentState) {
        if (currentState === "offline") {
          messages.push(`🔴 *${device.name}* (${device.host}) se CAYÓ`);
        } else if (currentState === "online") {
          messages.push(`🟢 *${device.name}* (${device.host}) se LEVANTÓ`);
        }
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
    if (!config.alertAntennas) break;
    if (!ant.ip || !ant.deviceId) continue;
    const [device] = await db.select().from(devices).where(eq(devices.id, ant.deviceId));
    if (!device || device.status !== "online") continue;

    const result = await pingFromDevice(toMikroTikDevice(device), ant.ip, 3);
    const currentState = result.success ? "up" : "down";
    const prevState = await getAlertState("antenna_status", ant.id);

    if (!prevState) {
      if (currentState === "down") {
        messages.push(`🔴📡 *${ant.name}* (${ant.ip}) está CAÍDA`);
      }
      await updateAlertState("antenna_status", ant.id, ant.name, currentState);
    } else if (prevState.lastState !== currentState) {
      if (currentState === "down") {
        messages.push(`🔴📡 *${ant.name}* (${ant.ip}) se CAYÓ`);
      } else {
        messages.push(`🟢📡 *${ant.name}* (${ant.ip}) se LEVANTÓ — ${result.rttAvg}ms`);
      }
      await updateAlertState("antenna_status", ant.id, ant.name, currentState);
    }
  }

  if (messages.length > 0) {
    await broadcastToActiveUsers(config.botToken, `⚠️ *Alertas*\n\n${messages.join("\n")}`);
  }
  } catch (e) {
    console.error("checkAndSendAlerts error:", e);
  }
}
