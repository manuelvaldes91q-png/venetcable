import { mikrotikKnowledge, searchKnowledge, type KnowledgeEntry } from "@/lib/mikrotik-knowledge";

interface Finding {
  severity: "critical" | "warning" | "info";
  category: string;
  issue: string;
  solution: string;
  command?: string;
  knowledge?: KnowledgeEntry;
}

export type { Finding };

type Config = {
  system: Record<string, string> | null;
  interfaces: Record<string, string>[];
  routes: Record<string, string>[];
  firewallRules: Record<string, string>[];
  natRules: Record<string, string>[];
  dhcpLeases: Record<string, string>[];
  simpleQueues: Record<string, string>[];
  arpEntries: Record<string, string>[];
  connectionTracking: Record<string, string> | null;
  dnsSettings: Record<string, string> | null;
  ntpSettings: Record<string, string> | null;
  users: Record<string, string>[];
  schedulers: Record<string, string>[];
  logs: Record<string, string>[];
  dhcpPools: Record<string, string>[];
  hotspotProfiles: Record<string, string>[];
  firewallAddressLists: Record<string, string>[];
};

function checkFirewall(config: Config, findings: Finding[]) {
  const fw = config.firewallRules;

  if (fw.length === 0) {
    findings.push({
      severity: "critical", category: "🔥 Firewall",
      issue: "Sin reglas de firewall — router completamente abierto",
      solution: "Tu router acepta cualquier conexión entrante. Esto es extremadamente peligroso.",
      command: `/ip firewall filter add chain=input connection-state=established,related action=accept comment="Conexiones establecidas"
/ip firewall filter add chain=input action=drop comment="Bloquear todo"`,
    });
    return;
  }

  const inputRules = fw.filter((r) => r.chain === "input");
  const hasEstablished = inputRules.some((r) => r["connection-state"]?.includes("established"));
  const hasDrop = inputRules.some((r) => r.action === "drop" && !r.srcAddress && !r["dst-port"]);
  const hasFastTrack = fw.some((r) => r.action === "fasttrack-connection");

  if (!hasEstablished) {
    findings.push({
      severity: "critical", category: "🔥 Firewall",
      issue: "Falta regla connection-state=established,related",
      solution: "Sin esta regla, cada paquete se procesa individualmente. CPU al máximo.",
      command: `/ip firewall filter add chain=input connection-state=established,related action=accept place-before=0`,
    });
  }

  if (!hasFastTrack) {
    findings.push({
      severity: "warning", category: "⚡ Rendimiento",
      issue: "FastTrack no configurado",
      solution: "Sin FastTrack, el router procesa cada paquete por CPU. Rendimiento x10 menor.",
      command: `/ip firewall filter add chain=forward connection-state=established,related action=fasttrack-connection
/ip firewall filter add chain=output connection-state=established,related action=fasttrack-connection`,
    });
  }

  if (!hasDrop) {
    findings.push({
      severity: "critical", category: "🔥 Firewall",
      issue: "No hay regla drop al final de input",
      solution: "Todo el tráfico entrante es aceptado. Tu router es vulnerable a ataques.",
      command: `/ip firewall filter add chain=input action=drop comment="Drop todo"`,
    });
  }

  const dangerousPorts: { port: string; name: string; severity: "critical" | "warning" }[] = [
    { port: "8291", name: "Winbox", severity: "critical" },
    { port: "23", name: "Telnet", severity: "critical" },
    { port: "22", name: "SSH", severity: "warning" },
    { port: "80", name: "WebFig", severity: "warning" },
    { port: "443", name: "WebFig SSL", severity: "warning" },
    { port: "8080", name: "HTTP alternativo", severity: "warning" },
    { port: "3128", name: "Proxy", severity: "critical" },
    { port: "1080", name: "SOCKS", severity: "critical" },
    { port: "53", name: "DNS", severity: "critical" },
  ];

  for (const dp of dangerousPorts) {
    const isOpen = fw.some((r) => r.action === "accept" && (r.dstPort || "").includes(dp.port) && !r.srcAddress);
    if (isOpen) {
      findings.push({
        severity: dp.severity, category: "🔒 Seguridad",
        issue: `${dp.name} (puerto ${dp.port}) abierto al público`,
        solution: `Cualquiera puede intentar conectarse a ${dp.name}. Restringe a tu red local.`,
        command: `/ip firewall filter add chain=input protocol=tcp dst-port=${dp.port} src-address=192.168.0.0/16 action=accept
/ip firewall filter add chain=input protocol=tcp dst-port=${dp.port} action=drop`,
      });
    }
  }

  const hasTelnet = fw.some((r) => r.action === "accept" && (r.dstPort || "").includes("23"));
  if (hasTelnet) {
    findings.push({
      severity: "critical", category: "🔒 Seguridad",
      issue: "Telnet habilitado — protocolo inseguro",
      solution: "Telnet envía contraseñas en texto plano. Desactívalo y usa SSH.",
      command: `/ip service disable telnet`,
    });
  }
}

