import { RouterOSAPI } from "node-routeros";
import { decrypt } from "./crypto";

export interface MikroTikDevice {
  id: number;
  name: string;
  host: string;
  port: number;
  username: string;
  encryptedPassword: string;
}

export interface SystemResource {
  cpuLoad: number;
  freeMemory: number;
  totalMemory: number;
  uptime: string;
  boardName: string;
  version: string;
}

export interface InterfaceTraffic {
  name: string;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  status: string;
  comment?: string;
}

export interface RoutingEntry {
  protocol: string;
  destination: string;
  gateway: string;
  active: boolean;
  distance: number;
}

export interface FirewallRule {
  chain: string;
  action: string;
  isFasttrack: boolean;
  packets: number;
  bytes: number;
  comment?: string;
}

export interface BgpSession {
  name: string;
  remoteAs: number;
  state: string;
  prefixCount: number;
  uptime: string;
}

export interface OspfNeighbor {
  identity: string;
  address: string;
  state: string;
  stateChanges: number;
}

async function connectToDevice(device: MikroTikDevice): Promise<RouterOSAPI> {
  const password = decrypt(device.encryptedPassword);
  const conn = new RouterOSAPI({
    host: device.host,
    port: device.port,
    user: device.username,
    password,
    timeout: 10,
  });
  await conn.connect();
  return conn;
}

export async function fetchSystemResources(
  device: MikroTikDevice
): Promise<SystemResource> {
  const conn = await connectToDevice(device);
  try {
    const response = await conn.write("/system/resource/print");
    const data = response[0];
    return {
      cpuLoad: parseInt(data["cpu-load"] || "0", 10),
      freeMemory: parseInt(data["free-memory"] || "0", 10),
      totalMemory: parseInt(data["total-memory"] || "0", 10),
      uptime: data["uptime"] || "0s",
      boardName: data["board-name"] || "unknown",
      version: data["version"] || "unknown",
    };
  } finally {
    await conn.close();
  }
}

export async function fetchInterfaceTraffic(
  device: MikroTikDevice
): Promise<InterfaceTraffic[]> {
  const conn = await connectToDevice(device);
  try {
    const response = await conn.write("/interface/print");
    return response.map((iface: Record<string, string>) => ({
      name: iface["name"] || "unknown",
      rxBytes: parseInt(iface["rx-byte"] || "0", 10),
      txBytes: parseInt(iface["tx-byte"] || "0", 10),
      rxPackets: parseInt(iface["rx-packet"] || "0", 10),
      txPackets: parseInt(iface["tx-packet"] || "0", 10),
      status: iface["running"] === "true" ? "running" : "stopped",
      comment: iface["comment"],
    }));
  } finally {
    await conn.close();
  }
}

export async function fetchRoutingTable(
  device: MikroTikDevice
): Promise<RoutingEntry[]> {
  const conn = await connectToDevice(device);
  try {
    const response = await conn.write("/ip/route/print");
    return response.map((route: Record<string, string>) => ({
      protocol: route["dynamic"] === "true" ? "dynamic" : "static",
      destination: route["dst-address"] || "",
      gateway: route["gateway"] || "",
      active: route["active"] === "true",
      distance: parseInt(route["distance"] || "0", 10),
    }));
  } finally {
    await conn.close();
  }
}

export async function fetchFirewallRules(
  device: MikroTikDevice
): Promise<{ rules: FirewallRule[]; stats: { total: number; fasttrack: number; filter: number; nat: number; mangle: number } }> {
  const conn = await connectToDevice(device);
  try {
    const filterResponse = await conn.write("/ip/firewall/filter/print");
    const natResponse = await conn.write("/ip/firewall/nat/print");
    const mangleResponse = await conn.write("/ip/firewall/mangle/print");

    const filterRules: FirewallRule[] = filterResponse.map(
      (rule: Record<string, string>) => ({
        chain: rule["chain"] || "unknown",
        action: rule["action"] || "unknown",
        isFasttrack: rule["action"] === "fasttrack-connection",
        packets: parseInt(rule["packets"] || "0", 10),
        bytes: parseInt(rule["bytes"] || "0", 10),
        comment: rule["comment"],
      })
    );

    const fasttrackCount = filterRules.filter((r) => r.isFasttrack).length;
    const totalRules =
      filterResponse.length + natResponse.length + mangleResponse.length;

    return {
      rules: filterRules,
      stats: {
        total: totalRules,
        fasttrack: fasttrackCount,
        filter: filterResponse.length,
        nat: natResponse.length,
        mangle: mangleResponse.length,
      },
    };
  } finally {
    await conn.close();
  }
}

export async function fetchBgpSessions(
  device: MikroTikDevice
): Promise<BgpSession[]> {
  const conn = await connectToDevice(device);
  try {
    const response = await conn.write("/routing/bgp/peer/print");
    return response.map((peer: Record<string, string>) => ({
      name: peer["name"] || "unknown",
      remoteAs: parseInt(peer["remote-as"] || "0", 10),
      state: peer["state"] || "unknown",
      prefixCount: parseInt(peer["prefix-count"] || "0", 10),
      uptime: peer["uptime"] || "0s",
    }));
  } catch {
    return [];
  } finally {
    await conn.close();
  }
}

export async function fetchOspfNeighbors(
  device: MikroTikDevice
): Promise<OspfNeighbor[]> {
  const conn = await connectToDevice(device);
  try {
    const response = await conn.write("/routing/ospf/neighbor/print");
    return response.map((nbr: Record<string, string>) => ({
      identity: nbr["identity"] || "unknown",
      address: nbr["address"] || "unknown",
      state: nbr["state"] || "unknown",
      stateChanges: parseInt(nbr["state-changes"] || "0", 10),
    }));
  } catch {
    return [];
  } finally {
    await conn.close();
  }
}

export async function testConnection(
  device: MikroTikDevice
): Promise<{ success: boolean; version?: string; boardName?: string; error?: string }> {
  try {
    const conn = await connectToDevice(device);
    const response = await conn.write("/system/resource/print");
    const data = response[0];
    await conn.close();
    return {
      success: true,
      version: data["version"],
      boardName: data["board-name"],
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function collectAllMetrics(device: MikroTikDevice) {
  const [system, interfaces, routing, firewall] = await Promise.allSettled([
    fetchSystemResources(device),
    fetchInterfaceTraffic(device),
    fetchRoutingTable(device),
    fetchFirewallRules(device),
  ]);

  const bgp = await fetchBgpSessions(device).catch(() => []);
  const ospf = await fetchOspfNeighbors(device).catch(() => []);

  return {
    system: system.status === "fulfilled" ? system.value : null,
    interfaces: interfaces.status === "fulfilled" ? interfaces.value : [],
    routing: routing.status === "fulfilled" ? routing.value : [],
    firewall: firewall.status === "fulfilled" ? firewall.value : null,
    bgp,
    ospf,
  };
}
