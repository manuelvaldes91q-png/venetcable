import { NextResponse } from "next/server";
import { execSync } from "child_process";

function run(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf-8", timeout: 5000 }).trim();
  } catch {
    return "";
  }
}

export async function GET() {
  try {
    const memInfo = run("free -b | grep Mem");
    const memParts = memInfo.split(/\s+/);
    const totalMem = parseInt(memParts[1] || "0", 10);
    const usedMem = parseInt(memParts[2] || "0", 10);
    const freeMem = parseInt(memParts[3] || "0", 10);
    const availMem = parseInt(memParts[6] || memParts[3] || "0", 10);

    const cpuInfo = run("top -bn1 | grep '%Cpu'");
    const cpuMatch = cpuInfo.match(/([\d.]+)\s*id/);
    const cpuIdle = cpuMatch ? parseFloat(cpuMatch[1]) : 100;
    const cpuUsed = Math.round(100 - cpuIdle);

    const loadAvg = run("cat /proc/loadavg");
    const loadParts = loadAvg.split(" ");

    const diskInfo = run("df -B1 / | tail -1");
    const diskParts = diskInfo.split(/\s+/);
    const totalDisk = parseInt(diskParts[1] || "0", 10);
    const usedDisk = parseInt(diskParts[2] || "0", 10);
    const availDisk = parseInt(diskParts[3] || "0", 10);
    const diskPercent = parseInt(diskParts[4] || "0", 10);

    const uptime = run("uptime -p").replace("up ", "");

    const pm2Status = run("pm2 jlist");
    let processes: { name: string; status: string; cpu: string; memory: string; uptime: string; restarts: number }[] = [];
    try {
      const pm2Data = JSON.parse(pm2Status);
      processes = pm2Data.map((p: Record<string, Record<string, unknown>>) => ({
        name: p.name || "?",
        status: p.pm2_env?.status || "?",
        cpu: `${p.monit?.cpu ?? 0}%`,
        memory: formatBytes((p.monit?.memory as number) || 0),
        uptime: p.pm2_env?.pm_uptime ? formatUptime(Date.now() - (p.pm2_env.pm_uptime as number)) : "?",
        restarts: (p.pm2_env?.restart_time as number) || 0,
      }));
    } catch {}

    const netInfo = run("cat /proc/net/dev | grep -E 'eth|ens|enp'");
    const netInterfaces = netInfo.split("\n").filter(Boolean).map((line) => {
      const parts = line.trim().split(/\s+/);
      const name = parts[0]?.replace(":", "") || "?";
      return {
        name,
        rxBytes: parseInt(parts[1] || "0", 10),
        txBytes: parseInt(parts[9] || "0", 10),
      };
    });

    const hostname = run("hostname");
    const kernel = run("uname -r");
    const ip = run("hostname -I | awk '{print $1}'");

    return NextResponse.json({
      hostname,
      kernel,
      ip,
      uptime,
      cpu: { used: cpuUsed, idle: Math.round(cpuIdle), load1: loadParts[0], load5: loadParts[1], load15: loadParts[2] },
      memory: { total: totalMem, used: usedMem, free: freeMem, available: availMem },
      disk: { total: totalDisk, used: usedDisk, available: availDisk, percent: diskPercent },
      network: netInterfaces,
      processes,
    });
  } catch (error) {
    console.error("VPS metrics error:", error);
    return NextResponse.json({ error: "Error al obtener métricas" }, { status: 500 });
  }
}

function formatBytes(bytes: number): string {
  if (bytes > 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes > 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} MB`;
  if (bytes > 1_024) return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatUptime(ms: number): string {
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}
