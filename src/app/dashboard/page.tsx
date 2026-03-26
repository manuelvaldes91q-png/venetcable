"use client";

import { useState, useEffect, useCallback } from "react";
import { TopNav } from "@/components/ui/TopNav";
import { MetricLineChart, MetricAreaChart } from "@/components/ui/Charts";
import { DeviceCard } from "@/components/ui/Cards";
import { formatBytes } from "@/lib/utils";

interface DashboardDevice {
  id: number;
  name: string;
  host: string;
  port: number;
  status: string;
  routerosVersion: string | null;
  wanInterfaceName: string | null;
  lastSeen: string | null;
  system: {
    cpuLoad: number;
    freeMemory: number;
    totalMemory: number;
    uptime: string;
    timestamp: string;
  } | null;
  interfaces: {
    interfaceName: string;
    rxBytes: number;
    txBytes: number;
    status: string;
    timestamp: string;
  }[];
  firewall: {
    totalRules: number;
    fasttrackRules: number;
    filterRules: number;
    natRules: number;
    mangleRules: number;
  } | null;
  latency: {
    rttMin: number;
    rttAvg: number;
    rttMax: number;
    packetLoss: number;
    jitter: number;
    timestamp: string;
  } | null;
  prevInterfaces: {
    interfaceName: string;
    rxBytes: number;
    txBytes: number;
    timestamp: string;
  }[];
  googleDnsPing: {
    rttAvg: number;
    rttMin: number;
    rttMax: number;
    packetLoss: number;
    success: boolean;
  } | null;
}

interface DashboardData {
  summary: {
    totalDevices: number;
    onlineDevices: number;
    offlineDevices: number;
  };
  devices: DashboardDevice[];
  googleDnsPing: {
    rttAvg: number;
    rttMin: number;
    rttMax: number;
    packetLoss: number;
    success: boolean;
  } | null;
}

interface MetricHistory {
  system: { cpuLoad: number; freeMemory: number; totalMemory: number; uptime: string; timestamp: string }[];
  interfaces: { interfaceName: string; rxBytes: number; txBytes: number; timestamp: string }[];
  firewall: { totalRules: number; fasttrackRules: number; filterRules: number; natRules: number; mangleRules: number; timestamp: string }[];
  latency: { rttMin: number; rttAvg: number; rttMax: number; packetLoss: number; jitter: number; timestamp: string }[];
  wanInterfaceName: string | null;
}

function formatTime(ts: string) {
  try {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  } catch {
    return ts;
  }
}

function getLatencyColor(ms: number): string {
  if (ms <= 30) return "#73bf69";
  if (ms <= 80) return "#6e9fff";
  if (ms <= 150) return "#ff9830";
  return "#f2495c";
}

function getLatencyLabel(ms: number): string {
  if (ms <= 30) return "Excelente";
  if (ms <= 80) return "Buena";
  if (ms <= 150) return "Regular";
  return "Alta";
}

