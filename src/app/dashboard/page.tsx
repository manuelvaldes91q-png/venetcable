"use client";

import { useState, useEffect, useCallback } from "react";
import { TopNav } from "@/components/ui/TopNav";
import { MetricLineChart, MetricAreaChart, MetricBarChart } from "@/components/ui/Charts";
import { StatCard, DeviceCard } from "@/components/ui/Cards";
import { formatBytes } from "@/lib/utils";

interface DashboardDevice {
  id: number;
  name: string;
  host: string;
  port: number;
  status: string;
  routerosVersion: string | null;
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
}

interface DashboardData {
  summary: {
    totalDevices: number;
    onlineDevices: number;
    offlineDevices: number;
  };
  devices: DashboardDevice[];
}

interface MetricHistory {
  system: {
    cpuLoad: number;
    freeMemory: number;
    totalMemory: number;
    uptime: string;
    timestamp: string;
  }[];
  interfaces: {
    interfaceName: string;
    rxBytes: number;
    txBytes: number;
    timestamp: string;
  }[];
  firewall: {
    totalRules: number;
    fasttrackRules: number;
    filterRules: number;
    natRules: number;
    mangleRules: number;
    timestamp: string;
  }[];
}

function formatTime(ts: string) {
  try {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  } catch {
    return ts;
  }
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [metricHistory, setMetricHistory] = useState<MetricHistory | null>(null);
  const [collecting, setCollecting] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);

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

  const fetchMetricHistory = useCallback(async (deviceId: number) => {
    try {
      const res = await fetch(`/api/metrics?deviceId=${deviceId}&hours=24`);
      if (res.ok) {
        const data = await res.json();
        setMetricHistory(data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  useEffect(() => {
    if (selectedDevice) {
      fetchMetricHistory(selectedDevice);
      const interval = setInterval(() => fetchMetricHistory(selectedDevice), 15000);
      return () => clearInterval(interval);
    }
  }, [selectedDevice, fetchMetricHistory]);

  const collectMetrics = async (deviceId: number) => {
    setCollecting((p) => ({ ...p, [deviceId]: true }));
    try {
      await fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });
      await fetchDashboard();
      if (selectedDevice === deviceId) await fetchMetricHistory(deviceId);
    } catch {
    } finally {
      setCollecting((p) => ({ ...p, [deviceId]: false }));
    }
  };

  const deleteDevice = async (deviceId: number) => {
    try {
      await fetch(`/api/devices?id=${deviceId}`, { method: "DELETE" });
      if (selectedDevice === deviceId) {
        setSelectedDevice(null);
        setMetricHistory(null);
      }
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
  const selectedDeviceData = devices.find((d) => d.id === selectedDevice);

  const cpuChartData = metricHistory?.system?.slice().reverse().map((s) => ({
    timestamp: formatTime(s.timestamp),
    "CPU %": s.cpuLoad,
  })) || [];

  const memoryChartData = metricHistory?.system?.slice().reverse().map((s) => ({
    timestamp: formatTime(s.timestamp),
    "Usado (MB)": parseFloat(((s.totalMemory - s.freeMemory) / 1024 / 1024).toFixed(1)),
    "Libre (MB)": parseFloat((s.freeMemory / 1024 / 1024).toFixed(1)),
  })) || [];

  const trafficByInterface: Record<string, { timestamp: string; Rx: number; Tx: number }[]> = {};
  metricHistory?.interfaces?.slice().reverse().forEach((iface) => {
    if (!trafficByInterface[iface.interfaceName]) trafficByInterface[iface.interfaceName] = [];
    trafficByInterface[iface.interfaceName].push({
      timestamp: formatTime(iface.timestamp),
      Rx: parseFloat((iface.rxBytes / 1024 / 1024).toFixed(2)),
      Tx: parseFloat((iface.txBytes / 1024 / 1024).toFixed(2)),
    });
  });

  const firewallChartData = metricHistory?.firewall?.slice().reverse().map((f) => ({
    timestamp: formatTime(f.timestamp),
    Filtro: f.filterRules,
    NAT: f.natRules,
    Mangle: f.mangleRules,
    Fasttrack: f.fasttrackRules,
  })) || [];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0b0c0e" }}>
      <TopNav />

      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "24px" }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#e0e0e0" }}>
              Resumen del Sistema
            </h1>
            <p style={{ fontSize: "12px", color: "#5a5f6a", marginTop: "2px" }}>
              Monitoreo de dispositivos MikroTik en tiempo real
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard
            title="Dispositivos"
            value={summary.totalDevices}
            subtitle="Total registrados"
          />
          <StatCard
            title="En Línea"
            value={summary.onlineDevices}
            subtitle="Conectados"
          />
          <StatCard
            title="Fuera de Línea"
            value={summary.offlineDevices}
            subtitle="Sin conexión"
          />
          <StatCard
            title="Uptime Promedio"
            value={devices.filter((d) => d.system).length > 0
              ? devices.filter((d) => d.system).map((d) => d.system!.uptime).join(", ").substring(0, 12) || "—"
              : "—"
            }
          />
        </div>

        {devices.length === 0 ? (
          <div className="panel" style={{ textAlign: "center", padding: "48px 24px" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#5a5f6a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px" }}>
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            <p style={{ color: "#8e8e8e", fontSize: "14px", marginBottom: "4px" }}>
              No hay dispositivos configurados
            </p>
            <p style={{ color: "#5a5f6a", fontSize: "12px" }}>
              Agregue su primer dispositivo MikroTik para comenzar el monitoreo.
            </p>
            <a href="/dashboard/devices" className="btn-primary" style={{ display: "inline-block", marginTop: "16px" }}>
              Agregar Dispositivo
            </a>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {devices.map((device) => (
                <div
                  key={device.id}
                  onClick={() => setSelectedDevice(device.id)}
                  style={{
                    cursor: "pointer",
                    borderRadius: "4px",
                    transition: "outline 0.15s ease",
                    outline: selectedDevice === device.id ? "2px solid #3b82f6" : "2px solid transparent",
                    outlineOffset: "-1px",
                  }}
                >
                  <DeviceCard
                    name={device.name}
                    host={device.host}
                    port={device.port}
                    status={device.status}
                    cpuLoad={device.system?.cpuLoad}
                    freeMemory={device.system?.freeMemory}
                    totalMemory={device.system?.totalMemory}
                    uptime={device.system?.uptime}
                    routerosVersion={device.routerosVersion || undefined}
                    onCollectMetrics={() => collectMetrics(device.id)}
                    onDelete={() => deleteDevice(device.id)}
                    collecting={collecting[device.id]}
                  />
                </div>
              ))}
            </div>

            {selectedDeviceData && metricHistory && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#e0e0e0" }}>
                    {selectedDeviceData.name}
                  </h2>
                  <span style={{ color: "#5a5f6a", fontSize: "13px" }}>
                    — Histórico (24h)
                  </span>
                </div>

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

                {Object.entries(trafficByInterface).map(([ifaceName, data]) =>
                  data.length > 0 ? (
                    <div key={ifaceName} className="mb-4">
                      <MetricAreaChart
                        data={data}
                        dataKeys={[
                          { key: "Rx", color: "#b877d9", name: "Rx (MB)" },
                          { key: "Tx", color: "#ff9830", name: "Tx (MB)" },
                        ]}
                        title={`Tráfico de Interfaz — ${ifaceName}`}
                      />
                    </div>
                  ) : null
                )}

                {firewallChartData.length > 0 && (
                  <div className="mb-4">
                    <MetricBarChart
                      data={firewallChartData}
                      dataKeys={[
                        { key: "Filtro", color: "#3b82f6", name: "Filtro" },
                        { key: "NAT", color: "#73bf69", name: "NAT" },
                        { key: "Mangle", color: "#ff9830", name: "Mangle" },
                        { key: "Fasttrack", color: "#f2495c", name: "Fasttrack" },
                      ]}
                      title="Distribución de Reglas de Firewall"
                    />
                  </div>
                )}

                {selectedDeviceData.firewall && (
                  <div className="panel mb-4">
                    <div className="panel-header">
                      <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#d8d9da" }}>
                        Resumen de Firewall
                      </h3>
                    </div>
                    <div className="panel-body">
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                        {[
                          { label: "Total Reglas", value: selectedDeviceData.firewall.totalRules, color: "#e0e0e0" },
                          { label: "Filtro", value: selectedDeviceData.firewall.filterRules, color: "#3b82f6" },
                          { label: "NAT", value: selectedDeviceData.firewall.natRules, color: "#73bf69" },
                          { label: "Mangle", value: selectedDeviceData.firewall.mangleRules, color: "#ff9830" },
                          { label: "Fasttrack", value: selectedDeviceData.firewall.fasttrackRules, color: "#f2495c" },
                        ].map((item) => (
                          <div key={item.label} className="text-center">
                            <p style={{ fontSize: "11px", color: "#5a5f6a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                              {item.label}
                            </p>
                            <p style={{ fontSize: "22px", fontWeight: 700, color: item.color, fontVariantNumeric: "tabular-nums" }}>
                              {item.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {selectedDeviceData.interfaces.length > 0 && (
                  <div className="panel">
                    <div className="panel-header">
                      <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#d8d9da" }}>
                        Interfaces de Red
                      </h3>
                    </div>
                    <div className="panel-body" style={{ padding: 0 }}>
                      <div className="overflow-x-auto">
                        <table style={{ width: "100%", fontSize: "12px" }}>
                          <thead>
                            <tr style={{ borderBottom: "1px solid #2c3039" }}>
                              {["Nombre", "Estado", "Rx", "Tx"].map((h) => (
                                <th
                                  key={h}
                                  style={{
                                    padding: "10px 16px",
                                    textAlign: "left",
                                    color: "#5a5f6a",
                                    fontWeight: 600,
                                    fontSize: "11px",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.04em",
                                  }}
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {selectedDeviceData.interfaces.map((iface, i) => (
                              <tr
                                key={i}
                                style={{
                                  borderBottom: "1px solid #1e2028",
                                  transition: "background-color 0.1s",
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)")}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                              >
                                <td style={{ padding: "8px 16px", color: "#d8d9da", fontWeight: 500 }}>
                                  {iface.interfaceName}
                                </td>
                                <td style={{ padding: "8px 16px" }}>
                                  <span
                                    className="inline-flex items-center gap-1.5"
                                    style={{
                                      color: iface.status === "running" ? "#73bf69" : "#5a5f6a",
                                      fontSize: "11px",
                                    }}
                                  >
                                    <span
                                      className={`status-dot ${iface.status === "running" ? "status-dot-online" : "status-dot-offline"}`}
                                      style={{ width: 6, height: 6 }}
                                    />
                                    {iface.status === "running" ? "Activo" : "Detenido"}
                                  </span>
                                </td>
                                <td style={{ padding: "8px 16px", color: "#8e8e8e", fontVariantNumeric: "tabular-nums" }}>
                                  {formatBytes(iface.rxBytes)}
                                </td>
                                <td style={{ padding: "8px 16px", color: "#8e8e8e", fontVariantNumeric: "tabular-nums" }}>
                                  {formatBytes(iface.txBytes)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
