import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface PingResult {
  rttMin: number;
  rttAvg: number;
  rttMax: number;
  packetLoss: number;
  jitter: number;
  success: boolean;
  error?: string;
}

export async function pingHost(host: string, count = 5): Promise<PingResult> {
  try {
    const { stdout } = await execFileAsync("ping", [
      "-c",
      String(count),
      "-W",
      "3",
      host,
    ]);

    const statsMatch = stdout.match(
      /(\d+) packets transmitted, (\d+) received,?.*?(\d+(?:\.\d+)?)%/
    );
    const rttMatch = stdout.match(
      /= ([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+) ms/
    );

    const packetLoss = statsMatch ? parseFloat(statsMatch[3]) : 100;
    const transmitted = statsMatch ? parseInt(statsMatch[1], 10) : count;

    if (!rttMatch || transmitted === 0) {
      return {
        rttMin: 0,
        rttAvg: 0,
        rttMax: 0,
        packetLoss: 100,
        jitter: 0,
        success: false,
      };
    }

    const rttMin = parseFloat(rttMatch[1]);
    const rttAvg = parseFloat(rttMatch[2]);
    const rttMax = parseFloat(rttMatch[3]);
    const mdev = parseFloat(rttMatch[4]);

    return {
      rttMin: parseFloat(rttMin.toFixed(2)),
      rttAvg: parseFloat(rttAvg.toFixed(2)),
      rttMax: parseFloat(rttMax.toFixed(2)),
      packetLoss: parseFloat(packetLoss.toFixed(1)),
      jitter: parseFloat(mdev.toFixed(2)),
      success: true,
    };
  } catch (error) {
    return {
      rttMin: 0,
      rttAvg: 0,
      rttMax: 0,
      packetLoss: 100,
      jitter: 0,
      success: false,
      error: error instanceof Error ? error.message : "Ping failed",
    };
  }
}
