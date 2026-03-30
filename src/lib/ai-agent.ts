import { db } from "@/db";
import { devices, systemMetrics, latencyMetrics, antennas, aiLogs } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { fetchFullConfig, toMikroTikDevice } from "@/lib/mikrotik";
import { analyzeMikroTik, formatFindings, type Finding } from "@/lib/network-analyzer";

export async function runAutonomousAnalysis(): Promise<string | null> {
  const allDevices = await db.select().from(devices);
  const onlineDevices = allDevices.filter((d) => d.status === "online");
  const offlineDevices = allDevices.filter((d) => d.status === "offline");

  if (onlineDevices.length === 0 && offlineDevices.length === 0) return null;

  let allFindings: Finding[] = [];

  for (const device of onlineDevices) {
    try {
      const mikrotik = toMikroTikDevice(device);
      const config = await fetchFullConfig(mikrotik);
      const findings = analyzeMikroTik(config);
      allFindings.push(...findings);
    } catch {}
  }

  for (const device of offlineDevices) {
    allFindings.push({
      severity: "critical", category: "🔴 Dispositivo",
      issue: `${device.name} (${device.host}) fuera de línea`,
      solution: "Verifica que el router esté encendido y conectado a la red.",
    });
  }

  const allAntennas = await db.select().from(antennas);
  for (const ant of allAntennas) {
    if (ant.status === "down" && ant.ip) {
      allFindings.push({
        severity: "critical", category: "📡 Antenas",
        issue: `Antena caída: ${ant.name} (${ant.ip})`,
        solution: "Verifica la alimentación PoE y el cable de la antena.",
      });
    }
  }

  const [sys] = await db.select().from(systemMetrics)
    .orderBy(desc(systemMetrics.timestamp)).limit(1);
  if (sys) {
    const cpu = sys.cpuLoad ?? 0;
    if (cpu > 80) {
      allFindings.push({
        severity: cpu > 90 ? "critical" : "warning", category: "💻 Sistema",
        issue: `CPU del router al ${cpu}%`,
        solution: "Ejecuta /tool profile en el router para ver qué proceso consume CPU.",
        command: `/tool profile duration=5s`,
      });
    }
  }

  if (allFindings.length === 0) return null;

  await db.insert(aiLogs).values({
    analysisType: "autonomous",
    findings: allFindings.map((f) => `[${f.severity}] ${f.issue}`).join("\n"),
    recommendations: allFindings.filter((f) => f.command).map((f) => f.command).join("\n"),
    severity: allFindings.some((f) => f.severity === "critical") ? "critical" : "warning",
  });

  return formatFindings(allFindings);
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
