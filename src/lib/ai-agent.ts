import { db } from "@/db";
import { devices, systemMetrics, latencyMetrics, antennas, aiKnowledge, aiLogs } from "@/db/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { analyzeWithAI } from "@/lib/ai";

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
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

  for (const device of allDevices) {
    if (device.status === "offline") {
      issues.push({
        type: "device_offline",
        device: device.name,
        description: `${device.name} (${device.host}) está fuera de línea`,
        severity: "critical",
        data: `Dispositivo: ${device.name}, Host: ${device.host}, Última vez visto: ${device.lastSeen}`,
      });
      continue;
    }

    const [sys] = await db
      .select().from(systemMetrics)
      .where(eq(systemMetrics.deviceId, device.id))
      .orderBy(desc(systemMetrics.timestamp)).limit(1);

    if (sys) {
      const cpu = sys.cpuLoad ?? 0;
      if (cpu > 90) {
        issues.push({
          type: "high_cpu",
          device: device.name,
          description: `CPU crítico: ${cpu}% en ${device.name}`,
          severity: "critical",
          data: `CPU: ${cpu}%, RAM: ${sys.totalMemory && sys.freeMemory ? Math.round(((sys.totalMemory - sys.freeMemory) / sys.totalMemory) * 100) : "?"}%, Uptime: ${sys.uptime}`,
        });
      } else if (cpu > 70) {
        issues.push({
          type: "high_cpu",
          device: device.name,
          description: `CPU elevado: ${cpu}% en ${device.name}`,
          severity: "warning",
          data: `CPU: ${cpu}%`,
        });
      }

      const memUsed = sys.totalMemory && sys.freeMemory
        ? ((sys.totalMemory - sys.freeMemory) / sys.totalMemory) * 100 : 0;
      if (memUsed > 90) {
        issues.push({
          type: "high_memory",
          device: device.name,
          description: `RAM crítica: ${memUsed.toFixed(0)}% en ${device.name}`,
          severity: "critical",
          data: `RAM usada: ${memUsed.toFixed(0)}%, Libre: ${((sys.freeMemory ?? 0) / 1024 / 1024).toFixed(0)}MB`,
        });
      }
    }

    const [lat] = await db
      .select().from(latencyMetrics)
      .where(eq(latencyMetrics.deviceId, device.id))
      .orderBy(desc(latencyMetrics.timestamp)).limit(1);

    if (lat) {
      const rtt = lat.rttAvg ?? 0;
      const loss = lat.packetLoss ?? 0;
      if (loss > 20) {
        issues.push({
          type: "high_packet_loss",
          device: device.name,
          description: `Pérdida de paquetes alta: ${loss}% en ${device.name}`,
          severity: "critical",
          data: `Ping: ${rtt}ms, Pérdida: ${loss}%, Jitter: ${lat.jitter}`,
        });
      } else if (rtt > 200) {
        issues.push({
          type: "high_latency",
          device: device.name,
          description: `Latencia alta: ${rtt}ms en ${device.name}`,
          severity: "warning",
          data: `Ping: ${rtt}ms, Pérdida: ${loss}%`,
        });
      }
    }
  }

  for (const ant of allAntennas) {
    if (!ant.ip || !ant.deviceId) continue;
    const prevState = await db
      .select().from(aiKnowledge)
      .where(and(
        eq(aiKnowledge.errorType, "antenna_down"),
        eq(aiKnowledge.errorPattern, ant.name)
      )).limit(1);

    if (ant.status === "down" || ant.status === "unknown") {
      issues.push({
        type: "antenna_down",
        device: ant.name,
        description: `Antena caída: ${ant.name} (${ant.ip})`,
        severity: "critical",
        data: `IP: ${ant.name}, Estado: ${ant.status}, Soluciones previas: ${prevState.length > 0 ? prevState[0].solution : "ninguna"}`,
      });
    }
  }

  return issues;
}

async function findKnownSolution(issueType: string, device: string): Promise<string | null> {
  const [known] = await db
    .select().from(aiKnowledge)
    .where(and(
      eq(aiKnowledge.errorType, issueType),
      eq(aiKnowledge.errorPattern, device)
    )).limit(1);

  if (known) {
    await db
      .update(aiKnowledge)
      .set({ occurrences: known.occurrences + 1, lastOccurredAt: new Date() })
      .where(eq(aiKnowledge.id, known.id));
    return known.solution;
  }

  const [similar] = await db
    .select().from(aiKnowledge)
    .where(eq(aiKnowledge.errorType, issueType))
    .orderBy(desc(aiKnowledge.occurrences))
    .limit(1);

  return similar?.solution || null;
}

async function learnFromIssue(issue: Issue, solution: string) {
  const [existing] = await db
    .select().from(aiKnowledge)
    .where(and(
      eq(aiKnowledge.errorType, issue.type),
      eq(aiKnowledge.errorPattern, issue.device)
    )).limit(1);

  if (existing) {
    await db
      .update(aiKnowledge)
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
    await db.insert(aiLogs).values({
      analysisType: "autonomous",
      findings: "Red estable, sin problemas detectados",
      recommendations: "Todo funcionando correctamente",
      severity: "info",
    });
    return null;
  }

  const findings: string[] = [];
  const recommendations: string[] = [];

  for (const issue of issues) {
    const knownSolution = await findKnownSolution(issue.type, issue.device);

    if (knownSolution) {
      findings.push(`[${issue.severity.toUpperCase()}] ${issue.description}`);
      recommendations.push(`💡 Solución conocida: ${knownSolution}`);
    } else {
      const aiPrompt = [
        `Problema detectado en red MikroTik:`,
        `Tipo: ${issue.type}`,
        `Dispositivo: ${issue.device}`,
        `Descripción: ${issue.description}`,
        `Datos: ${issue.data}`,
        ``,
        `¿Cuál es la causa probable y cómo solucionarlo? Responde en máximo 3 líneas.`,
      ].join("\n");

      const aiResponse = await analyzeWithAI(issue.data, aiPrompt);
      findings.push(`[${issue.severity.toUpperCase()}] ${issue.description}`);
      recommendations.push(`🤖 IA: ${aiResponse}`);

      await learnFromIssue(issue, aiResponse);
    }
  }

  const maxSeverity = issues.some((i) => i.severity === "critical") ? "critical"
    : issues.some((i) => i.severity === "warning") ? "warning" : "info";

  await db.insert(aiLogs).values({
    analysisType: "autonomous",
    findings: findings.join("\n"),
    recommendations: recommendations.join("\n"),
    severity: maxSeverity,
  });

  const report = `🔍 *ANÁLISIS AUTÓNOMO*\n━━━━━━━━━━━━━━━━━━━━━\n📊 Problemas: *${issues.length}*\n━━━━━━━━━━━━━━━━━━━━━\n\n${findings.join("\n\n")}\n\n💡 *Recomendaciones:*\n${recommendations.join("\n\n")}`;

  return report;
}

export async function getRecentLogs(limit = 10) {
  return db.select().from(aiLogs).orderBy(desc(aiLogs.createdAt)).limit(limit);
}

export async function getKnowledgeBase() {
  return db.select().from(aiKnowledge).orderBy(desc(aiKnowledge.occurrences));
}
