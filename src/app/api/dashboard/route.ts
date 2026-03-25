import { NextResponse } from "next/server";
import { db } from "@/db";
import { devices, systemMetrics, interfaceMetrics, firewallMetrics } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    const allDevices = await db.select().from(devices);

    const devicesWithLatestMetrics = await Promise.all(
      allDevices.map(async (device) => {
        const [latestSystem] = await db
          .select()
          .from(systemMetrics)
          .where(eq(systemMetrics.deviceId, device.id))
          .orderBy(desc(systemMetrics.timestamp))
          .limit(1);

        const latestInterfaces = await db
          .select()
          .from(interfaceMetrics)
          .where(eq(interfaceMetrics.deviceId, device.id))
          .orderBy(desc(interfaceMetrics.timestamp))
          .limit(20);

        const [latestFirewall] = await db
          .select()
          .from(firewallMetrics)
          .where(eq(firewallMetrics.deviceId, device.id))
          .orderBy(desc(firewallMetrics.timestamp))
          .limit(1);

        return {
          id: device.id,
          name: device.name,
          host: device.host,
          port: device.port,
          status: device.status,
          routerosVersion: device.routerosVersion,
          lastSeen: device.lastSeen,
          system: latestSystem || null,
          interfaces: latestInterfaces,
          firewall: latestFirewall || null,
        };
      })
    );

    const totalDevices = allDevices.length;
    const onlineDevices = allDevices.filter(
      (d) => d.status === "online"
    ).length;
    const offlineDevices = allDevices.filter(
      (d) => d.status === "offline"
    ).length;

    return NextResponse.json({
      summary: {
        totalDevices,
        onlineDevices,
        offlineDevices,
      },
      devices: devicesWithLatestMetrics,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
