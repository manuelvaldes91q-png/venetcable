import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { antennas, antennaReadings } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { pingHost } from "@/lib/ping";

export async function GET() {
  try {
    const allAntennas = await db
      .select()
      .from(antennas)
      .orderBy(desc(antennas.createdAt));

    const antennasWithReadings = await Promise.all(
      allAntennas.map(async (ant) => {
        const readings = await db
          .select()
          .from(antennaReadings)
          .where(eq(antennaReadings.antennaId, ant.id))
          .orderBy(desc(antennaReadings.timestamp))
          .limit(50);

        const latestReading = readings[0] || null;

        let reachable: boolean | null = null;
        let pingRtt: number | null = null;
        if (ant.ip) {
          const pingResult = await pingHost(ant.ip, 3);
          reachable = pingResult.success;
          pingRtt = pingResult.success ? pingResult.rttAvg : null;
        }

        return {
          ...ant,
          latestReading,
          readings,
          reachable,
          pingRtt,
        };
      })
    );

    return NextResponse.json(antennasWithReadings);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch antennas" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      ip,
      ssid,
      frequency,
      channelWidth,
      mode,
      deviceId,
      interfaceName,
      location,
      notes,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Antenna name is required" },
        { status: 400 }
      );
    }

    const [newAntenna] = await db
      .insert(antennas)
      .values({
        name,
        ip: ip || null,
        ssid: ssid || null,
        frequency: frequency || null,
        channelWidth: channelWidth || null,
        mode: mode || "other",
        deviceId: deviceId ? parseInt(String(deviceId), 10) : null,
        interfaceName: interfaceName || null,
        location: location || null,
        notes: notes || null,
      })
      .returning();

    return NextResponse.json(newAntenna, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to add antenna" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Antenna ID is required" },
        { status: 400 }
      );
    }

    await db.delete(antennas).where(eq(antennas.id, parseInt(id, 10)));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete antenna" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Antenna ID is required" },
        { status: 400 }
      );
    }

    const setData: Record<string, unknown> = { updatedAt: new Date() };
    if (status) setData.status = status;
    if (updates.name !== undefined) setData.name = updates.name;
    if (updates.ip !== undefined) setData.ip = updates.ip;
    if (updates.ssid !== undefined) setData.ssid = updates.ssid;
    if (updates.frequency !== undefined) setData.frequency = updates.frequency;
    if (updates.channelWidth !== undefined)
      setData.channelWidth = updates.channelWidth;
    if (updates.mode !== undefined) setData.mode = updates.mode;
    if (updates.location !== undefined) setData.location = updates.location;
    if (updates.notes !== undefined) setData.notes = updates.notes;

    const [updated] = await db
      .update(antennas)
      .set(setData)
      .where(eq(antennas.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Failed to update antenna" },
      { status: 500 }
    );
  }
}
