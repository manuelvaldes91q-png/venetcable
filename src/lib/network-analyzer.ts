interface Finding {
  severity: "critical" | "warning" | "info";
  issue: string;
  solution: string;
  command?: string;
}

export function analyzeMikroTik(config: {
  system: Record<string, string> | null;
  interfaces: Record<string, string>[];
  routes: Record<string, string>[];
  firewallRules: Record<string, string>[];
  natRules: Record<string, string>[];
  dhcpLeases: Record<string, string>[];
  simpleQueues: Record<string, string>[];
  arpEntries: Record<string, string>[];
}): Finding[] {
  const findings: Finding[] = [];

  // Firewall checks
  if (config.firewallRules.length === 0) {
    findings.push({
      severity: "critical",
      issue: "Sin reglas de firewall",
      solution: "Tu router está abierto al mundo. Agrega reglas básicas de protección.",
      command: `/ip firewall filter add chain=input connection-state=established,related action=accept comment="Aceptar conexiones establecidas"
/ip firewall filter add chain=input action=drop comment="Bloquear todo lo demás"`,
    });
  } else {
    const inputRules = config.firewallRules.filter((r) => r.chain === "input");
    const hasEstablished = inputRules.some((r) => r["connection-state"]?.includes("established"));
    const hasDrop = inputRules.some((r) => r.action === "drop" && !r.srcAddress);

    if (!hasEstablished) {
      findings.push({
        severity: "warning",
        issue: "Falta regla connection-state=established,related en input",
        solution: "Sin esta regla, el router procesa cada paquete individualmente. Agrega:",
        command: `/ip firewall filter add chain=input connection-state=established,related action=accept comment="FastTrack" place-before=0`,
      });
    }

    if (!hasDrop) {
      findings.push({
        severity: "critical",
        issue: "No hay regla drop al final de input",
        solution: "Todo el tráfico entrante es aceptado por defecto. Tu router es vulnerable.",
        command: `/ip firewall filter add chain=input action=drop comment="Drop todo"`,
      });
    }

    const winboxOpen = config.firewallRules.some((r) =>
      r.action === "accept" && r.dstPort?.includes("8291") && !r.srcAddress
    );
    if (winboxOpen) {
      findings.push({
        severity: "critical",
        issue: "Winbox (puerto 8291) abierto al público",
        solution: "Cualquiera puede intentar conectarse a Winbox. Restringe a tu red local.",
        command: `/ip firewall filter add chain=input protocol=tcp dst-port=8291 src-address=192.168.0.0/16 action=accept
/ip firewall filter add chain=input protocol=tcp dst-port=8291 action=drop`,
      });
    }

    const sshOpen = config.firewallRules.some((r) =>
      r.action === "accept" && r.dstPort?.includes("22") && !r.srcAddress
    );
    if (sshOpen) {
      findings.push({
        severity: "warning",
        issue: "SSH (puerto 22) accesible públicamente",
        solution: "Restringe SSH a IPs conocidas o usa VPN.",
        command: `/ip firewall filter add chain=input protocol=tcp dst-port=22 src-address-list=admin action=accept
/ip firewall filter add chain=input protocol=tcp dst-port=22 action=drop`,
      });
    }
  }

  // NAT checks
  if (config.natRules.length === 0) {
    findings.push({
      severity: "warning",
      issue: "Sin reglas NAT",
      solution: "Si tienes IPs privadas, necesitas NAT para salir a internet.",
      command: `/ip firewall nat add chain=srcnat out-interface=ether1 action=masquerade comment="NAT principal"`,
    });
  }

  // Interface checks
  const physicalPorts = config.interfaces.filter((i) =>
    (i.name || "").startsWith("ether") || (i.name || "").startsWith("sfp")
  );
  const downPorts = physicalPorts.filter((i) => i.running !== "true");

  if (downPorts.length === physicalPorts.length && physicalPorts.length > 1) {
    findings.push({
      severity: "info",
      issue: `${downPorts.length} puertos desconectados de ${physicalPorts.length}`,
      solution: "Verifica los cables de los puertos: " + downPorts.map((p) => p.name).join(", "),
    });
  }

  // Queue checks
  const disabledQueues = config.simpleQueues.filter((q) => q.disabled === "true");
  if (disabledQueues.length > 0) {
    findings.push({
      severity: "warning",
      issue: `${disabledQueues.length} colas desactivadas: ${disabledQueues.map((q) => q.name).join(", ")}`,
      solution: "Los clientes con colas desactivadas no tienen límite de velocidad.",
      command: disabledQueues.map((q) => `/queue/simple enable [find name="${q.name}"]`).join("\n"),
    });
  }

  const noLimitQueues = config.simpleQueues.filter((q) => {
    const limit = q.maxLimit || "0/0";
    return limit === "0/0" || limit === "";
  });
  if (noLimitQueues.length > 0) {
    findings.push({
      severity: "warning",
      issue: `${noLimitQueues.length} colas sin límite de velocidad`,
      solution: "Asigna velocidades máximas a estos clientes.",
    });
  }

  // Route checks
  const hasDefaultRoute = config.routes.some((r) =>
    r.dstAddress === "0.0.0.0/0" && r.active === "true"
  );
  if (!hasDefaultRoute && config.routes.length > 0) {
    findings.push({
      severity: "critical",
      issue: "Sin ruta por defecto activa",
      solution: "El router no tiene salida a internet.",
      command: `/ip route add dst-address=0.0.0.0/0 gateway=TU_GATEWAY`,
    });
  }

  // System checks
  if (config.system) {
    const cpu = parseInt(config.system.cpuLoad || "0", 10);
    if (cpu > 90) {
      findings.push({
        severity: "critical",
        issue: `CPU al ${cpu}%`,
        solution: "Revisa procesos con /tool profile. Posibles causas: firewall denso, colas mal configuradas, ataque DDoS.",
        command: `/tool profile duration=5s`,
      });
    }

    const totalMem = parseInt(config.system.totalMemory || "0", 10);
    const freeMem = parseInt(config.system.freeMemory || "0", 10);
    if (totalMem > 0 && (freeMem / totalMem) < 0.1) {
      findings.push({
        severity: "warning",
        issue: `RAM casi agotada: ${(freeMem / 1024 / 1024).toFixed(0)}MB libres de ${(totalMem / 1024 / 1024).toFixed(0)}MB`,
        solution: "Reduce reglas de firewall innecesarias o actualiza el router.",
      });
    }
  }

  // DHCP checks
  const dynamicLeases = config.dhcpLeases.filter((l) => l.dynamic === "true");
  if (dynamicLeases.length > 20) {
    findings.push({
      severity: "info",
      issue: `${dynamicLeases.length} leases dinámicos`,
      solution: "Considera convertir clientes frecuentes a IP estática para mejor control.",
    });
  }

  return findings;
}

