"use client";

import { useState, useEffect, useCallback } from "react";

interface Device {
  id: number;
  name: string;
  host: string;
  port: number;
  username: string;
  status: string;
  routerosVersion: string | null;
  lastSeen: string | null;
  createdAt: string;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    host: "",
    port: 8728,
    username: "",
    password: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch("/api/devices");
      if (res.ok) {
        const data = await res.json();
        setDevices(data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({
          type: "success",
          text: `Device added successfully. Connection: ${data.connectionTest?.success ? "OK" : "Failed"}`,
        });
        setFormData({ name: "", host: "", port: 8728, username: "", password: "" });
        setShowForm(false);
        await fetchDevices();
      } else {
        setMessage({
          type: "error",
          text: data.error || "Failed to add device",
        });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/devices?id=${id}`, { method: "DELETE" });
      await fetchDevices();
    } catch {}
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading devices...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <a href="/dashboard" className="text-sm text-blue-400 hover:text-blue-300">
              &larr; Back to Dashboard
            </a>
            <h1 className="text-xl font-bold text-white mt-1">
              Device Management
            </h1>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
          >
            {showForm ? "Cancel" : "Add Device"}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">
        {message && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-green-900/50 text-green-300 border border-green-700"
                : "bg-red-900/50 text-red-300 border border-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        {showForm && (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
            <h2 className="text-lg font-semibold mb-4">Add MikroTik Device</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Device Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="e.g. Core Router"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Host / IP *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.host}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, host: e.target.value }))
                    }
                    placeholder="e.g. 192.168.1.1"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    API Port
                  </label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        port: parseInt(e.target.value, 10) || 8728,
                      }))
                    }
                    placeholder="8728"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Default: 8728 (plain) or 8729 (TLS). Configurable for NAT/custom setups.
                  </p>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, username: e.target.value }))
                    }
                    placeholder="admin"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, password: e.target.value }))
                    }
                    placeholder="••••••••"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Stored encrypted with AES-256-GCM. Set MIKROTIK_ENCRYPTION_SECRET env var in production.
                  </p>
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-sm font-medium rounded-md transition-colors"
              >
                {submitting ? "Adding & Testing..." : "Add Device"}
              </button>
            </form>
          </div>
        )}

        <div className="space-y-3">
          {devices.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-12 border border-gray-700 text-center">
              <p className="text-gray-400">No devices configured yet.</p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-3 text-sm text-blue-400 hover:text-blue-300"
              >
                Add your first device
              </button>
            </div>
          ) : (
            devices.map((device) => (
              <div
                key={device.id}
                className="bg-gray-800 rounded-lg p-4 border border-gray-700 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      device.status === "online"
                        ? "bg-green-500"
                        : device.status === "offline"
                          ? "bg-red-500"
                          : "bg-yellow-500"
                    }`}
                  />
                  <div>
                    <p className="font-medium text-white">{device.name}</p>
                    <p className="text-sm text-gray-400">
                      {device.host}:{device.port} — {device.username}
                      {device.routerosVersion &&
                        ` — RouterOS ${device.routerosVersion}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(device.id)}
                  className="px-3 py-1.5 text-xs font-medium bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-md transition-colors"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
