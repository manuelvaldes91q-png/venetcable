import { db } from "@/db";
import { devices, systemMetrics, latencyMetrics, antennas, aiKnowledge, aiLogs } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { analyzeWithAI, buildFullMikroTikSnapshot } from "@/lib/ai";
import { fetchFullConfig, pingFromDevice, toMikroTikDevice } from "@/lib/mikrotik";

interface Issue {
  type: string;
  device: string;
  description: string;
  severity: "critical" | "warning" | "info";
  data: string;
}

async function collectIssues(): Promise<Issue[]> {
  const issues: Issue[] = [];
  const allDevices = await db.select().from(devices);
  const allAntennas = await db.select().from(antennas);

  for (const device of allDevices) {
    if (device.status === "offline") {
      issues.push({
        type: "device_offline",
        device: device.name,
        description: `${device.name} (${device.host}) fuera de línea`,
        severity: "critical",
        data: `Dispositivo: ${device.name}, Host: ${device.host}`,
      });
      continue;
    }

    const mikrotik = toMikroTikDevice(device);

    const [sys] = await db
      .select().from(systemMetrics)
      .where(eq(systemMetrics.deviceId, device.id))
      .orderBy(desc(systemMetrics.timestamp)).limit(1);

    if (sys) {
      const cpu = sys.cpuLoad ?? 0;
      if (cpu > 90) {
        issues.push({ type: "high_cpu", device: device.name, description: `CPU crítico: ${cpu}%`, severity: "critical", data: `CPU: ${cpu}%` });
      } else if (cpu > 70) {
        issues.push({ type: "high_cpu", device: device.name, description: `CPU elevado: ${cpu}%`, severity: "warning", data: `CPU: ${cpu}%` });
      }

      const memUsed = sys.totalMemory && sys.freeMemory
        ? ((sys.totalMemory - sys.freeMemory) / sys.totalMemory) * 100 : 0;
      if (memUsed > 90) {
        issues.push({ type: "high_memory", device: device.name, description: `RAM crítica: ${memUsed.toFixed(0)}%`, severity: "critical", data: `RAM: ${memUsed.toFixed(0)}%` });
      }
    }

    const [lat] = await db
      .select().from(latencyMetrics)
      .where(eq(latencyMetrics.deviceId, device.id))
      .orderBy(desc(latencyMetrics.timestamp)).limit(1);

    if (lat) {
      const loss = lat.packetLoss ?? 0;
      const rtt = lat.rttAvg ?? 0;
      if (loss > 20) {
        issues.push({ type: "packet_loss", device: device.name, description: `Pérdida: ${loss}%`, severity: "critical", data: `Pérdida: ${loss}%, Ping: ${rtt}ms` });
      } else if (rtt > 200) {
        issues.push({ type: "high_latency", device: device.name, description: `Latencia: ${rtt}ms`, severity: "warning", data: `Ping: ${rtt}ms` });
      }
    }

    try {
      const config = await fetchFullConfig(mikrotik);
      const configText = buildFullMikroTikSnapshot(config);

      if (config.firewallRules.length === 0) {
        issues.push({ type: "no_firewall", device: device.name, description: "Sin reglas de firewall", severity: "critical", data: "No hay reglas de firewall configuradas" });
      } else {
        const hasDropInput = config.firewallRules.some((r) => r.chain === "input" && r.action === "drop");
        if (!hasDropInput) {
          issues.push({ type: "no_input_drop", device: device.name, description: "Falta regla drop en input", severity: "critical", data: "No hay regla de drop en la cadena input" });
        }
      }

      if (config.natRules.length === 0) {
        issues.push({ type: "no_nat", device: device.name, description: "Sin reglas NAT", severity: "warning", data: "No hay reglas NAT configuradas" });
      }

      const offlinePorts = config.interfaces.filter((i) => {
        const isPhysical = (i.name || "").startsWith("ether") || (i.name || "").startsWith("sfp");
        return isPhysical && i.running !== "true";
      });
      if (offlinePorts.length > 0) {
        issues.push({
          type: "ports_down", device: device.name,
          description: `${offlinePorts.length} puertos desconectados: ${offlinePorts.map((p) => p.name).join(", ")}`,
          severity: "info",
          data: `Puertos: ${offlinePorts.map((p) => p.name).join(", ")}`,
        });
      }

      const disabledQueues = config.simpleQueues.filter((q) => q.disabled === "true");
      if (disabledQueues.length > 0) {
        issues.push({
          type: "disabled_queues", device: device.name,
          description: `${disabledQueues.length} colas desactivadas`,
          severity: "warning",
          data: `Colas: ${disabledQueues.map((q) => q.name).join(", ")}`,
        });
      }
    } catch (e) {
      console.error("Config fetch error:", e);
    }
  }

  for (const ant of allAntennas) {
    if (!ant.ip || !ant.deviceId) continue;
    if (ant.status === "down" || ant.status === "unknown") {
      issues.push({ type: "antenna_down", device: ant.name, description: `Antena caída: ${ant.name} (${ant.ip})`, severity: "critical", data: `IP: ${ant.ip}` });
    }
  }

  return issues;
}

