import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  devices,
  systemMetrics,
  interfaceMetrics,
  firewallMetrics,
  latencyMetrics,
} from "@/db/schema";
import { eq, gte, desc, and } from "drizzle-orm";
import {
  collectAllMetrics,
  pingFromDevice,
  type MikroTikDevice,
} from "@/lib/mikrotik";
import { pingHost } from "@/lib/ping";

export async function POST(request: NextRequest) {
  let deviceId: number | undefined;

  try {
    const body = await request.json();
    deviceId = body.deviceId;

    if (!deviceId) {
      return NextResponse.json(
        { error: "deviceId is required" },
        { status: 400 }
      );
    }

    const [device] = await db
      .select()
      .from(devices)
      .where(eq(devices.id, deviceId));

    if (!device) {
      return NextResponse.json(
        { error: "Device not found" },
        { status: 404 }
      );
    }

    const mikrotikDevice: MikroTikDevice = {
      id: device.id,
      name: device.name,
      host: device.host,
      port: device.port,
      username: device.username,
      encryptedPassword: device.encryptedPassword,
    };

    const [metrics, ping, googleDnsPing] = await Promise.all([
      collectAllMetrics(mikrotikDevice),
      pingHost(device.host, 5),
      pingFromDevice(mikrotikDevice, "8.8.8.8", 3),
    ]);

    const now = new Date();

    if (metrics.system) {
      await db.insert(systemMetrics).values({
        deviceId: device.id,
        cpuLoad: metrics.system.cpuLoad,
        freeMemory: metrics.system.freeMemory,
        totalMemory: metrics.system.totalMemory,
        uptime: metrics.system.uptime,
        timestamp: now,
      });
    }

    for (const iface of metrics.interfaces) {
      await db.insert(interfaceMetrics).values({
        deviceId: device.id,
        interfaceName: iface.name,
        rxBytes: iface.rxBytes,
        txBytes: iface.txBytes,
        rxPackets: iface.rxPackets,
        txPackets: iface.txPackets,
        status: iface.status,
        timestamp: now,
      });
    }

    if (metrics.firewall) {
      await db.insert(firewallMetrics).values({
        deviceId: device.id,
        totalRules: metrics.firewall.stats.total,
        fasttrackRules: metrics.firewall.stats.fasttrack,
        filterRules: metrics.firewall.stats.filter,
        natRules: metrics.firewall.stats.nat,
        mangleRules: metrics.firewall.stats.mangle,
        timestamp: now,
      });
    }

    await db.insert(latencyMetrics).values({
      deviceId: device.id,
      rttMin: ping.rttMin,
      rttAvg: ping.rttAvg,
      rttMax: ping.rttMax,
      packetLoss: ping.packetLoss,
      jitter: ping.jitter,
      timestamp: now,
    });

    await db
      .update(devices)
      .set({ status: "online", lastSeen: now, updatedAt: now })
      .where(eq(devices.id, device.id));

    return NextResponse.json({ success: true, metrics, ping, googleDnsPing });
  } catch (error) {
    if (deviceId) {
      await db
        .update(devices)
        .set({ status: "offline", updatedAt: new Date() })
        .where(eq(devices.id, deviceId));
    }

    return NextResponse.json(
      {
        error: "Failed to collect metrics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get("deviceId");
    const hours = parseInt(searchParams.get("hours") || "24", 10);

    if (!deviceId) {
      return NextResponse.json(
        { error: "deviceId is required" },
        { status: 400 }
      );
    }

    const id = parseInt(deviceId, 10);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [systemData, interfaceData, firewallData, latencyData] =
      await Promise.all([
        db
          .select()
          .from(systemMetrics)
          .where(
            and(
              eq(systemMetrics.deviceId, id),
              gte(systemMetrics.timestamp, since)
            )
          )
          .orderBy(desc(systemMetrics.timestamp))
          .limit(500),
        db
          .select()
          .from(interfaceMetrics)
          .where(
            and(
              eq(interfaceMetrics.deviceId, id),
              gte(interfaceMetrics.timestamp, since)
            )
          )
          .orderBy(desc(interfaceMetrics.timestamp))
          .limit(1000),
        db
          .select()
          .from(firewallMetrics)
          .where(
            and(
              eq(firewallMetrics.deviceId, id),
              gte(firewallMetrics.timestamp, since)
            )
          )
          .orderBy(desc(firewallMetrics.timestamp))
          .limit(500),
        db
          .select()
          .from(latencyMetrics)
          .where(
            and(
              eq(latencyMetrics.deviceId, id),
              gte(latencyMetrics.timestamp, since)
            )
          )
          .orderBy(desc(latencyMetrics.timestamp))
          .limit(500),
      ]);

    const [device] = await db
      .select({ wanInterfaceName: devices.wanInterfaceName })
      .from(devices)
      .where(eq(devices.id, id));

    return NextResponse.json({
      system: systemData,
      interfaces: interfaceData,
      firewall: firewallData,
      latency: latencyData,
      wanInterfaceName: device?.wanInterfaceName || null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}
