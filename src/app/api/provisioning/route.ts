import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { devices } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  fetchDhcpLeases,
  convertDhcpToStatic,
  addArpBinding,
  addSimpleQueue,
  fetchSimpleQueues,
  fetchArpEntries,
  toggleArp,
  toggleQueue,
  updateQueueLimit,
  fetchInterfaceNames,
  type MikroTikDevice,
} from "@/lib/mikrotik";

function getDevice(req: { host: string; port: number; username: string; encryptedPassword: string; id: number; name: string }): MikroTikDevice {
  return {
    id: req.id,
    name: req.name,
    host: req.host,
    port: req.port,
    username: req.username,
    encryptedPassword: req.encryptedPassword,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, deviceId } = body;

    if (!deviceId || !action) {
      return NextResponse.json(
        { error: "deviceId y action son requeridos" },
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

    const mikrotik = getDevice(device);

    switch (action) {
      case "list_leases": {
        const allLeases = await fetchDhcpLeases(mikrotik);
        const leases = allLeases.filter((l) => l.dynamic);
        return NextResponse.json({ leases });
      }

      case "make_static": {
        const { leaseId, clientName } = body;
        if (!leaseId || !clientName) {
          return NextResponse.json(
            { error: "leaseId y clientName son requeridos" },
            { status: 400 }
          );
        }
        const ok = await convertDhcpToStatic(mikrotik, leaseId, clientName);
        return NextResponse.json({ success: ok });
      }

      case "add_arp": {
        const { macAddress, ipAddress, interfaceName } = body;
        if (!macAddress || !ipAddress || !interfaceName) {
          return NextResponse.json(
            { error: "macAddress, ipAddress e interfaceName son requeridos" },
            { status: 400 }
          );
        }
        const ok = await addArpBinding(mikrotik, macAddress, ipAddress, interfaceName);
        return NextResponse.json({ success: ok });
      }

      case "add_queue": {
        const { queueName, targetIp, uploadLimit, downloadLimit } = body;
        if (!queueName || !targetIp || !uploadLimit || !downloadLimit) {
          return NextResponse.json(
            { error: "Todos los campos de cola son requeridos" },
            { status: 400 }
          );
        }
        const ok = await addSimpleQueue(
          mikrotik,
          queueName,
          targetIp,
          uploadLimit,
          downloadLimit
        );
        return NextResponse.json({ success: ok });
      }

      case "list_queues": {
        const queues = await fetchSimpleQueues(mikrotik);
        const arpEntries = await fetchArpEntries(mikrotik);
        return NextResponse.json({ queues, arpEntries });
      }

      case "list_interfaces": {
        const interfaces = await fetchInterfaceNames(mikrotik);
        return NextResponse.json({ interfaces });
      }

      case "toggle_arp": {
        const { arpId, enable } = body;
        if (!arpId) {
          return NextResponse.json(
            { error: "arpId es requerido" },
            { status: 400 }
          );
        }
        const ok = await toggleArp(mikrotik, arpId, enable);
        return NextResponse.json({ success: ok });
      }

      case "toggle_queue": {
        const { queueId, enable } = body;
        if (!queueId) {
          return NextResponse.json(
            { error: "queueId es requerido" },
            { status: 400 }
          );
        }
        const ok = await toggleQueue(mikrotik, queueId, enable);
        return NextResponse.json({ success: ok });
      }

      case "update_queue": {
        const { queueId: uqId, uploadLimit: uUl, downloadLimit: uDl } = body;
        if (!uqId || !uUl || !uDl) {
          return NextResponse.json(
            { error: "queueId, uploadLimit y downloadLimit son requeridos" },
            { status: 400 }
          );
        }
        const ok = await updateQueueLimit(mikrotik, uqId, uUl, uDl);
        return NextResponse.json({ success: ok });
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
        error: "Error en aprovisionamiento",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