async function findKnownSolution(issueType: string, device: string): Promise<string | null> {
  const [known] = await db
    .select().from(aiKnowledge)
    .where(and(eq(aiKnowledge.errorType, issueType), eq(aiKnowledge.errorPattern, device)))
    .limit(1);

  if (known) {
    await db.update(aiKnowledge)
      .set({ occurrences: known.occurrences + 1, lastOccurredAt: new Date() })
      .where(eq(aiKnowledge.id, known.id));
    return known.solution;
  }
  return null;
}

async function learnFromIssue(issue: Issue, solution: string) {
  const [existing] = await db
    .select().from(aiKnowledge)
    .where(and(eq(aiKnowledge.errorType, issue.type), eq(aiKnowledge.errorPattern, issue.device)))
    .limit(1);

  if (existing) {
    await db.update(aiKnowledge)
      .set({ solution, lastOccurredAt: new Date() })
      .where(eq(aiKnowledge.id, existing.id));
  } else {
    await db.insert(aiKnowledge).values({
      errorPattern: issue.device,
      errorType: issue.type,
      description: issue.description,
      solution,
    });
  }
}

export async function runAutonomousAnalysis(): Promise<string | null> {
  const issues = await collectIssues();

  if (issues.length === 0) {
    return null;
  }

  const findings: string[] = [];
  const solutions: string[] = [];

  for (const issue of issues) {
    findings.push(`[${issue.severity.toUpperCase()}] ${issue.description}`);

    const known = await findKnownSolution(issue.type, issue.device);
    if (known) {
      solutions.push(`💡 ${known}`);
    } else {
      const allDevices = await db.select().from(devices);
      const onlineDevice = allDevices.find((d) => d.status === "online");

      if (onlineDevice) {
        try {
          const mikrotik = toMikroTikDevice(onlineDevice);
          const config = await fetchFullConfig(mikrotik);
          const snapshot = buildFullMikroTikSnapshot(config);

          const aiResponse = await analyzeWithAI(snapshot,
            `Problema detectado:\nTipo: ${issue.type}\nDispositivo: ${issue.device}\nDescripción: ${issue.description}\nDatos: ${issue.data}\n\n¿Cuál es la causa y cómo solucionarlo? Incluye comandos RouterOS si aplica.`
          );

          solutions.push(`🤖 ${aiResponse}`);
          await learnFromIssue(issue, aiResponse);
        } catch {
          solutions.push(`⚠️ No se pudo analizar con IA`);
        }
      }
    }
  }

  await db.insert(aiLogs).values({
    analysisType: "autonomous",
    findings: findings.join("\n"),
    recommendations: solutions.join("\n"),
    severity: issues.some((i) => i.severity === "critical") ? "critical" : "warning",
  });

  const report = `🔍 *ANÁLISIS AUTÓNOMO*\n━━━━━━━━━━━━━━━━━━━━━\n📊 Problemas: *${issues.length}*\n━━━━━━━━━━━━━━━━━━━━━\n\n${findings.join("\n\n")}\n\n💡 *Soluciones:*\n${solutions.join("\n\n")}`;

  return report;
}

export async function getRecentLogs(limit = 10) {
  return db.select().from(aiLogs).orderBy(desc(aiLogs.createdAt)).limit(limit);
}

export async function getKnowledgeBase() {
  return db.select().from(aiKnowledge).orderBy(desc(aiKnowledge.occurrences));
}
