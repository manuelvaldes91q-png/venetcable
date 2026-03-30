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

export async function fetchNatRules(
  device: MikroTikDevice
): Promise<Record<string, string>[]> {
  const conn = await connectToDevice(device);
  try {
    const response = await conn.write("/ip/firewall/nat/print");
    return response.map((rule: Record<string, string>) => rule);
  } catch {
    return [];
  } finally {
    await conn.close();
  }
}

export async function fetchFullConfig(
  device: MikroTikDevice
): Promise<{
  system: Record<string, string> | null;
  interfaces: Record<string, string>[];
  routes: Record<string, string>[];
  firewallRules: Record<string, string>[];
  natRules: Record<string, string>[];
  dhcpLeases: Record<string, string>[];
  simpleQueues: Record<string, string>[];
  arpEntries: Record<string, string>[];
  connectionTracking: Record<string, string> | null;
  dnsSettings: Record<string, string> | null;
  ntpSettings: Record<string, string> | null;
  users: Record<string, string>[];
  schedulers: Record<string, string>[];
  logs: Record<string, string>[];
  dhcpPools: Record<string, string>[];
  hotspotProfiles: Record<string, string>[];
  firewallAddressLists: Record<string, string>[];
}> {
  const safeWrite = async (conn: Awaited<ReturnType<typeof connectToDevice>>, cmd: string): Promise<Record<string, string>[]> => {
    try {
      return await conn.write(cmd);
    } catch (e) {
      console.error(`MikroTik ${cmd} error:`, e);
      return [];
    }
  };

  const result = {
    system: null as Record<string, string> | null,
    interfaces: [] as Record<string, string>[],
    routes: [] as Record<string, string>[],
    firewallRules: [] as Record<string, string>[],
    natRules: [] as Record<string, string>[],
    dhcpLeases: [] as Record<string, string>[],
    simpleQueues: [] as Record<string, string>[],
    arpEntries: [] as Record<string, string>[],
    connectionTracking: null as Record<string, string> | null,
    dnsSettings: null as Record<string, string> | null,
    ntpSettings: null as Record<string, string> | null,
    users: [] as Record<string, string>[],
    schedulers: [] as Record<string, string>[],
    logs: [] as Record<string, string>[],
    dhcpPools: [] as Record<string, string>[],
    hotspotProfiles: [] as Record<string, string>[],
    firewallAddressLists: [] as Record<string, string>[],
  };

  const conn = await connectToDevice(device);
  try {
    const sys = await safeWrite(conn, "/system/resource/print");
    result.system = sys[0] || null;

    result.interfaces = (await safeWrite(conn, "/interface/print")).slice(0, 20);
    result.routes = (await safeWrite(conn, "/ip/route/print")).slice(0, 15);
    result.firewallRules = (await safeWrite(conn, "/ip/firewall/filter/print")).slice(0, 25);
    result.natRules = (await safeWrite(conn, "/ip/firewall/nat/print")).slice(0, 15);
    result.dhcpLeases = (await safeWrite(conn, "/ip/dhcp-server/lease/print")).slice(0, 20);
    result.simpleQueues = (await safeWrite(conn, "/queue/simple/print")).slice(0, 20);
    result.arpEntries = (await safeWrite(conn, "/ip/arp/print")).slice(0, 20);

    const connTrack = await safeWrite(conn, "/ip/firewall/connection/print count-only");
    result.connectionTracking = connTrack[0] || null;

    const dns = await safeWrite(conn, "/ip/dns/print");
    result.dnsSettings = dns[0] || null;

    const ntp = await safeWrite(conn, "/system/ntp/client/print");
    result.ntpSettings = ntp[0] || null;

    result.users = (await safeWrite(conn, "/user/print")).slice(0, 10);
    result.schedulers = (await safeWrite(conn, "/system/scheduler/print")).slice(0, 10);
    result.logs = (await safeWrite(conn, "/log/print")).slice(0, 15);
    result.dhcpPools = (await safeWrite(conn, "/ip/pool/print")).slice(0, 10);
    result.hotspotProfiles = (await safeWrite(conn, "/ip/hotspot/profile/print")).slice(0, 5);
    result.firewallAddressLists = (await safeWrite(conn, "/ip/firewall/address-list/print")).slice(0, 20);
  } finally {
    await conn.close();
  }

  return result;
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

export function toMikroTikDevice(device: { id: number; name: string; host: string; port: number; username: string; encryptedPassword: string }): MikroTikDevice {
  return {
    id: device.id, name: device.name, host: device.host,
    port: device.port, username: device.username,
    encryptedPassword: device.encryptedPassword,
  };
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

export interface MikroTikPingResult {
  rttAvg: number;
  rttMin: number;
  rttMax: number;
  packetLoss: number;
  success: boolean;
  error?: string;
}

export async function pingFromDevice(
  device: MikroTikDevice,
  target: string,
  count = 5
): Promise<MikroTikPingResult> {
  const conn = await connectToDevice(device);
  try {
    const response = await conn.write([
      "/ping",
      `=address=${target}`,
      `=count=${count}`,
    ]);

    let totalTime = 0;
    let minTime = Infinity;
    let maxTime = 0;
    let received = 0;

    for (const entry of response) {
      const timeStr = entry["time"] || "";
      const ms = parseFloat(timeStr.replace("ms", ""));
      if (!isNaN(ms)) {
        totalTime += ms;
        if (ms < minTime) minTime = ms;
        if (ms > maxTime) maxTime = ms;
        received++;
      }
    }

    if (received === 0) {
      return { rttAvg: 0, rttMin: 0, rttMax: 0, packetLoss: 100, success: false };
    }

    const lastEntry = response[response.length - 1];
    const lossStr = lastEntry?.["packet-loss"] || "";
    const packetLoss = parseFloat(lossStr.replace("%", "")) || ((count - received) / count) * 100;

    return {
      rttAvg: parseFloat((totalTime / received).toFixed(2)),
      rttMin: parseFloat(minTime.toFixed(2)),
      rttMax: parseFloat(maxTime.toFixed(2)),
      packetLoss: parseFloat(packetLoss.toFixed(1)),
      success: true,
    };
  } catch (error) {
    return {
      rttAvg: 0, rttMin: 0, rttMax: 0, packetLoss: 100,
      success: false,
      error: error instanceof Error ? error.message : "Ping fallido",
    };
  } finally {
    await conn.close();
  }
}

export async function tracerouteFromDevice(
  device: MikroTikDevice,
  target: string,
  maxHops = 20
): Promise<{ hop: number; address: string; time: string }[]> {
  const conn = await connectToDevice(device);
  try {
    const response = await conn.write([
      "/tool/traceroute",
      `=address=${target}`,
      `=count=1`,
      `=max-hops=${maxHops}`,
    ]);

    return response.map((entry: Record<string, string>, index: number) => ({
      hop: index + 1,
      address: entry["address"] || entry["host"] || "*",
      time: entry["time"] || "—",
    }));
  } catch {
    return [];
  } finally {
    await conn.close();
  }
}

export interface DhcpLease {
  id: string;
  address: string;
  macAddress: string;
  hostName: string;
  status: string;
  server: string;
  expiresAfter: string;
  dynamic: boolean;
}

export interface SimpleQueue {
  id: string;
  name: string;
  target: string;
  maxLimit: string;
  disabled: string;
  rate: string;
  bytes: string;
}

export async function fetchDhcpLeases(
  device: MikroTikDevice
): Promise<DhcpLease[]> {
  const conn = await connectToDevice(device);
  try {
    const response = await conn.write("/ip/dhcp-server/lease/print");
    return response.map((lease: Record<string, string>) => ({
      id: lease[".id"] || "",
      address: lease["address"] || "",
      macAddress: lease["mac-address"] || "",
      hostName: lease["host-name"] || "",
      status: lease["status"] || "",
      server: lease["server"] || "",
      expiresAfter: lease["expires-after"] || "",
      dynamic: lease["dynamic"] === "true",
    }));
  } finally {
    await conn.close();
  }
}

export async function convertDhcpToStatic(
  device: MikroTikDevice,
  leaseId: string,
  name: string
): Promise<boolean> {
  const conn = await connectToDevice(device);
  try {
    await conn.write([
      "/ip/dhcp-server/lease/make-static",
      `=.id=${leaseId}`,
    ]);
    await conn.write([
      "/ip/dhcp-server/lease/set",
      `=.id=${leaseId}`,
      `=comment=${name}`,
    ]);
    return true;
  } catch {
    return false;
  } finally {
    await conn.close();
  }
}

export async function addArpBinding(
  device: MikroTikDevice,
  macAddress: string,
  ipAddress: string,
  interfaceName: string,
  comment?: string
): Promise<boolean> {
  const conn = await connectToDevice(device);
  try {
    const params = [
      "/ip/arp/add",
      `=mac-address=${macAddress}`,
      `=address=${ipAddress}`,
      `=interface=${interfaceName}`,
    ];
    if (comment) {
      params.push(`=comment=${comment}`);
    }
    await conn.write(params);
    return true;
  } catch {
    return false;
  } finally {
    await conn.close();
  }
}

export async function addSimpleQueue(
  device: MikroTikDevice,
  name: string,
  target: string,
  maxLimitUpload: string,
  maxLimitDownload: string
): Promise<boolean> {
  const conn = await connectToDevice(device);
  try {
    await conn.write([
      "/queue/simple/add",
      `=name=${name}`,
      `=target=${target}`,
      `=max-limit=${maxLimitUpload}/${maxLimitDownload}`,
    ]);
    return true;
  } catch {
    return false;
  } finally {
    await conn.close();
  }
}

export async function fetchSimpleQueues(
  device: MikroTikDevice
): Promise<SimpleQueue[]> {
  const conn = await connectToDevice(device);
  try {
    const response = await conn.write("/queue/simple/print");
    return response.map((q: Record<string, string>) => ({
      id: q[".id"] || "",
      name: q["name"] || "",
      target: q["target"] || "",
      maxLimit: q["max-limit"] || "",
      disabled: q["disabled"] || "false",
      rate: q["rate"] || "0/0",
      bytes: q["bytes"] || "0/0",
    }));
  } catch {
    return [];
  } finally {
    await conn.close();
  }
}

export interface ArpEntry {
  id: string;
  address: string;
  macAddress: string;
  interface: string;
  disabled: string;
}

export async function fetchArpEntries(
  device: MikroTikDevice
): Promise<ArpEntry[]> {
  const conn = await connectToDevice(device);
  try {
    const response = await conn.write("/ip/arp/print");
    return response.map((arp: Record<string, string>) => ({
      id: arp[".id"] || "",
      address: arp["address"] || "",
      macAddress: arp["mac-address"] || "",
      interface: arp["interface"] || "",
      disabled: arp["disabled"] || "false",
    }));
  } catch {
    return [];
  } finally {
    await conn.close();
  }
}

export async function updateQueueLimit(
  device: MikroTikDevice,
  queueId: string,
  maxLimitUpload: string,
  maxLimitDownload: string
): Promise<boolean> {
  const conn = await connectToDevice(device);
  try {
    await conn.write([
      "/queue/simple/set",
      `=.id=${queueId}`,
      `=max-limit=${maxLimitUpload}/${maxLimitDownload}`,
    ]);
    return true;
  } catch {
    return false;
  } finally {
    await conn.close();
  }
}

export async function fetchInterfaceNames(
  device: MikroTikDevice
): Promise<string[]> {
  const conn = await connectToDevice(device);
  try {
    const response = await conn.write("/interface/print");
    return response.map((iface: Record<string, string>) => iface["name"] || "");
  } catch {
    return [];
  } finally {
    await conn.close();
  }
}

export async function toggleArp(
  device: MikroTikDevice,
  arpId: string,
  enable: boolean
): Promise<boolean> {
  const conn = await connectToDevice(device);
  try {
    await conn.write([
      "/ip/arp/set",
      `=.id=${arpId}`,
      `=disabled=${enable ? "no" : "yes"}`,
    ]);
    return true;
  } catch {
    return false;
  } finally {
    await conn.close();
  }
}

export async function toggleQueue(
  device: MikroTikDevice,
  queueId: string,
  enable: boolean
): Promise<boolean> {
  const conn = await connectToDevice(device);
  try {
    await conn.write([
      "/queue/simple/set",
      `=.id=${queueId}`,
      `=disabled=${enable ? "no" : "yes"}`,
    ]);
    return true;
  } catch {
    return false;
  } finally {
    await conn.close();
  }
}

export function parseMaxLimit(limit: string): { upload: string; download: string } {
  const parts = limit.split("/");
  return {
    upload: parts[0] || "0",
    download: parts[1] || "0",
  };
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

export async function deleteArpEntry(
  device: MikroTikDevice,
  arpId: string
): Promise<boolean> {
  const conn = await connectToDevice(device);
  try {
    await conn.write(["/ip/arp/remove", `=.id=${arpId}`]);
    return true;
  } catch {
    return false;
  } finally {
    await conn.close();
  }
}

export async function deleteDhcpLease(
  device: MikroTikDevice,
  leaseId: string
): Promise<boolean> {
  const conn = await connectToDevice(device);
  try {
    await conn.write(["/ip/dhcp-server/lease/remove", `=.id=${leaseId}`]);
    return true;
  } catch {
    return false;
  } finally {
    await conn.close();
  }
}

export async function deleteSimpleQueue(
  device: MikroTikDevice,
  queueId: string
): Promise<boolean> {
  const conn = await connectToDevice(device);
  try {
    await conn.write(["/queue/simple/remove", `=.id=${queueId}`]);
    return true;
  } catch {
    return false;
  } finally {
    await conn.close();
  }
}