function checkNat(config: Config, findings: Finding[]) {
  if (config.natRules.length === 0) {
    const hasPrivateRoutes = config.routes.some((r) => {
      const dst = r.dstAddress || "";
      return dst.startsWith("192.168.") || dst.startsWith("10.") || dst.startsWith("172.");
    });
    if (hasPrivateRoutes || config.dhcpLeases.length > 0) {
      findings.push({
        severity: "critical", category: "🌐 Red",
        issue: "Sin reglas NAT con clientes privados",
        solution: "Los clientes con IPs privadas no pueden salir a internet sin NAT.",
        command: `/ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade comment="NAT"`,
      });
    }
  }
}

function checkInterfaces(config: Config, findings: Finding[]) {
  const physical = config.interfaces.filter((i) => {
    const n = (i.name || "").toLowerCase();
    return n.startsWith("ether") || n.startsWith("sfp") || n.startsWith("combo");
  });

  const down = physical.filter((i) => i.running !== "true");

  if (physical.length > 1 && down.length > 0) {
    findings.push({
      severity: "info", category: "🔌 Interfaces",
      issue: `${down.length} puertos sin conexión: ${down.map((p) => p.name).join(", ")}`,
      solution: "Verifica los cables. Si son puertos de respaldo, ignora esta alerta.",
    });
  }

  for (const iface of physical) {
    const rxErrors = parseInt(iface["rx-too-short"] || "0", 10) + parseInt(iface["rx-too-long"] || "0", 10) + parseInt(iface["rx-crc-error"] || "0", 10);
    const txErrors = parseInt(iface["tx-queue-drop"] || "0", 10);
    const collisions = parseInt(iface["collisions"] || "0", 10);

    if (rxErrors > 100) {
      findings.push({
        severity: "warning", category: "🔌 Interfaces",
        issue: `${iface.name}: ${rxErrors} errores de recepción (CRC/size)`,
        solution: "Posible cable dañado, mala terminación o interferencia EMI.",
      });
    }

    if (collisions > 50) {
      findings.push({
        severity: "warning", category: "🔌 Interfaces",
        issue: `${iface.name}: ${collisions} colisiones detectadas`,
        solution: "Verifica si el puerto está en half-duplex. Debería ser full-duplex.",
        command: `/interface ethernet set [find name="${iface.name}"] full-duplex=yes`,
      });
    }

    if (txErrors > 100) {
      findings.push({
        severity: "warning", category: "🔌 Interfaces",
        issue: `${iface.name}: ${txErrors} drops de transmisión`,
        solution: "El buffer del puerto se llena. Posible sobrecarga o enlace lento.",
      });
    }
  }
}

