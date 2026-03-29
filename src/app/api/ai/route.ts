import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { devices, systemMetrics, latencyMetrics, antennas } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { fetchSimpleQueues, type MikroTikDevice } from "@/lib/mikrotik";
import { analyzeWithAI, buildNetworkSnapshot } from "@/lib/ai";

async function collectSnapshot() {
  const allDevices = await db.select().from(devices);
  const allAntennas = await db.select().from(antennas);

  const metrics = [];
  for (const device of allDevices) {
    const [sys] = await db
      .select().from(systemMetrics)
      .where(eq(systemMetrics.deviceId, device.id))
      .orderBy(desc(systemMetrics.timestamp)).limit(1);

    const [lat] = await db
      .select().from(latencyMetrics)
      .where(eq(latencyMetrics.deviceId, device.id))
      .orderBy(desc(latencyMetrics.timestamp)).limit(1);

    const memUsed = sys && sys.totalMemory && sys.freeMemory
      ? Math.round(((sys.totalMemory - sys.freeMemory) / sys.totalMemory) * 100)
      : null;

    metrics.push({
      deviceName: device.name,
      cpu: sys?.cpuLoad ?? null,
      ram: memUsed,
      uptime: sys?.uptime ?? null,
      ping: lat?.rttAvg ?? null,
      loss: lat?.packetLoss ?? null,
    });
  }

  let queues: { name: string; rate: string }[] = [];
  const onlineDevice = allDevices.find((d) => d.status === "online");
  if (onlineDevice) {
    try {
      const mikrotik: MikroTikDevice = {
        id: onlineDevice.id, name: onlineDevice.name,
        host: onlineDevice.host, port: onlineDevice.port,
        username: onlineDevice.username, encryptedPassword: onlineDevice.encryptedPassword,
      };
      const allQueues = await fetchSimpleQueues(mikrotik);
      queues = allQueues
        .filter((q) => {
          const parts = (q.rate || "0/0").split("/");
          return parseInt(parts[0] || "0", 10) > 0 || parseInt(parts[1] || "0", 10) > 0;
        })
        .slice(0, 10)
        .map((q) => ({ name: q.name, rate: q.rate }));
    } catch {}
  }

  const antennaStatus = allAntennas.map((a) => ({
    name: a.name,
    ip: a.ip,
    status: a.status,
  }));

  return buildNetworkSnapshot(
    allDevices.map((d) => ({ name: d.name, host: d.host, status: d.status })),
    metrics,
    antennaStatus,
    queues
  );
}

export async function GET() {
  try {
    const snapshot = await collectSnapshot();
    const analysis = await analyzeWithAI(snapshot);
    return NextResponse.json({ analysis, snapshot });
  } catch (error) {
    console.error("AI analysis error:", error);
    return NextResponse.json({ error: "Error en análisis" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question } = body;

    if (!question) {
      return NextResponse.json({ error: "Pregunta requerida" }, { status: 400 });
    }

    const snapshot = await collectSnapshot();
    const analysis = await analyzeWithAI(snapshot, question);
    return NextResponse.json({ analysis, snapshot });
  } catch (error) {
    console.error("AI question error:", error);
    return NextResponse.json({ error: "Error en consulta" }, { status: 500 });
  }
}
