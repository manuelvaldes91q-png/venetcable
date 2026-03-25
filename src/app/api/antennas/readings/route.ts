import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { antennaReadings, antennas } from "@/db/schema";
import { eq, desc, and, gte } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const antennaId = searchParams.get("antennaId");
    const hours = parseInt(searchParams.get("hours") || "24", 10);

    if (!antennaId) {
      return NextResponse.json(
        { error: "antennaId is required" },
        { status: 400 }
      );
    }

    const id = parseInt(antennaId, 10);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const readings = await db
      .select()
      .from(antennaReadings)
      .where(
        and(
          eq(antennaReadings.antennaId, id),
          gte(antennaReadings.timestamp, since)
        )
      )
      .orderBy(desc(antennaReadings.timestamp))
      .limit(500);

    return NextResponse.json(readings);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch readings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      antennaId,
      signalStrength,
      signalNoise,
      ccq,
      txRate,
      rxRate,
      txBytes,
      rxBytes,
      registeredClients,
      notes,
    } = body;

    if (!antennaId) {
      return NextResponse.json(
        { error: "antennaId is required" },
        { status: 400 }
      );
    }

    const [antenna] = await db
      .select()
      .from(antennas)
      .where(eq(antennas.id, antennaId));

    if (!antenna) {
      return NextResponse.json(
        { error: "Antenna not found" },
        { status: 404 }
      );
    }

    const [reading] = await db
      .insert(antennaReadings)
      .values({
        antennaId,
        signalStrength: signalStrength != null ? parseFloat(String(signalStrength)) : null,
        signalNoise: signalNoise != null ? parseFloat(String(signalNoise)) : null,
        ccq: ccq != null ? parseFloat(String(ccq)) : null,
        txRate: txRate || null,
        rxRate: rxRate || null,
        txBytes: txBytes ? parseInt(String(txBytes), 10) : 0,
        rxBytes: rxBytes ? parseInt(String(rxBytes), 10) : 0,
        registeredClients: registeredClients
          ? parseInt(String(registeredClients), 10)
          : 0,
        notes: notes || null,
      })
      .returning();

    await db
      .update(antennas)
      .set({ updatedAt: new Date() })
      .where(eq(antennas.id, antennaId));

    return NextResponse.json(reading, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to add reading" },
      { status: 500 }
    );
  }
}
