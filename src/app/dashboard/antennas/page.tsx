"use client";

import { useState, useEffect, useCallback } from "react";
import { TopNav } from "@/components/ui/TopNav";

interface Antenna {
  id: number;
  name: string;
  ip: string | null;
  location: string | null;
  status: string;
  reachable: boolean | null;
  pingRtt: number | null;
  deviceId: number | null;
}

interface Device {
  id: number;
  name: string;
  host: string;
  status: string;
}

export default function AntennasPage() {
  const [antennas, setAntennas] = useState<Antenna[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [addForm, setAddForm] = useState({ name: "", ip: "", location: "", deviceId: "" });

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch("/api/devices");
      if (res.ok) {
        const data = await res.json();
        setDevices(data);
      }
    } catch {}
  }, []);

  const fetchAntennas = useCallback(async () => {
    try {
      const res = await fetch("/api/antennas");
      if (res.ok) {
        const data = await res.json();
        setAntennas(data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAntennas();
    fetchDevices();
    const interval = setInterval(fetchAntennas, 60000);
    return () => clearInterval(interval);
  }, [fetchAntennas, fetchDevices]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/antennas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addForm.name,
          ip: addForm.ip || undefined,
          location: addForm.location || undefined,
          deviceId: addForm.deviceId ? parseInt(addForm.deviceId, 10) : undefined,
        }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Antena agregada" });
        setAddForm({ name: "", ip: "", location: "", deviceId: "" });
        setShowAddForm(false);
        await fetchAntennas();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Error" });
      }
    } catch {
      setMessage({ type: "error", text: "Error de red" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/antennas?id=${id}`, { method: "DELETE" });
      await fetchAntennas();
    } catch {}
  };

  const getDeviceName = (deviceId: number | null) => {
    if (!deviceId) return "—";
    const dev = devices.find((d) => d.id === deviceId);
    return dev ? dev.name : "—";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0b0c0e" }}>
        <div style={{ color: "#8e8e8e" }}>Cargando antenas...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0b0c0e" }}>
      <TopNav />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px" }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#e0e0e0" }}>Monitoreo de Antenas</h1>
            <p style={{ fontSize: "12px", color: "#5a5f6a" }}>Ping desde el router MikroTik</p>
          </div>
          <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary">
            {showAddForm ? "Cancelar" : "+ Nueva Antena"}
          </button>
        </div>

        {message && (
          <div className={message.type === "success" ? "toast-success" : "toast-error"} style={{ marginBottom: "16px" }}>
            {message.text}
          </div>
        )}

        {showAddForm && (
          <div className="panel mb-6">
            <div className="panel-header">
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#e0e0e0" }}>Agregar Antena</h3>
            </div>
            <div className="panel-body">
              <form onSubmit={handleAdd}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="label-text">Nombre *</label>
                    <input type="text" required value={addForm.name} onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ej. Sector Norte" className="input-field" />
                  </div>
                  <div>
                    <label className="label-text">IP de la Antena</label>
                    <input type="text" value={addForm.ip} onChange={(e) => setAddForm((p) => ({ ...p, ip: e.target.value }))} placeholder="192.168.1.10" className="input-field" />
                  </div>
                  <div>
                    <label className="label-text">Router MikroTik</label>
                    <select value={addForm.deviceId} onChange={(e) => setAddForm((p) => ({ ...p, deviceId: e.target.value }))} className="select-field">
                      <option value="">Sin router (solo registro)</option>
                      {devices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.host}) — {d.status === "online" ? "En línea" : "Fuera de línea"}
                        </option>
                      ))}
                    </select>
                    <p style={{ fontSize: "10px", color: "#5a5f6a", marginTop: "2px" }}>
                      El ping se ejecutará desde este router
                    </p>
                  </div>
                  <div>
                    <label className="label-text">Ubicación</label>
                    <input type="text" value={addForm.location} onChange={(e) => setAddForm((p) => ({ ...p, location: e.target.value }))} placeholder="Techo Torre A" className="input-field" />
                  </div>
                </div>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? "Agregando..." : "Agregar"}
                </button>
              </form>
            </div>
          </div>
        )}

        <div className="panel">
          <div className="panel-header">
            <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#d8d9da" }}>Estado de Antenas</h3>
            <span style={{ fontSize: "11px", color: "#5a5f6a" }}>{antennas.length}</span>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            {antennas.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px" }}>
                <p style={{ color: "#5a5f6a", fontSize: "13px" }}>Sin antenas registradas</p>
              </div>
            ) : (
              <table style={{ width: "100%", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #2c3039" }}>
                    {["Estado", "Nombre", "IP", "Ping", "Router", "Ubicación", ""].map((h) => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#5a5f6a", fontWeight: 600, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {antennas.map((ant) => {
                    const isUp = ant.ip ? ant.reachable : ant.status === "up";
                    return (
                      <tr key={ant.id} style={{ borderBottom: "1px solid #1e2028" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <td style={{ padding: "10px 16px" }}>
                          <span style={{
                            display: "inline-block", width: 10, height: 10, borderRadius: "50%",
                            backgroundColor: isUp ? "#73bf69" : "#f2495c",
                            boxShadow: isUp ? "0 0 6px rgba(115,191,105,0.5)" : "0 0 6px rgba(242,73,92,0.5)",
                          }} />
                        </td>
                        <td style={{ padding: "10px 16px", color: "#e0e0e0", fontWeight: 600 }}>
                          {ant.name}
                        </td>
                        <td style={{ padding: "10px 16px", color: "#8e8e8e", fontVariantNumeric: "tabular-nums" }}>
                          {ant.ip || "—"}
                        </td>
                        <td style={{ padding: "10px 16px", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: isUp ? "#73bf69" : "#f2495c" }}>
                          {ant.ip
                            ? (ant.deviceId
                              ? (isUp && ant.pingRtt != null ? `${ant.pingRtt} ms` : isUp ? "—" : "Sin respuesta")
                              : <span style={{ fontSize: "11px", color: "#ff9830", fontWeight: 500 }}>Sin router</span>
                            )
                            : "—"
                          }
                        </td>
                        <td style={{ padding: "10px 16px", color: "#8e8e8e", fontSize: "12px" }}>
                          {getDeviceName(ant.deviceId)}
                        </td>
                        <td style={{ padding: "10px 16px", color: "#5a5f6a", fontSize: "12px" }}>
                          {ant.location || "—"}
                        </td>
                        <td style={{ padding: "10px 16px" }}>
                          <button onClick={() => handleDelete(ant.id)} className="btn-danger" style={{ padding: "3px 8px", fontSize: "10px" }}>
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
