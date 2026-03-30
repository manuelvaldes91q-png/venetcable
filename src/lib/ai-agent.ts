import { db } from "@/db";
import { devices, systemMetrics, latencyMetrics, antennas, aiLogs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { fetchFullConfig, toMikroTikDevice } from "@/lib/mikrotik";
import { analyzeMikroTik, formatFindings } from "@/lib/network-analyzer";

async function collectIssues() {
  const issues: { type: string; device: string; description: string; severity: string; data: string }[] = [];
  const allDevices = await db.select().from(devices);
  const allAntennas = await db.select().from(antennas);

  for (const device of allDevices) {
    if (device.status === "offline") {
      issues.push({ type: "device_offline", device: device.name, description: `${device.name} fuera de línea`, severity: "critical", data: `Host: ${device.host}` });
      continue;
    }

    const [sys] = await db.select().from(systemMetrics)
      .where(eq(systemMetrics.deviceId, device.id))
      .orderBy(desc(systemMetrics.timestamp)).limit(1);

    if (sys) {
      const cpu = sys.cpuLoad ?? 0;
      if (cpu > 80) issues.push({ type: "high_cpu", device: device.name, description: `CPU: ${cpu}%`, severity: cpu > 90 ? "critical" : "warning", data: `CPU: ${cpu}%` });

      const memUsed = sys.totalMemory && sys.freeMemory
        ? ((sys.totalMemory - sys.freeMemory) / sys.totalMemory) * 100 : 0;
      if (memUsed > 85) issues.push({ type: "high_memory", device: device.name, description: `RAM: ${memUsed.toFixed(0)}%`, severity: "warning", data: `RAM: ${memUsed.toFixed(0)}%` });
    }

    const [lat] = await db.select().from(latencyMetrics)
      .where(eq(latencyMetrics.deviceId, device.id))
      .orderBy(desc(latencyMetrics.timestamp)).limit(1);

    if (lat && (lat.packetLoss ?? 0) > 10) {
      issues.push({ type: "packet_loss", device: device.name, description: `Pérdida: ${lat.packetLoss}%`, severity: "critical", data: `Pérdida: ${lat.packetLoss}%` });
    }
  }

  for (const ant of allAntennas) {
    if (ant.status === "down" && ant.ip) {
      issues.push({ type: "antenna_down", device: ant.name, description: `Antena caída: ${ant.name}`, severity: "critical", data: `IP: ${ant.ip}` });
    }
  }

  return issues;
}

export async function runAutonomousAnalysis(): Promise<string | null> {
  const issues = await collectIssues();
  if (issues.length === 0) return null;

  const maxSeverity = issues.some((i) => i.severity === "critical") ? "critical" : "warning";

  await db.insert(aiLogs).values({
    analysisType: "autonomous",
    findings: issues.map((i) => `[${i.severity}] ${i.description}`).join("\n"),
    recommendations: "Análisis automático",
    severity: maxSeverity,
  });

  let msg = `🔍 *ANÁLISIS AUTÓNOMO*\n━━━━━━━━━━━━━━━━━━━━━\n📊 Problemas: *${issues.length}*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;

  for (const i of issues) {
    const icon = i.severity === "critical" ? "🔴" : "🟡";
    msg += `${icon} ${i.description}\n`;
  }

  return msg;
}

export async function analyzeDeviceConfig(deviceId: number): Promise<string> {
  const [device] = await db.select().from(devices).where(eq(devices.id, deviceId));
  if (!device || device.status !== "online") return "⚠️ Dispositivo fuera de línea.";

  try {
    const mikrotik = toMikroTikDevice(device);
    const config = await fetchFullConfig(mikrotik);
    const findings = analyzeMikroTik(config);
    return formatFindings(findings);
  } catch {
    return "❌ Error al conectar con el router.";
  }
}

export async function getRecentLogs(limit = 10) {
  return db.select().from(aiLogs).orderBy(desc(aiLogs.createdAt)).limit(limit);
}