function checkRoutes(config: Config, findings: Finding[]) {
  const hasDefault = config.routes.some((r) => r.dstAddress === "0.0.0.0/0" && r.active === "true");

  if (!hasDefault && config.routes.length > 0) {
    findings.push({
      severity: "critical", category: "🌐 Red",
      issue: "Sin ruta por defecto activa",
      solution: "El router no tiene salida a internet.",
      command: `/ip route add dst-address=0.0.0.0/0 gateway=TU_GATEWAY_IP`,
    });
  }

  const inactiveRoutes = config.routes.filter((r) => r.active !== "true" && !r.disabled);
  if (inactiveRoutes.length > 0) {
    findings.push({
      severity: "info", category: "🌐 Red",
      issue: `${inactiveRoutes.length} rutas inactivas`,
      solution: "Gateways posiblemente caídos. Verifica conectividad.",
    });
  }
}

function checkSystem(config: Config, findings: Finding[]) {
  if (!config.system) return;
  const sys = config.system;

  const cpu = parseInt(sys.cpuLoad || "0", 10);
  if (cpu > 90) {
    findings.push({
      severity: "critical", category: "💻 Sistema",
      issue: `CPU al ${cpu}% — sobrecarga crítica`,
      solution: "Ejecuta /tool profile para ver qué proceso consume CPU.",
      command: `/tool profile duration=5s`,
    });
  } else if (cpu > 70) {
    findings.push({
      severity: "warning", category: "💻 Sistema",
      issue: `CPU elevado: ${cpu}%`,
      solution: "Monitorea. Si sigue subiendo, revisa reglas de firewall.",
    });
  }

  const totalMem = parseInt(sys.totalMemory || "0", 10);
  const freeMem = parseInt(sys.freeMemory || "0", 10);
  if (totalMem > 0) {
    const memPct = ((totalMem - freeMem) / totalMem) * 100;
    if (memPct > 95) {
      findings.push({
        severity: "critical", category: "💻 Sistema",
        issue: `RAM al ${memPct.toFixed(0)}% — casi agotada`,
        solution: "Reduce reglas de firewall innecesarias o actualiza el router.",
        command: `/ip firewall filter print stats`,
      });
    } else if (memPct > 85) {
      findings.push({
        severity: "warning", category: "💻 Sistema",
        issue: `RAM al ${memPct.toFixed(0)}%`,
        solution: "Monitorea el uso de memoria.",
      });
    }
  }
}

function checkConnectionTracking(config: Config, findings: Finding[]) {
  if (!config.system || !config.connectionTracking) return;

  const totalMem = parseInt(config.system.totalMemory || "0", 10);
  const maxConn = totalMem > 0 ? Math.floor(totalMem / 1024 / 20) : 0;

  const hasFastTrack = config.firewallRules.some((r) => r.action === "fasttrack-connection");
  if (!hasFastTrack && maxConn > 0 && maxConn < 10000) {
    findings.push({
      severity: "warning", category: "⚡ Rendimiento",
      issue: "Connection tracking sin FastTrack — tabla se llena rápido",
      solution: "Sin FastTrack, todas las conexiones se trackean. La tabla se satura.",
      command: `/ip firewall filter add chain=forward connection-state=established,related action=fasttrack-connection`,
    });
  }
}

function checkDns(config: Config, findings: Finding[]) {
  const dns = config.dnsSettings;
  if (!dns) {
    findings.push({
      severity: "warning", category: "🌐 Red",
      issue: "DNS no configurado",
      solution: "Configura servidores DNS para resolución de nombres.",
      command: `/ip dns set servers=8.8.8.8,8.8.4.4 allow-remote-requests=no`,
    });
    return;
  }

  const allowRemote = dns["allow-remote-requests"];
  if (allowRemote === "true") {
    const hasDnsFilter = config.firewallRules.some((r) =>
      r.chain === "input" && (r.dstPort || "").includes("53") && r.srcAddress
    );
    if (!hasDnsFilter) {
      findings.push({
        severity: "critical", category: "🔒 Seguridad",
        issue: "DNS resolver abierto al público",
        solution: "Tu router responde DNS a cualquiera. Puede usarse para ataques DDoS amplificados.",
        command: `/ip dns set allow-remote-requests=no
# O si necesitas DNS local:
/ip firewall filter add chain=input protocol=udp dst-port=53 src-address=192.168.0.0/16 action=accept
/ip firewall filter add chain=input protocol=udp dst-port=53 action=drop`,
      });
    }
  }
}

