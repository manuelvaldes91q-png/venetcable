import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { devices } from "@/db/schema";
import { eq } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/crypto";
import { testConnection } from "@/lib/mikrotik";

export async function GET() {
  try {
    const allDevices = await db.select().from(devices);
    const sanitized = allDevices.map((d) => ({
      ...d,
      encryptedPassword: "***",
    }));
    return NextResponse.json(sanitized);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch devices" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, host, port, username, password } = body;

    if (!name || !host || !username || !password) {
      return NextResponse.json(
        { error: "Missing required fields: name, host, username, password" },
        { status: 400 }
      );
    }

    const apiPort = port || 8728;
    const encryptedPassword = encrypt(password);

    const testDevice = {
      id: 0,
      name,
      host,
      port: apiPort,
      username,
      encryptedPassword,
    };

    const connectionTest = await testConnection(testDevice);

    const [newDevice] = await db
      .insert(devices)
      .values({
        name,
        host,
        port: apiPort,
        username,
        encryptedPassword,
        status: connectionTest.success ? "online" : "offline",
        routerosVersion: connectionTest.version || "unknown",
        lastSeen: new Date(),
      })
      .returning();

    return NextResponse.json(
      {
        ...newDevice,
        encryptedPassword: "***",
        connectionTest,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to add device" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, wanInterfaceName } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Device ID is required" },
        { status: 400 }
      );
    }

    await db
      .update(devices)
      .set({ wanInterfaceName: wanInterfaceName || null, updatedAt: new Date() })
      .where(eq(devices.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update device" },
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
        { error: "Device ID is required" },
        { status: 400 }
      );
    }

    await db.delete(devices).where(eq(devices.id, parseInt(id, 10)));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete device" },
      { status: 500 }
    );
  }
}
