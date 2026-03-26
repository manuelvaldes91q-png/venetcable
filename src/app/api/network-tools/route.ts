import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { devices } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  pingFromDevice,
  tracerouteFromDevice,
  type MikroTikDevice,
} from "@/lib/mikrotik";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, deviceId, target } = body;

    if (!deviceId || !target) {
      return NextResponse.json(
        { error: "deviceId y target son requeridos" },
        { status: 400 }
      );
    }

    const [device] = await db
      .select()
      .from(devices)
      .where(eq(devices.id, deviceId));

    if (!device) {
      return NextResponse.json(
        { error: "Dispositivo no encontrado" },
        { status: 404 }
      );
    }

    const mikrotik: MikroTikDevice = {
      id: device.id,
      name: device.name,
      host: device.host,
      port: device.port,
      username: device.username,
      encryptedPassword: device.encryptedPassword,
    };

    switch (action) {
      case "ping": {
        const count = body.count || 10;
        const result = await pingFromDevice(mikrotik, target, count);
        return NextResponse.json({ action: "ping", target, ...result });
      }

      case "traceroute": {
        const hops = await tracerouteFromDevice(mikrotik, target, 20);
        return NextResponse.json({ action: "traceroute", target, hops });
      }

      default:
        return NextResponse.json(
          { error: `Acción desconocida: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error en herramienta de red",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
