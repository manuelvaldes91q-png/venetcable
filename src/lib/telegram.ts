import { db } from "@/db";
import {
  telegramConfig, telegramUsers, telegramAlertHistory,
  devices, systemMetrics, latencyMetrics, antennas, interfaceMetrics,
} from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import {
  type MikroTikDevice, type DhcpLease, pingFromDevice,
  fetchDhcpLeases, fetchSimpleQueues, fetchInterfaceNames, fetchArpEntries, fetchInterfaceTraffic,
  fetchFullConfig, fetchSystemResources,
  convertDhcpToStatic, addArpBinding, addSimpleQueue, toggleArp, toggleQueue,
} from "@/lib/mikrotik";
import { analyzeMikroTik } from "@/lib/network-analyzer";
import { processMessage } from "@/lib/network-agent";

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

interface CutActivateSession {
  device: MikroTikDevice;
  clients: { queue: { id: string; name: string; target: string }; ip: string; arp: { id: string } | undefined; isDisabled: boolean }[];
}

const conversationState = new Map<string, { type: "provision"; session: ProvisionSession } | { type: "antenna"; session: AntennaSession } | { type: "cut"; session: CutActivateSession } | { type: "activate"; session: CutActivateSession } | { type: "select_device"; session: { devices: typeof devices.$inferSelect[] } }>();

const selectedDevice = new Map<string, number>();

async function getUserDevice(chatId: string): Promise<MikroTikDevice | null> {
  const deviceId = selectedDevice.get(chatId);
  if (deviceId) {
    const [device] = await db.select().from(devices).where(eq(devices.id, deviceId));
    if (device && device.status === "online") return toMikroTikDevice(device);
  }
  return getFirstOnlineDevice();
}