export function formatFindings(findings: Finding[]): string {
  if (findings.length === 0) {
    return "✅ *Red en buen estado*\n\nNo se detectaron problemas.";
  }

  let msg = `🔍 *ANÁLISIS DE RED*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📊 Problemas: *${findings.length}*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  const critical = findings.filter((f) => f.severity === "critical");
  const warnings = findings.filter((f) => f.severity === "warning");
  const info = findings.filter((f) => f.severity === "info");

  if (critical.length > 0) {
    msg += `🔴 *CRÍTICOS (${critical.length})*\n\n`;
    critical.forEach((f) => {
      msg += `• ${f.issue}\n`;
      msg += `  💡 ${f.solution}\n`;
      if (f.command) {
        msg += `  📋 \`${f.command}\`\n`;
      }
      msg += `\n`;
    });
  }

  if (warnings.length > 0) {
    msg += `🟡 *ADVERTENCIAS (${warnings.length})*\n\n`;
    warnings.forEach((f) => {
      msg += `• ${f.issue}\n`;
      msg += `  💡 ${f.solution}\n`;
      if (f.command) {
        msg += `  📋 \`${f.command}\`\n`;
      }
      msg += `\n`;
    });
  }

  if (info.length > 0) {
    msg += `ℹ️ *INFORMACIÓN (${info.length})*\n\n`;
    info.forEach((f) => {
      msg += `• ${f.issue}\n`;
      msg += `  💡 ${f.solution}\n\n`;
    });
  }

  return msg;
}