function checkNtp(config: Config, findings: Finding[]) {
  const ntp = config.ntpSettings;
  if (!ntp || ntp.enabled !== "true") {
    findings.push({
      severity: "warning", category: "🔧 Mantenimiento",
      issue: "NTP no configurado — hora del router incorrecta",
      solution: "Hora incorrecta causa problemas con logs, leases DHCP y certificados.",
      command: `/system ntp client set enabled=yes primary-ntp=200.160.0.8 secondary-ntp=200.189.40.8
/system clock set time-zone-name=America/Caracas`,
    });
  }
}

function checkUsers(config: Config, findings: Finding[]) {
  for (const user of config.users) {
    if (user.name === "admin") {
      const hasPassword = user.password || user["last-logged-in"];
      if (!hasPassword) {
        findings.push({
          severity: "critical", category: "🔒 Seguridad",
          issue: "Usuario admin sin contraseña",
          solution: "Cualquiera puede acceder al router con usuario admin.",
          command: `/user set admin password=TU_CONTRASEÑA_SEGURA`,
        });
      }
    }
  }

  const adminCount = config.users.filter((u) => u.group === "full").length;
  if (adminCount > 2) {
    findings.push({
      severity: "warning", category: "🔒 Seguridad",
      issue: `${adminCount} usuarios con permisos de administrador`,
      solution: "Reduce el número de admins. Usa grupos con permisos limitados.",
    });
  }
}

function checkSchedulers(config: Config, findings: Finding[]) {
  for (const sched of config.schedulers) {
    const policy = sched.policy || "";
    if (policy.includes("password") || policy.includes("sensitive")) {
      findings.push({
        severity: "warning", category: "🔒 Seguridad",
        issue: `Scheduler "${sched.name}" con permisos de contraseña`,
        solution: "Revisa si este scheduler es legítimo. Puede ser un script malicioso.",
        command: `/system scheduler print detail [find name="${sched.name}"]`,
      });
    }
  }
}

function checkLogs(config: Config, findings: Finding[]) {
  const errorLogs = config.logs.filter((l) => {
    const topics = l.topics || "";
    return topics.includes("error") || topics.includes("critical");
  });

  if (errorLogs.length > 5) {
    findings.push({
      severity: "warning", category: "🔧 Mantenimiento",
      issue: `${errorLogs.length} errores recientes en logs`,
      solution: "Revisa los logs del sistema para identificar el problema.",
      command: `/log print where topics~"error"`,
    });
  }
}

