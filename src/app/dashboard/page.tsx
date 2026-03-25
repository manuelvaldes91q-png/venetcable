"use client";

import { useState, useEffect, useCallback } from "react";
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

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null
  );
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [metricHistory, setMetricHistory] = useState<MetricHistory | null>(
    null
  );
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
      const interval = setInterval(
        () => fetchMetricHistory(selectedDevice),
        15000
      );
      return () => clearInterval(interval);
    }
  }, [selectedDevice, fetchMetricHistory]);

  const collectMetrics = async (deviceId: number) => {
    setCollecting((prev) => ({ ...prev, [deviceId]: true }));
    try {
      await fetch("/api/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });
      await fetchDashboard();
      if (selectedDevice === deviceId) {
        await fetchMetricHistory(deviceId);
      }
    } catch {
    } finally {
      setCollecting((prev) => ({ ...prev, [deviceId]: false }));
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

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    } catch {
      return ts;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 text-lg">Loading dashboard...</div>
      </div>
    );
  }

  const summary = dashboardData?.summary || {
    totalDevices: 0,
    onlineDevices: 0,
    offlineDevices: 0,
  };
  const devices = dashboardData?.devices || [];

  const selectedDeviceData = devices.find((d) => d.id === selectedDevice);

  const cpuChartData =
    metricHistory?.system
      ?.slice()
      .reverse()
      .map((s) => ({
        timestamp: formatTimestamp(s.timestamp),
        CPU: s.cpuLoad,
      })) || [];

  const memoryChartData =
    metricHistory?.system
      ?.slice()
      .reverse()
      .map((s) => ({
        timestamp: formatTimestamp(s.timestamp),
        "Used (MB)": parseFloat(
          ((s.totalMemory - s.freeMemory) / 1024 / 1024).toFixed(1)
        ),
        "Free (MB)": parseFloat((s.freeMemory / 1024 / 1024).toFixed(1)),
      })) || [];

  const trafficByInterface: Record<string, { timestamp: string; Rx: number; Tx: number }[]> = {};
  metricHistory?.interfaces
    ?.slice()
    .reverse()
    .forEach((iface) => {
      if (!trafficByInterface[iface.interfaceName]) {
        trafficByInterface[iface.interfaceName] = [];
      }
      trafficByInterface[iface.interfaceName].push({
        timestamp: formatTimestamp(iface.timestamp),
        Rx: parseFloat((iface.rxBytes / 1024 / 1024).toFixed(2)),
        Tx: parseFloat((iface.txBytes / 1024 / 1024).toFixed(2)),
      });
    });

  const firewallChartData =
    metricHistory?.firewall
      ?.slice()
      .reverse()
      .map((f) => ({
        timestamp: formatTimestamp(f.timestamp),
        Filter: f.filterRules,
        NAT: f.natRules,
        Mangle: f.mangleRules,
        Fasttrack: f.fasttrackRules,
      })) || [];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">
              MikroTik Monitor
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              RouterOS v6 Monitoring Dashboard
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/dashboard/antennas"
              className="px-4 py-2 text-sm font-medium bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
            >
              Antennas
            </a>
            <a
              href="/dashboard/devices"
              className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
            >
              Manage Devices
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard title="Total Devices" value={summary.totalDevices} />
          <StatCard
            title="Online"
            value={summary.onlineDevices}
            subtitle="Connected"
          />
          <StatCard
            title="Offline"
            value={summary.offlineDevices}
            subtitle="Not reachable"
          />
        </div>

        {devices.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-12 border border-gray-700 text-center">
            <p className="text-gray-400 text-lg mb-2">No devices configured</p>
            <p className="text-gray-500 text-sm">
              Add your first MikroTik device to start monitoring.
            </p>
            <a
              href="/dashboard/devices"
              className="inline-block mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm transition-colors"
            >
              Add Device
            </a>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {devices.map((device) => (
                <div
                  key={device.id}
                  onClick={() => setSelectedDevice(device.id)}
                  className={`cursor-pointer rounded-lg transition-all ${
                    selectedDevice === device.id
                      ? "ring-2 ring-blue-500"
                      : "ring-1 ring-transparent"
                  }`}
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
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white">
                  {selectedDeviceData.name} — Historical Data (24h)
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {cpuChartData.length > 0 && (
                    <MetricLineChart
                      data={cpuChartData}
                      dataKeys={[{ key: "CPU", color: "#3B82F6", name: "CPU %" }]}
                      title="CPU Load"
                    />
                  )}

                  {memoryChartData.length > 0 && (
                    <MetricAreaChart
                      data={memoryChartData}
                      dataKeys={[
                        {
                          key: "Used (MB)",
                          color: "#EF4444",
                          name: "Used",
                        },
                        {
                          key: "Free (MB)",
                          color: "#10B981",
                          name: "Free",
                        },
                      ]}
                      title="Memory Usage"
                    />
                  )}
                </div>

                {Object.entries(trafficByInterface).map(
                  ([ifaceName, data]) =>
                    data.length > 0 && (
                      <MetricAreaChart
                        key={ifaceName}
                        data={data}
                        dataKeys={[
                          { key: "Rx", color: "#8B5CF6", name: "Rx (MB)" },
                          { key: "Tx", color: "#F59E0B", name: "Tx (MB)" },
                        ]}
                        title={`Interface Traffic — ${ifaceName}`}
                      />
                    )
                )}

                {firewallChartData.length > 0 && (
                  <MetricBarChart
                    data={firewallChartData}
                    dataKeys={[
                      { key: "Filter", color: "#3B82F6", name: "Filter" },
                      { key: "NAT", color: "#10B981", name: "NAT" },
                      { key: "Mangle", color: "#F59E0B", name: "Mangle" },
                      { key: "Fasttrack", color: "#EF4444", name: "Fasttrack" },
                    ]}
                    title="Firewall Rules Distribution"
                  />
                )}

                {selectedDeviceData.firewall && (
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h3 className="text-sm font-medium text-gray-300 mb-3">
                      Firewall Summary
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div>
                        <p className="text-xs text-gray-500">Total Rules</p>
                        <p className="text-lg font-bold text-white">
                          {selectedDeviceData.firewall.totalRules}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Filter</p>
                        <p className="text-lg font-bold text-blue-400">
                          {selectedDeviceData.firewall.filterRules}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">NAT</p>
                        <p className="text-lg font-bold text-green-400">
                          {selectedDeviceData.firewall.natRules}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Mangle</p>
                        <p className="text-lg font-bold text-yellow-400">
                          {selectedDeviceData.firewall.mangleRules}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Fasttrack</p>
                        <p className="text-lg font-bold text-red-400">
                          {selectedDeviceData.firewall.fasttrackRules}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedDeviceData.interfaces.length > 0 && (
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h3 className="text-sm font-medium text-gray-300 mb-3">
                      Interfaces
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 border-b border-gray-700">
                            <th className="pb-2 pr-4">Name</th>
                            <th className="pb-2 pr-4">Status</th>
                            <th className="pb-2 pr-4">Rx</th>
                            <th className="pb-2">Tx</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedDeviceData.interfaces.map((iface, i) => (
                            <tr
                              key={i}
                              className="border-b border-gray-700/50"
                            >
                              <td className="py-2 pr-4 text-white">
                                {iface.interfaceName}
                              </td>
                              <td className="py-2 pr-4">
                                <span
                                  className={`inline-flex items-center gap-1.5 ${
                                    iface.status === "running"
                                      ? "text-green-400"
                                      : "text-gray-500"
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      iface.status === "running"
                                        ? "bg-green-400"
                                        : "bg-gray-500"
                                    }`}
                                  />
                                  {iface.status}
                                </span>
                              </td>
                              <td className="py-2 pr-4 text-gray-300">
                                {formatBytes(iface.rxBytes)}
                              </td>
                              <td className="py-2 text-gray-300">
                                {formatBytes(iface.txBytes)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