function WanGauge({ label, value, unit, color }: { label: string; value: string | number; unit: string; color: string }) {
  return (
    <div className="text-center">
      <p style={{ fontSize: "9px", color: "#5a5f6a", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
        {label}
      </p>
      <p style={{ fontSize: "24px", fontWeight: 700, color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
        {value}
      </p>
      <p style={{ fontSize: "10px", color: "#5a5f6a" }}>{unit}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [metricHistory, setMetricHistory] = useState<MetricHistory | null>(null);
  const [collecting, setCollecting] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [wanInput, setWanInput] = useState("");
  const [savingWan, setSavingWan] = useState(false);
  const [diagTarget, setDiagTarget] = useState("8.8.8.8");
  const [diagMode, setDiagMode] = useState<"ping" | "traceroute">("ping");
  const [pingResult, setPingResult] = useState<{
    rttAvg: number; rttMin: number; rttMax: number; packetLoss: number; success: boolean;
  } | null>(null);
  const [tracerResult, setTracerResult] = useState<{ hop: number; address: string; time: string }[]>([]);
  const [diagRunning, setDiagRunning] = useState(false);

  const collectAndRefresh = useCallback(async (deviceId: number) => {
    setCollecting((p) => ({ ...p, [deviceId]: true }));
    try {
      await fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });
    } catch {
    } finally {
      setCollecting((p) => ({ ...p, [deviceId]: false }));
    }
    const res = await fetch("/api/dashboard");
    if (res.ok) {
      const data = await res.json();
      setDashboardData(data);
    }
    const hRes = await fetch(`/api/metrics?deviceId=${deviceId}&hours=24`);
    if (hRes.ok) {
      const hData = await hRes.json();
      setMetricHistory(hData);
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
        if (data.devices.length > 0 && !selectedDevice) {
          setSelectedDevice(data.devices[0].id);
        }
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [selectedDevice]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (!selectedDevice) return;
    collectAndRefresh(selectedDevice);
    const interval = setInterval(() => collectAndRefresh(selectedDevice), 60000);
    return () => clearInterval(interval);
  }, [selectedDevice, collectAndRefresh]);

  useEffect(() => {
    const dev = dashboardData?.devices.find((d) => d.id === selectedDevice);
    setWanInput(dev?.wanInterfaceName || "");
  }, [selectedDevice, dashboardData]);

  const collectMetrics = async (deviceId: number) => {
    await collectAndRefresh(deviceId);
  };

  const runDiagnostic = async () => {
    if (!selectedDevice || !diagTarget) return;
    setDiagRunning(true);
    setPingResult(null);
    setTracerResult([]);
    try {
      const res = await fetch("/api/network-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: diagMode,
          deviceId: selectedDevice,
          target: diagTarget,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (diagMode === "ping") {
          setPingResult({
            rttAvg: data.rttAvg,
            rttMin: data.rttMin,
            rttMax: data.rttMax,
            packetLoss: data.packetLoss,
            success: data.success,
          });
        } else {
          setTracerResult(data.hops || []);
        }
      }
    } catch {
    } finally {
      setDiagRunning(false);
    }
  };

  const saveWanInterface = async () => {
    if (!selectedDevice) return;
    setSavingWan(true);
    try {
      await fetch("/api/devices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedDevice, wanInterfaceName: wanInput }),
      });
      await fetchDashboard();
    } catch {
    } finally {
      setSavingWan(false);
    }
  };

  const deleteDevice = async (deviceId: number) => {
    try {
      await fetch(`/api/devices?id=${deviceId}`, { method: "DELETE" });
      if (selectedDevice === deviceId) { setSelectedDevice(null); setMetricHistory(null); }
      await fetchDashboard();
    } catch {}
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0b0c0e" }}>
        <div style={{ color: "#8e8e8e", fontSize: "14px" }}>Cargando panel...</div>
      </div>
    );
  }

  const summary = dashboardData?.summary || { totalDevices: 0, onlineDevices: 0, offlineDevices: 0 };
  const devices = dashboardData?.devices || [];
  const sel = devices.find((d) => d.id === selectedDevice);

  const wanInterface = sel?.interfaces.find(
    (i) => i.interfaceName === sel?.wanInterfaceName
  );
  const prevWanInterface = sel?.prevInterfaces?.find(
    (i) => i.interfaceName === sel?.wanInterfaceName && i.timestamp !== wanInterface?.timestamp
  );

  let wanRxRate = 0;
  let wanTxRate = 0;
  if (wanInterface && prevWanInterface) {
    const dtSec = Math.max(
      1,
      (new Date(wanInterface.timestamp).getTime() - new Date(prevWanInterface.timestamp).getTime()) / 1000
    );
    wanRxRate = Math.max(0, (wanInterface.rxBytes - prevWanInterface.rxBytes) / dtSec);
    wanTxRate = Math.max(0, (wanInterface.txBytes - prevWanInterface.txBytes) / dtSec);
  }

  const cpuChartData = metricHistory?.system?.slice().reverse().map((s) => ({
    timestamp: formatTime(s.timestamp), "CPU %": s.cpuLoad,
  })) || [];

  const memoryChartData = metricHistory?.system?.slice().reverse().map((s) => ({
    timestamp: formatTime(s.timestamp),
    "Usado (MB)": parseFloat(((s.totalMemory - s.freeMemory) / 1024 / 1024).toFixed(1)),
    "Libre (MB)": parseFloat((s.freeMemory / 1024 / 1024).toFixed(1)),
  })) || [];

  const wanTrafficChart: { timestamp: string; "Rx (Mbps)": number; "Tx (Mbps)": number }[] = [];
  const wanName = metricHistory?.wanInterfaceName || sel?.wanInterfaceName;
  if (wanName && metricHistory?.interfaces) {
    const wanData = metricHistory.interfaces
      .filter((i) => i.interfaceName === wanName)
      .slice()
      .reverse();
    for (let i = 1; i < wanData.length; i++) {
      const dt = Math.max(1, (new Date(wanData[i].timestamp).getTime() - new Date(wanData[i - 1].timestamp).getTime()) / 1000);
      const rxMbps = parseFloat(((wanData[i].rxBytes - wanData[i - 1].rxBytes) * 8 / dt / 1_000_000).toFixed(2));
      const txMbps = parseFloat(((wanData[i].txBytes - wanData[i - 1].txBytes) * 8 / dt / 1_000_000).toFixed(2));
      wanTrafficChart.push({
        timestamp: formatTime(wanData[i].timestamp),
        "Rx (Mbps)": Math.max(0, rxMbps),
        "Tx (Mbps)": Math.max(0, txMbps),
      });
    }
  }

  const trafficByInterface: Record<string, { timestamp: string; "Rx (Mbps)": number; "Tx (Mbps)": number }[]> = {};
  if (metricHistory?.interfaces) {
    const sorted = metricHistory.interfaces.slice().reverse();
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].interfaceName !== sorted[i - 1].interfaceName) continue;
      const dt = Math.max(1, (new Date(sorted[i].timestamp).getTime() - new Date(sorted[i - 1].timestamp).getTime()) / 1000);
      const rxBps = Math.max(0, (sorted[i].rxBytes - sorted[i - 1].rxBytes) * 8 / dt);
      const txBps = Math.max(0, (sorted[i].txBytes - sorted[i - 1].txBytes) * 8 / dt);
      if (!trafficByInterface[sorted[i].interfaceName]) trafficByInterface[sorted[i].interfaceName] = [];
      trafficByInterface[sorted[i].interfaceName].push({
        timestamp: formatTime(sorted[i].timestamp),
        "Rx (Mbps)": parseFloat((rxBps / 1_000_000).toFixed(2)),
        "Tx (Mbps)": parseFloat((txBps / 1_000_000).toFixed(2)),
      });
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0b0c0e" }}>
      <TopNav />
      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "24px" }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#e0e0e0" }}>Panel Principal</h1>
            <p style={{ fontSize: "12px", color: "#5a5f6a" }}>Monitoreo de red MikroTik en tiempo real</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="panel"><div className="panel-body text-center">
            <p style={{ fontSize: "10px", color: "#5a5f6a", textTransform: "uppercase", letterSpacing: "0.04em" }}>Dispositivos</p>
            <p style={{ fontSize: "28px", fontWeight: 700, color: "#e0e0e0", fontVariantNumeric: "tabular-nums" }}>{summary.totalDevices}</p>
          </div></div>
          <div className="panel"><div className="panel-body text-center">
            <p style={{ fontSize: "10px", color: "#5a5f6a", textTransform: "uppercase", letterSpacing: "0.04em" }}>En Línea</p>
            <p style={{ fontSize: "28px", fontWeight: 700, color: "#73bf69", fontVariantNumeric: "tabular-nums" }}>{summary.onlineDevices}</p>
          </div></div>
          <div className="panel"><div className="panel-body text-center">
            <p style={{ fontSize: "10px", color: "#5a5f6a", textTransform: "uppercase", letterSpacing: "0.04em" }}>Fuera de Línea</p>
            <p style={{ fontSize: "28px", fontWeight: 700, color: "#f2495c", fontVariantNumeric: "tabular-nums" }}>{summary.offlineDevices}</p>
          </div></div>
          <div className="panel"><div className="panel-body text-center">
            <p style={{ fontSize: "10px", color: "#5a5f6a", textTransform: "uppercase", letterSpacing: "0.04em" }}>DNS 8.8.8.8</p>
            <p style={{ fontSize: "28px", fontWeight: 700, color: sel?.googleDnsPing?.success ? getLatencyColor(sel.googleDnsPing.rttAvg) : "#5a5f6a", fontVariantNumeric: "tabular-nums" }}>
              {sel?.googleDnsPing?.success ? `${sel.googleDnsPing.rttAvg}` : "—"}
            </p>
            {sel?.googleDnsPing?.success && <p style={{ fontSize: "10px", color: "#5a5f6a" }}>ms</p>}
          </div></div>
        </div>

        {devices.length === 0 ? (
          <div className="panel" style={{ textAlign: "center", padding: "48px 24px" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#5a5f6a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px" }}>
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            <p style={{ color: "#8e8e8e", fontSize: "14px" }}>No hay dispositivos configurados</p>
            <a href="/dashboard/devices" className="btn-primary" style={{ display: "inline-block", marginTop: "16px" }}>Agregar Dispositivo</a>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {devices.map((device) => (
                <div
                  key={device.id}
                  onClick={() => setSelectedDevice(device.id)}
                  style={{
                    cursor: "pointer", borderRadius: "4px",
                    outline: selectedDevice === device.id ? "2px solid #3b82f6" : "2px solid transparent",
                    outlineOffset: "-1px", transition: "outline 0.15s ease",
                  }}
                >
                  <DeviceCard
                    name={device.name} host={device.host} port={device.port} status={device.status}
                    cpuLoad={device.system?.cpuLoad} freeMemory={device.system?.freeMemory}
                    totalMemory={device.system?.totalMemory} uptime={device.system?.uptime}
                    routerosVersion={device.routerosVersion || undefined}
                    onCollectMetrics={() => collectMetrics(device.id)}
                    onDelete={() => deleteDevice(device.id)}
                    collecting={collecting[device.id]}
                  />
                </div>
              ))}
            </div>

            {sel && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#e0e0e0" }}>{sel.name}</h2>
                  <span style={{ color: "#5a5f6a", fontSize: "13px" }}>— Detalles del Dispositivo</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                  <div className="panel">
                    <div className="panel-header">
                      <div className="flex items-center justify-between w-full">
                        <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#d8d9da" }}>Tráfico WAN</h3>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={wanInput}
                            onChange={(e) => setWanInput(e.target.value)}
                            placeholder="eth1, ether1, pppoe-out1..."
                            className="input-field"
                            style={{ width: 180, fontSize: "11px", padding: "3px 8px" }}
                          />
                          <button
                            onClick={saveWanInterface}
                            disabled={savingWan}
                            className="btn-primary"
                            style={{ padding: "3px 10px", fontSize: "10px" }}
                          >
                            {savingWan ? "..." : "Guardar"}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="panel-body">
                      {wanInterface ? (
                        <>
                          <div className="flex justify-around mb-4">
                            <WanGauge
                              label="Descarga (Rx)"
                              value={wanRxRate > 1_000_000 ? (wanRxRate / 1_000_000).toFixed(1) : wanRxRate > 1_000 ? (wanRxRate / 1_000).toFixed(0) : wanRxRate.toFixed(0)}
                              unit={wanRxRate > 1_000_000 ? "Mbps" : wanRxRate > 1_000 ? "Kbps" : "bps"}
                              color="#b877d9"
                            />
                            <WanGauge
                              label="Rx Total"
                              value={formatBytes(wanInterface.rxBytes).split(" ")[0]}
                              unit={formatBytes(wanInterface.rxBytes).split(" ")[1]}
                              color="#6e9fff"
                            />
                            <WanGauge
                              label="Tx Total"
                              value={formatBytes(wanInterface.txBytes).split(" ")[0]}
                              unit={formatBytes(wanInterface.txBytes).split(" ")[1]}
                              color="#6e9fff"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`status-dot ${wanInterface.status === "running" ? "status-dot-online" : "status-dot-offline"}`} />
                            <span style={{ fontSize: "11px", color: "#8e8e8e" }}>
                              {wanName} — {wanInterface.status === "running" ? "Activo" : "Inactivo"}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div style={{ textAlign: "center", padding: "20px 0" }}>
                          <p style={{ fontSize: "12px", color: "#5a5f6a", marginBottom: "8px" }}>
                            Configure la interfaz WAN para ver el tráfico
                          </p>
                          {sel.interfaces.length > 0 && (
                            <div className="flex flex-wrap gap-1 justify-center">
                              {sel.interfaces.map((i) => (
                                <button
                                  key={i.interfaceName}
                                  onClick={() => { setWanInput(i.interfaceName); }}
                                  className="btn-secondary"
                                  style={{ padding: "2px 8px", fontSize: "10px" }}
                                >
                                  {i.interfaceName}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panel-header">
                      <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#d8d9da" }}>Latencia</h3>
                    </div>
                    <div className="panel-body">
                      <div className="flex justify-around mb-4">
                        <div className="text-center">
                          <p style={{ fontSize: "9px", color: "#5a5f6a", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Router ({sel.host})</p>
                          <p style={{ fontSize: "24px", fontWeight: 700, color: sel.latency ? getLatencyColor(sel.latency.rttAvg) : "#5a5f6a", fontVariantNumeric: "tabular-nums" }}>
                            {sel.latency ? sel.latency.rttAvg : "—"}
                          </p>
                          {sel.latency && <p style={{ fontSize: "10px", color: "#5a5f6a" }}>ms — {getLatencyLabel(sel.latency.rttAvg)}</p>}
                        </div>
                        <div className="text-center">
                          <p style={{ fontSize: "9px", color: "#5a5f6a", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>DNS 8.8.8.8 (desde router)</p>
                          <p style={{ fontSize: "24px", fontWeight: 700, color: sel.googleDnsPing?.success ? getLatencyColor(sel.googleDnsPing.rttAvg) : "#f2495c", fontVariantNumeric: "tabular-nums" }}>
                            {sel.googleDnsPing?.success ? sel.googleDnsPing.rttAvg : "—"}
                          </p>
                          {sel.googleDnsPing?.success && (
                            <p style={{ fontSize: "10px", color: "#5a5f6a" }}>
                              ms — {getLatencyLabel(sel.googleDnsPing.rttAvg)} — Pérdida: {sel.googleDnsPing.packetLoss}%
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {wanTrafficChart.length > 0 && (
                  <div className="mb-4">
                    <MetricAreaChart
                      data={wanTrafficChart}
                      dataKeys={[
                        { key: "Rx (Mbps)", color: "#b877d9", name: "Descarga" },
                      ]}
                      title={`Tráfico WAN — ${wanName}`}
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                  {cpuChartData.length > 0 && (
                    <MetricLineChart
                      data={cpuChartData}
                      dataKeys={[{ key: "CPU %", color: "#3b82f6", name: "CPU" }]}
                      title="Carga del Procesador"
                    />
                  )}
                  {memoryChartData.length > 0 && (
                    <MetricAreaChart
                      data={memoryChartData}
                      dataKeys={[
                        { key: "Usado (MB)", color: "#f2495c", name: "Usado" },
                        { key: "Libre (MB)", color: "#73bf69", name: "Libre" },
                      ]}
                      title="Uso de Memoria"
                    />
                  )}
                </div>

                {Object.entries(trafficByInterface).filter(([name]) => name !== wanName && !["ether2", "ether3", "ether4", "ether5"].includes(name)).map(([ifaceName, data]) =>
                  data.length > 0 ? (
                    <div key={ifaceName} className="mb-4">
                      <MetricAreaChart
                        data={data}
                        dataKeys={[
                          { key: "Rx (Mbps)", color: "#b877d9", name: "Bajada" },
                          { key: "Tx (Mbps)", color: "#ff9830", name: "Subida" },
                        ]}
                        title={`Tráfico — ${ifaceName}`}
                      />
                    </div>
                  ) : null
                )}

                {sel.firewall && (
                  <div className="panel mb-4">
                    <div className="panel-header">
                      <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#d8d9da" }}>Resumen de Firewall</h3>
                    </div>
                    <div className="panel-body">
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                        {[
                          { label: "Total", value: sel.firewall.totalRules, color: "#e0e0e0" },
                          { label: "Filtro", value: sel.firewall.filterRules, color: "#3b82f6" },
                          { label: "NAT", value: sel.firewall.natRules, color: "#73bf69" },
                          { label: "Mangle", value: sel.firewall.mangleRules, color: "#ff9830" },
                          { label: "Fasttrack", value: sel.firewall.fasttrackRules, color: "#f2495c" },
                        ].map((item) => (
                          <div key={item.label} className="text-center">
                            <p style={{ fontSize: "10px", color: "#5a5f6a", textTransform: "uppercase", letterSpacing: "0.04em" }}>{item.label}</p>
                            <p style={{ fontSize: "22px", fontWeight: 700, color: item.color, fontVariantNumeric: "tabular-nums" }}>{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="panel">
                  <div className="panel-header">
                    <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#d8d9da" }}>Herramientas de Red</h3>
                  </div>
                  <div className="panel-body">
                    <div className="flex items-center gap-2 mb-4">
                      <input
                        type="text"
                        value={diagTarget}
                        onChange={(e) => setDiagTarget(e.target.value)}
                        placeholder="IP o dominio (ej: 8.8.8.8, google.com)"
                        className="input-field"
                        style={{ flex: 1 }}
                        onKeyDown={(e) => e.key === "Enter" && runDiagnostic()}
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={() => setDiagMode("ping")}
                          className={diagMode === "ping" ? "btn-primary" : "btn-secondary"}
                          style={{ padding: "6px 12px", fontSize: "11px" }}
                        >
                          Ping
                        </button>
                        <button
                          onClick={() => setDiagMode("traceroute")}
                          className={diagMode === "traceroute" ? "btn-primary" : "btn-secondary"}
                          style={{ padding: "6px 12px", fontSize: "11px" }}
                        >
                          Traceroute
                        </button>
                      </div>
                      <button
                        onClick={runDiagnostic}
                        disabled={diagRunning || !diagTarget || !selectedDevice}
                        className="btn-success"
                        style={{ padding: "6px 16px" }}
                      >
                        {diagRunning ? "Ejecutando..." : "Ejecutar"}
                      </button>
                    </div>

                    {diagMode === "ping" && pingResult && (
                      <div>
                        <div className="flex justify-around mb-3" style={{ padding: "12px 0", borderTop: "1px solid #2c3039", borderBottom: "1px solid #2c3039" }}>
                          <div className="text-center">
                            <p style={{ fontSize: "9px", color: "#5a5f6a", textTransform: "uppercase", letterSpacing: "0.06em" }}>Promedio</p>
                            <p style={{ fontSize: "22px", fontWeight: 700, color: getLatencyColor(pingResult.rttAvg), fontVariantNumeric: "tabular-nums" }}>
                              {pingResult.success ? `${pingResult.rttAvg} ms` : "—"}
                            </p>
                          </div>
                          <div className="text-center">
                            <p style={{ fontSize: "9px", color: "#5a5f6a", textTransform: "uppercase", letterSpacing: "0.06em" }}>Mínimo</p>
                            <p style={{ fontSize: "22px", fontWeight: 700, color: "#73bf69", fontVariantNumeric: "tabular-nums" }}>
                              {pingResult.success ? `${pingResult.rttMin} ms` : "—"}
                            </p>
                          </div>
                          <div className="text-center">
                            <p style={{ fontSize: "9px", color: "#5a5f6a", textTransform: "uppercase", letterSpacing: "0.06em" }}>Máximo</p>
                            <p style={{ fontSize: "22px", fontWeight: 700, color: "#f2495c", fontVariantNumeric: "tabular-nums" }}>
                              {pingResult.success ? `${pingResult.rttMax} ms` : "—"}
                            </p>
                          </div>
                          <div className="text-center">
                            <p style={{ fontSize: "9px", color: "#5a5f6a", textTransform: "uppercase", letterSpacing: "0.06em" }}>Pérdida</p>
                            <p style={{ fontSize: "22px", fontWeight: 700, color: pingResult.packetLoss > 0 ? "#f2495c" : "#73bf69", fontVariantNumeric: "tabular-nums" }}>
                              {pingResult.packetLoss}%
                            </p>
                          </div>
                          <div className="text-center">
                            <p style={{ fontSize: "9px", color: "#5a5f6a", textTransform: "uppercase", letterSpacing: "0.06em" }}>Estado</p>
                            <p style={{ fontSize: "14px", fontWeight: 700, color: pingResult.success ? "#73bf69" : "#f2495c" }}>
                              {pingResult.success ? "Alcanzable" : "No responde"}
                            </p>
                          </div>
                        </div>
                        <p style={{ fontSize: "10px", color: "#5a5f6a" }}>
                          Ping desde {sel.name} ({sel.host}) → {diagTarget}
                        </p>
                      </div>
                    )}

                    {diagMode === "traceroute" && tracerResult.length > 0 && (
                      <div>
                        <table style={{ width: "100%", fontSize: "12px", borderTop: "1px solid #2c3039" }}>
                          <thead>
                            <tr style={{ borderBottom: "1px solid #2c3039" }}>
                              {["Salto", "Dirección", "Tiempo"].map((h) => (
                                <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#5a5f6a", fontWeight: 600, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tracerResult.map((hop) => (
                              <tr key={hop.hop} style={{ borderBottom: "1px solid #1e2028" }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)")}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                              >
                                <td style={{ padding: "6px 12px", color: "#5a5f6a", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{hop.hop}</td>
                                <td style={{ padding: "6px 12px", color: "#d8d9da", fontVariantNumeric: "tabular-nums" }}>{hop.address}</td>
                                <td style={{ padding: "6px 12px", color: "#8e8e8e", fontVariantNumeric: "tabular-nums" }}>{hop.time}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <p style={{ fontSize: "10px", color: "#5a5f6a", marginTop: "8px" }}>
                          Traceroute desde {sel.name} ({sel.host}) → {diagTarget}
                        </p>
                      </div>
                    )}

                    {!pingResult && tracerResult.length === 0 && !diagRunning && (
                      <div style={{ textAlign: "center", padding: "16px 0", color: "#5a5f6a", fontSize: "12px" }}>
                        Ingrese una IP o dominio y presione Ejecutar para diagnosticar
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
