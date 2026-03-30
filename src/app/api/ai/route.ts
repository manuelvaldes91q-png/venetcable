import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { devices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fetchFullConfig, toMikroTikDevice } from "@/lib/mikrotik";
import { analyzeMikroTik, formatFindings } from "@/lib/network-analyzer";

export async function GET() {
  try {
    const allDevices = await db.select().from(devices);
    const onlineDevice = allDevices.find((d) => d.status === "online");

    if (!onlineDevice) {
      return NextResponse.json({ analysis: "⚠️ No hay dispositivos en línea.", findings: [] });
    }

    const mikrotik = toMikroTikDevice(onlineDevice);
    const config = await fetchFullConfig(mikrotik);
    const findings = analyzeMikroTik(config);
    const analysis = formatFindings(findings);

    return NextResponse.json({ analysis, findings });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json({ error: "Error en análisis" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question } = body;

    const allDevices = await db.select().from(devices);
    const onlineDevice = allDevices.find((d) => d.status === "online");

    if (!onlineDevice) {
      return NextResponse.json({ analysis: "⚠️ No hay dispositivos en línea.", findings: [] });
    }

    const mikrotik = toMikroTikDevice(onlineDevice);
    const config = await fetchFullConfig(mikrotik);
    const findings = analyzeMikroTik(config);

    let analysis: string;

    if (question) {
      const q = question.toLowerCase();
      const filtered = findings.filter((f) => {
        if (q.includes("firewall") || q.includes("seguridad")) return f.category.includes("Firewall") || f.category.includes("Seguridad");
        if (q.includes("cpu") || q.includes("rendimiento")) return f.category.includes("Sistema") || f.category.includes("Rendimiento");
        if (q.includes("cola") || q.includes("queue") || q.includes("velocidad")) return f.category.includes("ISP");
        if (q.includes("puerto") || q.includes("interface")) return f.category.includes("Interfaces");
        if (q.includes("dns") || q.includes("ntp")) return f.category.includes("Red") || f.category.includes("Mantenimiento");
        if (q.includes("antena") || q.includes("ping")) return f.category.includes("Red");
        return true;
      });
      analysis = formatFindings(filtered.length > 0 ? filtered : findings);
    } else {
      analysis = formatFindings(findings);
    }

    return NextResponse.json({ analysis, findings });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json({ error: "Error en análisis" }, { status: 500 });
  }
}