async function sendTelegramMessage(botToken: string, chatId: string | number, text: string, keyboard?: boolean) {
  try {
    const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: "Markdown" };
    if (keyboard) {
      body.reply_markup = {
        keyboard: [
          [{ text: "📊 Estado" }, { text: "🖥 Dispositivos" }],
          [{ text: "📡 Antenas" }, { text: "🔌 Puertos" }],
          [{ text: "📋 Leases" }, { text: "⚡ Colas" }],
          [{ text: "✂️ Cortar" }, { text: "🔌 Activar" }],
          [{ text: "🔧 Aprovisionar" }, { text: "➕ Agregar Antena" }],
          [{ text: "🖥 VPS" }, { text: "🤖 IA" }],
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
  "🖥 Dispositivos": "/devices",
  "📡 Antenas": "/antenas",
  "🔌 Puertos": "/puertos",
  "📋 Leases": "/leases",
  "⚡ Colas": "/queues",
  "✂️ Cortar": "/cortar",
  "🔌 Activar": "/activar",
  "🔧 Aprovisionar": "/provision",
  "➕ Agregar Antena": "/addantena",
  "🖥 VPS": "/vps",
  "🤖 IA": "/ai",
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

async function handleCutActivateInput(botToken: string, chatId: string, text: string) {
  const state = conversationState.get(chatId);
  if (!state || (state.type !== "cut" && state.type !== "activate")) return false;

  const session = state.session;
  const input = text.trim();

  if (input.toLowerCase() === "/cancel") {
    conversationState.delete(chatId);
    await sendTelegramMessage(botToken, chatId, "❌ Operación cancelada.");
    return true;
  }

  const num = parseInt(input, 10);
  if (isNaN(num) || num < 1 || num > session.clients.length) {
    await sendTelegramMessage(botToken, chatId, `Número inválido. Escribe 1-${session.clients.length} o /cancel.`);
    return true;
  }

  const client = session.clients[num - 1];
  if (!client.arp) {
    conversationState.delete(chatId);
    await sendTelegramMessage(botToken, chatId, "⚠️ Este cliente no tiene ARP asociado. No se puede modificar.");
    return true;
  }

  const isCut = state.type === "cut";
  const enable = !isCut;

  try {
    await toggleArp(session.device, client.arp.id, enable);
    await toggleQueue(session.device, client.queue.id, enable);
    conversationState.delete(chatId);

    const icon = isCut ? "✂️" : "🔌";
    const action = isCut ? "CORTADO" : "ACTIVADO";
    await sendTelegramMessage(botToken, chatId,
      `${icon} *Cliente ${action}*\n\n` +
      `👤 *${client.queue.name}*\n` +
      `📍 ${client.ip}\n` +
      `${isCut ? "🔴 ARP desactivado\n🔴 Cola desactivada" : "🟢 ARP activado\n🟢 Cola activada"}\n\n` +
      `${isCut ? "❌ Servicio interrumpido" : "✅ Servicio restaurado"}`
    );
  } catch (e) {
    conversationState.delete(chatId);
    console.error("CutActivate error:", e);
    await sendTelegramMessage(botToken, chatId, "❌ Error de conexión con el router.");
  }

  return true;
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

  const isCutActivate = await handleCutActivateInput(botToken, chatId, text);
  if (isCutActivate) return;

  const command = text.trim().toLowerCase();

  if (command === "/start" || command === "/help") {
    const help = [
      `🌐 *MikroTik Monitor*`,
      ``,
      `━━━ 📡 *Monitoreo* ━━━`,
      `📊 Estado — Resumen en tiempo real`,
      `🖥 Dispositivos — Seleccionar router`,
      `🔌 Puertos — Estado de puertos físicos`,
      `📡 Antenas — Estado up/down`,
      `💾 CPU — Carga del procesador`,
      `📶 Latencia — Ping y pérdida`,
      ``,
      `━━━ 🔧 *Aprovisionamiento* ━━━`,
      `📋 Leases — Clientes DHCP`,
      `🔧 Aprovisionar — Nuevo cliente`,
      `⚡ Colas — Tráfico en vivo`,
      `✂️ Cortar — Desconectar cliente`,
      `🔌 Activar — Restaurar cliente`,
      `➕ Agregar — Nueva antena`,
      ``,
      `━━━ 🤖 *IA y VPS* ━━━`,
      `🤖 Preguntar — /ai tu pregunta`,
      `🖥 VPS — Estado del servidor`,
      ``,
      `Usa los botones de abajo 👇`,
    ].join("\n");
    await sendTelegramMessage(botToken, chatId, help, true);
    return;
  }

  if (command === "/status") {
    await sendTelegramMessage(botToken, chatId, "⏳ Consultando estado en tiempo real...");

    const allDevices = await db.select().from(devices);
    if (allDevices.length === 0) {
      await sendTelegramMessage(botToken, chatId, "⚠️ No hay dispositivos configurados.");
      return;
    }

    const now = new Date().toLocaleString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit", day: "2-digit", month: "short" });
    let msg = `🌐 *RESUMEN DE RED*\n`;
    msg += `📅 ${now}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;

    for (const device of allDevices) {
      const mikrotik = toMikroTikDevice(device);

      try {
        const sys = await fetchSystemResources(mikrotik);
        const ping = await pingFromDevice(mikrotik, "8.8.8.8", 3);

        const cpu = sys.cpuLoad;
        const cpuIcon = cpu > 80 ? "🔴" : cpu > 50 ? "🟡" : "🟢";
        const memUsed = sys.totalMemory && sys.freeMemory
          ? (((sys.totalMemory - sys.freeMemory) / sys.totalMemory) * 100).toFixed(0) : "?";
        const pingIcon = (ping.rttAvg ?? 0) > 150 ? "🔴" : (ping.rttAvg ?? 0) > 80 ? "🟡" : "🟢";

        msg += `\n🟢 *${device.name}* — _EN LÍNEA_\n`;
        msg += `  ┣ 💾 CPU: ${cpuIcon} *${cpu}%*\n`;
        msg += `  ┣ 🧠 RAM: *${memUsed}%*\n`;
        msg += `  ┣ ⏱ Uptime: _${sys.uptime}_\n`;
        msg += `  ┣ 🏷 RouterOS: _${sys.version}_\n`;
        msg += `  ┣ 📦 Modelo: _${sys.boardName}_\n`;
        if (ping.success) {
          msg += `  ┗ 📶 Ping 8.8.8.8: ${pingIcon} *${ping.rttAvg}ms*\n`;
        } else {
          msg += `  ┗ 📶 Ping 8.8.8.8: 🔴 *Sin conexión a internet*\n`;
        }
      } catch {
        msg += `\n🔴 *${device.name}* — _FUERA DE LÍNEA_\n`;
      }
    }

    await sendTelegramMessage(botToken, chatId, msg);
    return;
  }

  if (command === "/devices" || command.startsWith("/seleccionar")) {
    const allDevices = await db.select().from(devices);
    if (allDevices.length === 0) {
      await sendTelegramMessage(botToken, chatId, "⚠️ No hay dispositivos configurados.");
      return;
    }

    const currentId = selectedDevice.get(chatId);

    if (command.startsWith("/seleccionar ")) {
      const num = parseInt(command.replace("/seleccionar ", ""), 10);
      if (isNaN(num) || num < 1 || num > allDevices.length) {
        await sendTelegramMessage(botToken, chatId, `Número inválido. Usa 1-${allDevices.length}`);
        return;
      }
      const dev = allDevices[num - 1];
      selectedDevice.set(chatId, dev.id);
      await sendTelegramMessage(botToken, chatId,
        `✅ *Dispositivo seleccionado*\n\n` +
        `${dev.status === "online" ? "🟢" : "🔴"} *${dev.name}*\n` +
        `📍 ${dev.host}:${dev.port}\n\n` +
        `Todos los comandos ahora usan este dispositivo.`
      );
      return;
    }

    let msg = `🖥 *DISPOSITIVOS*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `Actual: ${currentId ? "📌" : "🔄 Auto"}\n\n`;

    allDevices.forEach((d, i) => {
      const icon = d.status === "online" ? "🟢" : "🔴";
      const selected = d.id === currentId ? " ← seleccionado" : "";
      msg += `${i + 1}. ${icon} *${d.name}*\n`;
      msg += `   📍 ${d.host}:${d.port}${selected}\n\n`;
    });

    msg += `Para seleccionar: /seleccionar 1`;
    await sendTelegramMessage(botToken, chatId, msg);
    return;
  }

  if (command === "/vps") {
    await sendTelegramMessage(botToken, chatId, "⏳ Consultando VPS...");
    try {
      const { execSync } = await import("child_process");
      const run = (cmd: string) => { try { return execSync(cmd, { encoding: "utf-8", timeout: 5000 }).trim(); } catch { return "?"; } };

      const memInfo = run("free -h | grep Mem");
      const memParts = memInfo.split(/\s+/);
      const cpuInfo = run("top -bn1 | grep '%Cpu'");
      const cpuMatch = cpuInfo.match(/([\d.]+)\s*id/);
      const cpuUsed = cpuMatch ? Math.round(100 - parseFloat(cpuMatch[1])) : 0;
      const diskInfo = run("df -h / | tail -1");
      const diskParts = diskInfo.split(/\s+/);
      const uptime = run("uptime -p").replace("up ", "");
      const hostname = run("hostname");
      const ip = run("hostname -I | awk '{print $1}'");

      let pm2Status = "";
      try {
        const pm2Json = run("pm2 jlist");
        const procs = JSON.parse(pm2Json);
        procs.forEach((p: Record<string, Record<string, unknown>>) => {
          const icon = p.pm2_env?.status === "online" ? "🟢" : "🔴";
          const cpu = p.monit?.cpu ?? 0;
          const mem = ((p.monit?.memory as number) || 0) / 1024 / 1024;
          pm2Status += `  ${icon} *${p.name}* — CPU: ${cpu}% | RAM: ${mem.toFixed(0)}MB\n`;
        });
      } catch { pm2Status = "  No disponible\n"; }

      const cpuIcon = cpuUsed > 80 ? "🔴" : cpuUsed > 50 ? "🟡" : "🟢";
      const memUsed = memParts[1] || "?";
      const memTotal = memParts[1] || "?";

      const msg = `🖥 *ESTADO DEL VPS*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n` +
        `📍 ${hostname} — ${ip}\n` +
        `⏱ Uptime: ${uptime}\n\n` +
        `💾 CPU: ${cpuIcon} *${cpuUsed}%*\n` +
        `🧠 RAM: *${memUsed}* de ${memTotal}\n` +
        `💿 Disco: *${diskParts[2] || "?"}* usado (${diskParts[4] || "?"})\n\n` +
        `📦 *Servicios:*\n${pm2Status}`;

      await sendTelegramMessage(botToken, chatId, msg);
    } catch (e) {
      console.error("VPS error:", e);
      await sendTelegramMessage(botToken, chatId, "❌ Error al consultar VPS.");
    }
    return;
  }

  if (command === "/puertos") {
    await sendTelegramMessage(botToken, chatId, "⏳ Consultando puertos...");
    try {
      const device = await getUserDevice(chatId);
      if (!device) {
        await sendTelegramMessage(botToken, chatId, "⚠️ No hay dispositivos en línea.");
        return;
      }

      const interfaces = await fetchInterfaceTraffic(device);
      const physicalPorts = interfaces.filter((i) =>
        i.name.startsWith("ether") || i.name.startsWith("sfp")
      );

      if (physicalPorts.length === 0) {
        await sendTelegramMessage(botToken, chatId, "🔌 No se encontraron puertos físicos.");
        return;
      }

      const connected = physicalPorts.filter((p) => p.status === "running");
      const disconnected = physicalPorts.filter((p) => p.status !== "running");

      let msg = `🔌 *PUERTOS — ${device.name}*\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `🟢 Conectados: *${connected.length}*  |  🔴 Desconectados: *${disconnected.length}*\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

      if (connected.length > 0) {
        msg += `🟢 *CONECTADOS*\n`;
        connected.forEach((p) => {
          msg += `  ✅ *${p.name}*${p.comment ? ` — _${p.comment}_` : ""}\n`;
        });
        msg += `\n`;
      }

      if (disconnected.length > 0) {
        msg += `🔴 *DESCONECTADOS*\n`;
        disconnected.forEach((p) => {
          msg += `  ❌ *${p.name}*${p.comment ? ` — _${p.comment}_` : ""}\n`;
        });
      }

      await sendTelegramMessage(botToken, chatId, msg);
    } catch (e) {
      console.error("Puertos error:", e);
      await sendTelegramMessage(botToken, chatId, "❌ Error al consultar puertos.");
    }
    return;
  }

  if (command === "/cpu") {
    const allDevices = await db.select().from(devices);
    let msg = `💾 *CARGA DE CPU*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
    for (const device of allDevices) {
      const [latest] = await db
        .select().from(systemMetrics)
        .where(eq(systemMetrics.deviceId, device.id))
        .orderBy(desc(systemMetrics.timestamp)).limit(1);
      if (latest) {
        const cpu = latest.cpuLoad ?? 0;
        const icon = cpu > 80 ? "🔴" : cpu > 50 ? "🟡" : "🟢";
        const bar = "█".repeat(Math.min(10, Math.round(cpu / 10))) + "░".repeat(Math.max(0, 10 - Math.round(cpu / 10)));
        msg += `${icon} *${device.name}*\n`;
        msg += `  \`${bar}\` *${cpu}%*\n\n`;
      }
    }
    await sendTelegramMessage(botToken, chatId, msg || "⚠️ Sin datos de CPU.");
    return;
  }

  if (command === "/latency") {
    const allDevices = await db.select().from(devices);
    let msg = `📶 *LATENCIA Y PÉRDIDA*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
    for (const device of allDevices) {
      const [latest] = await db
        .select().from(latencyMetrics)
        .where(eq(latencyMetrics.deviceId, device.id))
        .orderBy(desc(latencyMetrics.timestamp)).limit(1);
      if (latest) {
        const rtt = latest.rttAvg ?? 0;
        const loss = latest.packetLoss ?? 0;
        const icon = rtt > 150 ? "🔴" : rtt > 80 ? "🟡" : "🟢";
        const lossIcon = loss > 10 ? "🔴" : loss > 0 ? "🟡" : "🟢";
        msg += `${icon} *${device.name}*\n`;
        msg += `  ┣ 📶 Ping: *${rtt}ms*\n`;
        msg += `  ┗ ❌ Pérdida: ${lossIcon} *${loss}%*\n\n`;
      }
    }
    await sendTelegramMessage(botToken, chatId, msg || "⚠️ Sin datos de latencia.");
    return;
  }

  if (command === "/antenas") {
    const allAntennas = await db.select().from(antennas);
    if (allAntennas.length === 0) {
      await sendTelegramMessage(botToken, chatId, "⚠️ No hay antenas registradas.\nUsa ➕ *Agregar Antena* para agregar una.");
      return;
    }

    await sendTelegramMessage(botToken, chatId, "⏳ Verificando antenas...");

    const down: string[] = [];
    const up: string[] = [];

    for (const ant of allAntennas) {
      if (ant.ip && ant.deviceId) {
        const [device] = await db.select().from(devices).where(eq(devices.id, ant.deviceId));
        if (device && device.status === "online") {
          const result = await pingFromDevice(toMikroTikDevice(device), ant.ip, 3);
          if (result.success) {
            up.push(`✅ *${ant.name}*\n  📍 ${ant.ip} — _${result.rttAvg}ms_`);
          } else {
            down.push(`❌ *${ant.name}*\n  📍 ${ant.ip}`);
          }
        } else {
          down.push(`⚠️ *${ant.name}*\n  📍 ${ant.ip} — _router offline_`);
        }
      } else {
        down.push(`⚠️ *${ant.name}*\n  📍 ${ant.ip || "sin IP"}`);
      }
    }

    let msg = `📡 *ESTADO DE ANTENAS*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🟢 Prendidas: *${up.length}*  |  🔴 Caídas: *${down.length}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (down.length > 0) {
      msg += `🔴 *ANTENAS CAÍDAS*\n${down.join("\n\n")}\n\n`;
    }
    if (up.length > 0) {
      msg += `🟢 *ANTENAS PRENDIDAS*\n${up.join("\n\n")}`;
    }

    await sendTelegramMessage(botToken, chatId, msg);
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
      `➕ *AGREGAR ANTENA*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `Paso 1 de 4 — _Nombre_\n\n` +
      `Escribe el nombre de la antena:\n` +
      `📌 Ejemplo: Sector Norte, Torre A\n\n` +
      `Cancelar en cualquier momento: /cancel`
    );
    return;
  }

  if (command === "/leases") {
    await sendTelegramMessage(botToken, chatId, "⏳ Consultando leases...");
    try {
      const device = await getUserDevice(chatId);
      if (!device) {
        await sendTelegramMessage(botToken, chatId, "⚠️ No hay dispositivos en línea.");
        return;
      }

      const allLeases = await fetchDhcpLeases(device);
      const activeLeases = allLeases.filter((l) => l.status === "bound");

      if (activeLeases.length === 0) {
        await sendTelegramMessage(botToken, chatId, "📋 No hay leases activos en este momento.");
        return;
      }

      let msg = `📋 *LEASES ACTIVOS*\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `🖥 ${device.name} | Total: *${activeLeases.length}*\n\n`;

      activeLeases.forEach((l, i) => {
        const type = l.dynamic ? "DHCP" : "Estático";
        msg += `${i + 1}. 🟢 *${l.address}*\n`;
        msg += `   👤 ${l.hostName || "sin nombre"}\n`;
        msg += `   🏷 ${type}\n\n`;
      });

      msg += `Usa 🔧 *Aprovisionar* para convertir un cliente DHCP a estático.`;
      await sendTelegramMessage(botToken, chatId, msg);
    } catch (e) {
      console.error("Leases error:", e);
      await sendTelegramMessage(botToken, chatId, "❌ Error al consultar leases.\nVerifica la conexión del router.");
    }
    return;
  }

  if (command === "/provision") {
    try {
      const device = await getUserDevice(chatId);
      if (!device) {
        await sendTelegramMessage(botToken, chatId, "⚠️ No hay dispositivos en línea.");
        return;
      }

      const allLeases = await fetchDhcpLeases(device);
      const dynamicLeases = allLeases.filter((l) => l.dynamic && l.status === "bound");

      if (dynamicLeases.length === 0) {
        await sendTelegramMessage(botToken, chatId, "📋 No hay leases dinámicos activos para aprovisionar.");
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

      let msg = `🔧 *APROVISIONAR CLIENTE*\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `Paso 1 de 4 — _Seleccionar cliente_\n\n`;
      msg += `🖥 ${device.name}\n\n`;

      dynamicLeases.forEach((l, i) => {
        msg += `${i + 1}. 🟢 *${l.address}*\n`;
        msg += `   👤 ${l.hostName || "sin nombre"}\n`;
        msg += `   🏷 ${l.macAddress}\n\n`;
      });

      msg += `Escribe el *número* del cliente:\n`;
      msg += `❌ Cancelar: /cancel`;

      await sendTelegramMessage(botToken, chatId, msg);
    } catch (e) {
      console.error("Provision error:", e);
      await sendTelegramMessage(botToken, chatId, "❌ Error al consultar leases.\nVerifica la conexión del router.");
    }
    return;
  }

  if (command === "/queues") {
    await sendTelegramMessage(botToken, chatId, "⏳ Consultando tráfico...");
    try {
      const device = await getUserDevice(chatId);
      if (!device) {
        await sendTelegramMessage(botToken, chatId, "⚠️ No hay dispositivos en línea.");
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
        await sendTelegramMessage(botToken, chatId, "⚡ No hay clientes con tráfico activo en este momento.");
        return;
      }

      const fmtRate = (bps: number) => bps > 1_000_000 ? `${(bps / 1_000_000).toFixed(1)} Mbps` : bps > 1_000 ? `${(bps / 1_000).toFixed(0)} Kbps` : `${bps} bps`;

      let msg = `⚡ *TRÁFICO EN VIVO*\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `🖥 ${device.name} | Activos: *${activeQueues.length}*\n\n`;

      activeQueues.forEach((q) => {
        const rateParts = (q.rate || "0/0").split("/");
        const rUp = parseInt(rateParts[0] || "0", 10);
        const rDown = parseInt(rateParts[1] || "0", 10);
        msg += `🟢 *${q.name}*\n`;
        msg += `   📍 ${q.target.replace("/32", "")}\n`;
        msg += `   ⬆️ ${fmtRate(rUp)}  |  ⬇️ ${fmtRate(rDown)}\n\n`;
      });

      msg += `_Actualizado: ${new Date().toLocaleTimeString("es-ES")}_`;
      await sendTelegramMessage(botToken, chatId, msg);
    } catch (e) {
      console.error("Queues error:", e);
      await sendTelegramMessage(botToken, chatId, "❌ Error al consultar colas.\nVerifica la conexión del router.");
    }
    return;
  }

  if (command === "/cortar") {
    await sendTelegramMessage(botToken, chatId, "⏳ Consultando clientes...");
    try {
      const device = await getUserDevice(chatId);
      if (!device) {
        await sendTelegramMessage(botToken, chatId, "⚠️ No hay dispositivos en línea.");
        return;
      }

      const queues = await fetchSimpleQueues(device);
      const arpEntries = await fetchArpEntries(device);

      const clients = queues.map((q) => {
        const ip = q.target.replace("/32", "");
        const arp = arpEntries.find((a) => a.address === ip);
        const isDisabled = arp?.disabled === "true";
        return { queue: q, ip, arp, isDisabled };
      }).filter((c) => !c.isDisabled);

      if (clients.length === 0) {
        await sendTelegramMessage(botToken, chatId, "📋 No hay clientes activos para cortar.");
        return;
      }

      conversationState.set(chatId, {
        type: "cut",
        session: { device, clients },
      });

      let msg = `✂️ *CORTAR CLIENTE*\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `Paso 1 — _Seleccionar cliente_\n\n`;

      clients.forEach((c, i) => {
        msg += `${i + 1}. 🟢 *${c.queue.name}*\n`;
        msg += `   📍 ${c.ip}\n\n`;
      });

      msg += `Escribe el *número* del cliente a cortar:\n`;
      msg += `❌ Cancelar: /cancel`;

      await sendTelegramMessage(botToken, chatId, msg);
    } catch (e) {
      console.error("Cortar error:", e);
      await sendTelegramMessage(botToken, chatId, "❌ Error al consultar clientes.");
    }
    return;
  }

  if (command === "/activar") {
    await sendTelegramMessage(botToken, chatId, "⏳ Consultando clientes cortados...");
    try {
      const device = await getUserDevice(chatId);
      if (!device) {
        await sendTelegramMessage(botToken, chatId, "⚠️ No hay dispositivos en línea.");
        return;
      }

      const queues = await fetchSimpleQueues(device);
      const arpEntries = await fetchArpEntries(device);

      const clients = queues.map((q) => {
        const ip = q.target.replace("/32", "");
        const arp = arpEntries.find((a) => a.address === ip);
        const isDisabled = arp?.disabled === "true";
        return { queue: q, ip, arp, isDisabled };
      }).filter((c) => c.isDisabled);

      if (clients.length === 0) {
        await sendTelegramMessage(botToken, chatId, "📋 No hay clientes cortados para activar.");
        return;
      }

      conversationState.set(chatId, {
        type: "activate",
        session: { device, clients },
      });

      let msg = `🔌 *ACTIVAR CLIENTE*\n`;
      msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `Paso 1 — _Seleccionar cliente_\n\n`;

      clients.forEach((c, i) => {
        msg += `${i + 1}. 🔴 *${c.queue.name}*\n`;
        msg += `   📍 ${c.ip}\n\n`;
      });

      msg += `Escribe el *número* del cliente a activar:\n`;
      msg += `❌ Cancelar: /cancel`;

      await sendTelegramMessage(botToken, chatId, msg);
    } catch (e) {
      console.error("Activar error:", e);
      await sendTelegramMessage(botToken, chatId, "❌ Error al consultar clientes.");
    }
    return;
  }

  if (command === "/ai" || command.startsWith("/ai ")) {
    const question = command.startsWith("/ai ") ? text.slice(4).trim() : undefined;

    if (!question && command === "/ai") {
      await sendTelegramMessage(botToken, chatId,
        `🤖 *Agente de Redes MikroTik*\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Háblame como si fuera un ingeniero:\n\n` +
        `💬 Conversación:\n` +
        `  /ai hola\n` +
        `  /ai ¿quién eres?\n\n` +
        `🔍 Análisis:\n` +
        `  /ai analiza mi red\n` +
        `  /ai revisa mi firewall\n` +
        `  /ai ¿por qué está lento?\n` +
        `  /ai revisa las colas\n\n` +
        `🔧 Configuración:\n` +
        `  /ai necesito vpn\n` +
        `  /ai cómo hago backup\n` +
        `  /ai configura dns\n\n` +
        `🔒 Seguridad:\n` +
        `  /ai puertos abiertos\n` +
        `  /ai dns abierto\n` +
        `  /ai winbox seguro?`
      );
      return;
    }

    await sendTelegramMessage(botToken, chatId, "🤖 Consultando configuración del router...");

    try {
      const device = await getUserDevice(chatId);
      if (!device) {
        await sendTelegramMessage(botToken, chatId, "⚠️ No hay dispositivos en línea.");
        return;
      }

      await sendTelegramMessage(botToken, chatId, "⏳ Analizando...");

      const config = await fetchFullConfig(device);
      const findings = analyzeMikroTik(config);
      const response = processMessage(question || "analiza", {
        config,
        findings,
        deviceName: device.name,
      });

      await sendTelegramMessage(botToken, chatId, response);
    } catch (e) {
      console.error("Analysis error:", e);
      await sendTelegramMessage(botToken, chatId, "❌ Error al analizar el router.");
    }
    return;
  }

  await sendTelegramMessage(botToken, chatId, "❓ Comando no reconocido.\nUsa /help para ver los comandos disponibles.");
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
