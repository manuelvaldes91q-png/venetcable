import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "mikrotik-monitor-jwt-secret-change-in-production"
);

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const buf = Buffer.from(hash, "hex");
  const derived = scryptSync(password, salt, 64);
  return timingSafeEqual(buf, derived);
}

export async function createSession(userId: number, username: string, role: string): Promise<string> {
  const token = await new SignJWT({ sub: String(userId), username, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(KEY);

  (await cookies()).set("session", token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  return token;
}

export async function getSession(): Promise<{ sub: string; username: string; role: string } | null> {
  const token = (await cookies()).get("session")?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, KEY);
    return {
      sub: payload.sub as string,
      username: payload.username as string,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
}

export async function destroySession() {
  (await cookies()).delete("session");
}
