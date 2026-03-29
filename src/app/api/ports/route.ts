import { NextResponse } from "next/server";
import { db } from "@/db";
import { devices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fetchInterfaceTraffic, type MikroTikDevice } from "@/lib/mikrotik";

export async function GET() {
  try {
    const allDevices = await db.select().from(devices);
    const onlineDevices = allDevices.filter((d) => d.status === "online");

    const result = await Promise.all(
      onlineDevices.map(async (device) => {
        const mikrotik: MikroTikDevice = {
          id: device.id,
          name: device.name,
          host: device.host,
          port: device.port,
          username: device.username,
          encryptedPassword: device.encryptedPassword,
        };

        try {
          const interfaces = await fetchInterfaceTraffic(mikrotik);
          const physicalPorts = interfaces.filter((i) =>
            i.name.startsWith("ether") || i.name.startsWith("sfp")
          );
          return { deviceId: device.id, deviceName: device.name, ports: physicalPorts };
        } catch {
          return { deviceId: device.id, deviceName: device.name, ports: [] };
        }
      })
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al obtener puertos" },
      { status: 500 }
    );
  }
}