function checkQueues(config: Config, findings: Finding[]) {
  const disabled = config.simpleQueues.filter((q) => q.disabled === "true");
  if (disabled.length > 0) {
    findings.push({
      severity: "warning", category: "📊 ISP",
      issue: `${disabled.length} colas desactivadas: ${disabled.map((q) => q.name).join(", ")}`,
      solution: "Clientes sin límite de velocidad. Pueden saturar la red.",
      command: disabled.map((q) => `/queue/simple enable [find name="${q.name}"]`).join("\n"),
    });
  }

  const noLimit = config.simpleQueues.filter((q) => {
    const limit = q.maxLimit || "0/0";
    return limit === "0/0" || limit === "";
  });
  if (noLimit.length > 0) {
    findings.push({
      severity: "warning", category: "📊 ISP",
      issue: `${noLimit.length} colas sin límite de velocidad`,
      solution: "Asigna velocidades máximas para controlar el ancho de banda.",
    });
  }

  const withRate = config.simpleQueues.filter((q) => {
    const rate = q.rate || "0/0";
    const parts = rate.split("/");
    const rUp = parseInt(parts[0] || "0", 10);
    const rDown = parseInt(parts[1] || "0", 10);
    return rUp > 0 || rDown > 0;
  });

  const queuesNoTraffic = config.simpleQueues.filter((q) => {
    const rate = q.rate || "0/0";
    return rate === "0/0" && q.disabled !== "true";
  });
  if (queuesNoTraffic.length > 3) {
    findings.push({
      severity: "info", category: "📊 ISP",
      issue: `${queuesNoTraffic.length} colas activas sin tráfico`,
      solution: "Posibles clientes dados de baja o con problemas de conexión.",
    });
  }
}

function checkDhcp(config: Config, findings: Finding[]) {
  const dynamic = config.dhcpLeases.filter((l) => l.dynamic === "true");
  const static_ = config.dhcpLeases.filter((l) => l.dynamic !== "true");

  if (dynamic.length > 30) {
    findings.push({
      severity: "info", category: "📊 ISP",
      issue: `${dynamic.length} leases dinámicos`,
      solution: "Convierte clientes frecuentes a IP estática para mejor control.",
    });
  }

  if (config.dhcpPools.length > 0) {
    for (const pool of config.dhcpPools) {
      const ranges = pool.ranges || "";
      if (ranges) {
        const match = ranges.match(/([\d.]+)-([\d.]+)/);
        if (match) {
          const start = match[1].split(".").map(Number);
          const end = match[2].split(".").map(Number);
          const totalIps = (end[3] - start[3]) + 1;
          if (dynamic.length > totalIps * 0.8) {
            findings.push({
              severity: "warning", category: "📊 ISP",
              issue: `Pool de IPs casi agotado: ${dynamic.length}/${totalIps}`,
              solution: "Amplía el rango de IPs o libera leases no utilizados.",
            });
          }
        }
      }
    }
  }
}

function checkArp(config: Config, findings: Finding[]) {
  const ipMap = new Map<string, string[]>();
  for (const arp of config.arpEntries) {
    const ip = arp.address || "";
    const mac = arp.macAddress || "";
    if (ip && mac) {
      const existing = ipMap.get(ip) || [];
      existing.push(mac);
      ipMap.set(ip, existing);
    }
  }

  for (const [ip, macs] of ipMap) {
    if (macs.length > 1) {
      findings.push({
        severity: "warning", category: "🌐 Red",
        issue: `IP duplicada ${ip} con ${macs.length} MACs: ${macs.join(", ")}`,
        solution: "Posible conflicto de IP o ataque ARP spoofing.",
      });
    }
  }

  const noComment = config.arpEntries.filter((a) => !a.comment && a.disabled !== "true");
  if (noComment.length > 5) {
    findings.push({
      severity: "info", category: "🔧 Mantenimiento",
      issue: `${noComment.length} entradas ARP sin comentario`,
      solution: "Agrega comentarios a las entradas ARP para identificar clientes fácilmente.",
    });
  }
}

export function analyzeMikroTik(config: Config): Finding[] {
  const findings: Finding[] = [];

  checkFirewall(config, findings);
  checkNat(config, findings);
  checkInterfaces(config, findings);
  checkRoutes(config, findings);
  checkSystem(config, findings);
  checkConnectionTracking(config, findings);
  checkDns(config, findings);
  checkNtp(config, findings);
  checkUsers(config, findings);
  checkSchedulers(config, findings);
  checkLogs(config, findings);
  checkQueues(config, findings);
  checkDhcp(config, findings);
  checkArp(config, findings);

  return findings;
}

