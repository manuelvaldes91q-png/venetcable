const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `Eres un ingeniero de redes experto en MikroTik RouterOS con más de 15 años de experiencia en ISPs.

CAPACIDADES:
- Analizar configuraciones de MikroTik (firewall, NAT, colas, DHCP, rutas, interfaces)
- Detectar problemas de seguridad (puertos abiertos, reglas mal configuradas)
- Optimizar rendimiento (colas, QoS, balanceo de carga)
- Generar scripts RouterOS listos para copiar y pegar
- Diagnosticar fallas de conectividad
- Recomendar mejores prácticas para ISPs

REGLAS:
- Responde SIEMPRE en español
- Cuando generes scripts, usa formato de comandos RouterOS CLI (listos para terminal)
- Sé directo y específico
- Si detectas un problema crítico, marca como "CRÍTICO"
- Si es una mejora opcional, marca como "RECOMENDACIÓN"
- Incluye el comando exacto de RouterOS cuando sugieras cambios
- Explica el "por qué" de cada recomendación
- Si no tienes suficiente información, pide más datos específicos`;

export async function analyzeWithAI(
  data: string,
  question?: string,
  retries = 2
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return "⚠️ No hay API key de OpenRouter configurada.";
  }

  const userMessage = question
    ? `PREGUNTA DEL USUARIO:\n${question}\n\nDATOS ACTUALES DE LA RED:\n${data}`
    : `Analiza estos datos de monitoreo y detecta problemas:\n\n${data}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://mikrotik-monitor.local",
        },
        body: JSON.stringify({
          model: "openrouter/free",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
          max_tokens: 1500,
          temperature: 0.2,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const err = await res.text();
      if (res.status === 429 && attempt < retries) {
        const waitMs = (attempt + 1) * 10000;
        console.log(`AI rate limited, retrying in ${waitMs / 1000}s...`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      console.error("AI API error:", res.status, err);
      return `⚠️ Error de la API (${res.status})`;
    }

    const result = await res.json();
    return result.choices?.[0]?.message?.content || "Sin respuesta de la IA.";
  } catch (e) {
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    console.error("AI error:", e);
  }
  }
  return "⚠️ Error al conectar con la IA. Intenta más tarde.";
}

export function buildFullMikroTikSnapshot(configData: {
  system: Record<string, string> | null;
  interfaces: Record<string, string>[];
  routes: Record<string, string>[];
  firewallRules: Record<string, string>[];
  natRules: Record<string, string>[];
  dhcpLeases: Record<string, string>[];
  simpleQueues: Record<string, string>[];
  arpEntries: Record<string, string>[];
}): string {
  let snap = "";

  if (configData.system) {
    snap += "=== SISTEMA ===\n";
    snap += `RouterOS: ${configData.system.version || "?"}\n`;
    snap += `Modelo: ${configData.system.boardName || "?"}\n`;
    snap += `Uptime: ${configData.system.uptime || "?"}\n`;
    snap += `CPU: ${configData.system.cpuLoad || "?"}%\n`;
    snap += `RAM: ${configData.system.freeMemory || "?"} libre de ${configData.system.totalMemory || "?"}\n\n`;
  }

  if (configData.interfaces.length > 0) {
    snap += "=== INTERFACES ===\n";
    for (const iface of configData.interfaces) {
      snap += `${iface.name}: ${iface.running === "true" ? "UP" : "DOWN"} | RX: ${iface.rxBytes || "0"} TX: ${iface.txBytes || "0"}\n`;
    }
    snap += "\n";
  }

  if (configData.routes.length > 0) {
    snap += "=== RUTAS ===\n";
    for (const route of configData.routes.slice(0, 20)) {
      snap += `${route.dstAddress || "default"} via ${route.gateway || "?"} (${route.routingMark || "main"}) [${route.protocol || "?"}] ${route.active === "true" ? "ACTIVA" : "INACTIVA"}\n`;
    }
    snap += "\n";
  }

  if (configData.firewallRules.length > 0) {
    snap += "=== FIREWALL ===\n";
    for (const rule of configData.firewallRules.slice(0, 25)) {
      snap += `[${rule.chain || "?"}] ${rule.action || "?"} ${rule.srcAddress || ""} ${rule.dstAddress || ""} ${rule.protocol || ""} ${rule.dstPort || ""} ${rule.comment || ""}\n`;
    }
    snap += "\n";
  }

  if (configData.natRules.length > 0) {
    snap += "=== NAT ===\n";
    for (const rule of configData.natRules.slice(0, 15)) {
      snap += `[${rule.chain || "?"}] ${rule.action || "?"} ${rule.srcAddress || ""}→${rule.toAddresses || rule.toPorts || ""} ${rule.comment || ""}\n`;
    }
    snap += "\n";
  }

  if (configData.dhcpLeases.length > 0) {
    snap += `=== DHCP (${configData.dhcpLeases.length} leases) ===\n`;
    for (const lease of configData.dhcpLeases.slice(0, 20)) {
      snap += `${lease.address || "?"} ${lease.hostName || "sin-nombre"} ${lease.macAddress || "?"} ${lease.dynamic === "true" ? "DHCP" : "ESTÁTICO"} ${lease.status || "?"}\n`;
    }
    snap += "\n";
  }

  if (configData.simpleQueues.length > 0) {
    snap += `=== COLAS (${configData.simpleQueues.length}) ===\n`;
    for (const q of configData.simpleQueues.slice(0, 15)) {
      snap += `${q.name}: ${q.target || "?"} límite=${q.maxLimit || "?"} rate=${q.rate || "0/0"} ${q.disabled === "true" ? "DESACTIVADA" : ""}\n`;
    }
    snap += "\n";
  }

  if (configData.arpEntries.length > 0) {
    snap += `=== ARP (${configData.arpEntries.length}) ===\n`;
    for (const arp of configData.arpEntries.slice(0, 15)) {
      snap += `${arp.address || "?"} → ${arp.macAddress || "?"} en ${arp.interface || "?"} ${arp.disabled === "true" ? "DESACTIVADO" : ""}\n`;
    }
    snap += "\n";
  }

  return snap;
}

export function buildNetworkSnapshot(
  devices: { name: string; host: string; status: string }[],
  metrics: { deviceName: string; cpu: number | null; ram: number | null; uptime: string | null; ping: number | null; loss: number | null }[],
  antennas: { name: string; ip: string | null; status: string }[],
  queues: { name: string; rate: string }[]
): string {
  let snap = "=== ESTADO DE LA RED ===\n\n";

  snap += "DISPOSITIVOS:\n";
  for (const d of devices) {
    snap += `- ${d.name} (${d.host}): ${d.status}\n`;
  }

  snap += "\nMÉTRICAS:\n";
  for (const m of metrics) {
    snap += `- ${m.deviceName}: CPU=${m.cpu ?? "?"}%, RAM=${m.ram ?? "?"}%, Ping=${m.ping ?? "?"}ms, Pérdida=${m.loss ?? "?"}%, Uptime=${m.uptime || "?"}\n`;
  }

  snap += "\nANTENAS:\n";
  for (const a of antennas) {
    snap += `- ${a.name} (${a.ip || "sin IP"}): ${a.status}\n`;
  }

  if (queues.length > 0) {
    snap += "\nCLIENTES ACTIVOS:\n";
    for (const q of queues) {
      snap += `- ${q.name}: ${q.rate}\n`;
    }
  }

  return snap;
}
