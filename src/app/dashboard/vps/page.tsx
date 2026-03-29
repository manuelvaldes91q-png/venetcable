"use client";

import { useState, useEffect, useCallback } from "react";
import { TopNav } from "@/components/ui/TopNav";

interface VpsData {
  hostname: string;
  kernel: string;
  ip: string;
  uptime: string;
  cpu: { used: number; idle: number; load1: string; load5: string; load15: string };
  memory: { total: number; used: number; free: number; available: number };
  disk: { total: number; used: number; available: number; percent: number };
  network: { name: string; rxBytes: number; txBytes: number }[];
  processes: { name: string; status: string; cpu: string; memory: string; uptime: string; restarts: number }[];
}

function formatBytes(b: number) {
  if (b > 1_073_741_824) return `${(b / 1_073_741_824).toFixed(1)} GB`;
  if (b > 1_048_576) return `${(b / 1_048_576).toFixed(0)} MB`;
  return `${(b / 1_024).toFixed(0)} KB`;
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ width: "100%", height: 8, backgroundColor: "#2c3039", borderRadius: 4, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: 4, transition: "width 0.5s" }} />
    </div>
  );
}

export default function VpsPage() {
  const [data, setData] = useState<VpsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/vps");
      if (res.ok) setData(await res.json());
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0b0c0e" }}>
        <div style={{ color: "#5a5f6a" }}>Cargando métricas del VPS...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#0b0c0e" }}>
        <TopNav />
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px", textAlign: "center", color: "#5a5f6a" }}>
          Error al obtener métricas del VPS
        </div>
      </div>
    );
  }

  const cpuColor = data.cpu.used > 80 ? "#f2495c" : data.cpu.used > 50 ? "#ff9830" : "#73bf69";
  const memPct = data.memory.total > 0 ? (data.memory.used / data.memory.total) * 100 : 0;
  const memColor = memPct > 90 ? "#f2495c" : memPct > 70 ? "#ff9830" : "#73bf69";
  const diskColor = data.disk.percent > 90 ? "#f2495c" : data.disk.percent > 70 ? "#ff9830" : "#73bf69";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0b0c0e" }}>
      <TopNav />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px" }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#e0e0e0" }}>Monitoreo del VPS</h1>
            <p style={{ fontSize: "12px", color: "#5a5f6a" }}>{data.hostname} — {data.ip} — Kernel {data.kernel}</p>
          </div>
          <div style={{ fontSize: "12px", color: "#5a5f6a" }}>
            ⏱ {data.uptime} | Actualizado cada 30s
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="panel"><div className="panel-body text-center">
            <p style={{ fontSize: "10px", fontWeight: 600, color: "#5a5f6a", textTransform: "uppercase", marginBottom: "8px" }}>CPU</p>
            <p style={{ fontSize: "28px", fontWeight: 700, color: cpuColor, fontVariantNumeric: "tabular-nums" }}>{data.cpu.used}%</p>
            <ProgressBar value={data.cpu.used} max={100} color={cpuColor} />
            <p style={{ fontSize: "10px", color: "#5a5f6a", marginTop: "6px" }}>Load: {data.cpu.load1} / {data.cpu.load5} / {data.cpu.load15}</p>
          </div></div>

          <div className="panel"><div className="panel-body text-center">
            <p style={{ fontSize: "10px", fontWeight: 600, color: "#5a5f6a", textTransform: "uppercase", marginBottom: "8px" }}>RAM</p>
            <p style={{ fontSize: "28px", fontWeight: 700, color: memColor, fontVariantNumeric: "tabular-nums" }}>{memPct.toFixed(0)}%</p>
            <ProgressBar value={data.memory.used} max={data.memory.total} color={memColor} />
            <p style={{ fontSize: "10px", color: "#5a5f6a", marginTop: "6px" }}>{formatBytes(data.memory.used)} / {formatBytes(data.memory.total)}</p>
          </div></div>

          <div className="panel"><div className="panel-body text-center">
            <p style={{ fontSize: "10px", fontWeight: 600, color: "#5a5f6a", textTransform: "uppercase", marginBottom: "8px" }}>Disco</p>
            <p style={{ fontSize: "28px", fontWeight: 700, color: diskColor, fontVariantNumeric: "tabular-nums" }}>{data.disk.percent}%</p>
            <ProgressBar value={data.disk.used} max={data.disk.total} color={diskColor} />
            <p style={{ fontSize: "10px", color: "#5a5f6a", marginTop: "6px" }}>{formatBytes(data.disk.used)} / {formatBytes(data.disk.total)}</p>
          </div></div>
        </div>

        <div className="panel mb-6">
          <div className="panel-header">
            <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#d8d9da" }}>Servicios PM2</h3>
            <span style={{ fontSize: "11px", color: "#5a5f6a" }}>{data.processes.length}</span>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            <table style={{ width: "100%", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #2c3039" }}>
                  {["Estado", "Nombre", "CPU", "Memoria", "Uptime", "Reinicios"].map((h) => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#5a5f6a", fontWeight: 600, fontSize: "11px", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.processes.map((p) => (
                  <tr key={p.name} style={{ borderBottom: "1px solid #1e2028" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                    <td style={{ padding: "10px 16px" }}>
                      <span className={`status-dot ${p.status === "online" ? "status-dot-online" : "status-dot-offline"}`} />
                    </td>
                    <td style={{ padding: "10px 16px", color: "#e0e0e0", fontWeight: 600 }}>{p.name}</td>
                    <td style={{ padding: "10px 16px", color: "#8e8e8e", fontVariantNumeric: "tabular-nums" }}>{p.cpu}</td>
                    <td style={{ padding: "10px 16px", color: "#8e8e8e", fontVariantNumeric: "tabular-nums" }}>{p.memory}</td>
                    <td style={{ padding: "10px 16px", color: "#5a5f6a" }}>{p.uptime}</td>
                    <td style={{ padding: "10px 16px", color: p.restarts > 5 ? "#f2495c" : "#5a5f6a" }}>{p.restarts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {data.network.length > 0 && (
          <div className="panel">
            <div className="panel-header">
              <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#d8d9da" }}>Red</h3>
            </div>
            <div className="panel-body">
              {data.network.map((iface) => (
                <div key={iface.name} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1e2028" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#e0e0e0" }}>{iface.name}</span>
                  <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "#8e8e8e" }}>
                    <span>⬇️ {formatBytes(iface.rxBytes)}</span>
                    <span>⬆️ {formatBytes(iface.txBytes)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