export function formatFindings(findings: Finding[]): string {
  if (findings.length === 0) {
    return `✅ *¡Excelente! Tu red está en buen estado.*\n\nRevisé todo tu MikroTik y no encontré problemas. Las reglas de firewall están bien, las interfaces funcionan correctamente, y el sistema está estable.\n\nSigue así. Te recomiendo volver a ejecutar este análisis semanalmente.`;
  }

  const critical = findings.filter((f) => f.severity === "critical");
  const warnings = findings.filter((f) => f.severity === "warning");
  const info = findings.filter((f) => f.severity === "info");

  let msg = `🔍 *Reporte de Análisis*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;

  if (critical.length > 0) {
    msg += `⚠️ Encontré *${critical.length} problema${critical.length > 1 ? "s" : ""} crítico${critical.length > 1 ? "s" : ""}* que necesita${critical.length === 1 ? "" : "n"} atención inmediata.\n`;
  }
  if (warnings.length > 0) {
    msg += `💡 También hay *${warnings.length} recomendaci${warnings.length > 1 ? "ones" : "ón"}* para mejorar tu red.\n`;
  }
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  const allKnowledge = new Map<string, KnowledgeEntry>();
  for (const f of findings) {
    const matches = searchKnowledge(f.issue + " " + f.solution);
    if (matches.length > 0 && !allKnowledge.has(matches[0].title)) {
      allKnowledge.set(matches[0].title, matches[0]);
    }
  }

  let findingIndex = 0;
  for (const f of findings) {
    findingIndex++;
    const icon = f.severity === "critical" ? "🔴" : f.severity === "warning" ? "🟡" : "ℹ️";

    const knowledge = searchKnowledge(f.issue + " " + f.solution)[0];

    msg += `${icon} *${findingIndex}. ${f.issue}*\n\n`;

    if (knowledge) {
      msg += `📖 *¿Qué significa esto?*\n`;
      msg += `${knowledge.explanation}\n\n`;

      msg += `🔧 *¿Cómo lo soluciono?*\n`;
      msg += `${knowledge.solution}\n\n`;

      if (knowledge.commands.length > 0) {
        msg += `📋 *Comandos para copiar y pegar en tu terminal:*\n`;
        knowledge.commands.forEach((cmd) => {
          msg += `\`${cmd}\`\n`;
        });
        msg += `\n`;
      }

      if (knowledge.tips.length > 0) {
        msg += `💡 *Consejos:*\n`;
        knowledge.tips.forEach((tip) => {
          msg += `• ${tip}\n`;
        });
        msg += `\n`;
      }
    } else {
      msg += `💡 ${f.solution}\n`;
      if (f.command) {
        msg += `📋 \`${f.command}\`\n`;
      }
      msg += `\n`;
    }

    msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
  }

  if (critical.length > 0) {
    msg += `⚡ *Prioridad:* Corrige los problemas críticos primero. Estos representan riesgos de seguridad o fallas inminentes.\n\n`;
  }

  msg += `🔄 Ejecuta este análisis regularmente para mantener tu red saludable.`;

  return msg;
}

export function answerQuestion(question: string, config: Config): string {
  const findings = analyzeMikroTik(config);
  const knowledge = searchKnowledge(question);

  if (knowledge.length > 0) {
    const top = knowledge[0];
    let msg = `🤖 *${top.title}*\n\n`;
    msg += `📖 ${top.explanation}\n\n`;
    msg += `🔧 *Solución:*\n${top.solution}\n\n`;
    if (top.commands.length > 0) {
      msg += `📋 *Comandos:*\n`;
      top.commands.forEach((cmd) => { msg += `\`${cmd}\`\n`; });
      msg += `\n`;
    }
    if (top.tips.length > 0) {
      msg += `💡 *Consejos:*\n`;
      top.tips.forEach((tip) => { msg += `• ${tip}\n`; });
    }
    return msg;
  }

  return formatFindings(findings);
}
