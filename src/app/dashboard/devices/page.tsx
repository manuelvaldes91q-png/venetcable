"use client";

import { useState, useEffect, useCallback } from "react";
import { TopNav } from "@/components/ui/TopNav";

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
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
          text: `Dispositivo agregado correctamente. Conexión: ${data.connectionTest?.success ? "OK" : "Fallida"}`,
        });
        setFormData({ name: "", host: "", port: 8728, username: "", password: "" });
        setShowForm(false);
        await fetchDevices();
      } else {
        setMessage({ type: "error", text: data.error || "Error al agregar dispositivo" });
      }
    } catch {
      setMessage({ type: "error", text: "Error de red" });
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0b0c0e" }}>
        <div style={{ color: "#8e8e8e", fontSize: "14px" }}>Cargando dispositivos...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0b0c0e" }}>
      <TopNav />

      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "24px" }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#e0e0e0" }}>
              Gestión de Dispositivos
            </h1>
            <p style={{ fontSize: "12px", color: "#5a5f6a", marginTop: "2px" }}>
              Administre sus dispositivos MikroTik conectados vía API
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary"
          >
            {showForm ? "Cancelar" : "+ Agregar Dispositivo"}
          </button>
        </div>

        {message && (
          <div className={message.type === "success" ? "toast-success" : "toast-error"} style={{ marginBottom: "16px" }}>
            {message.text}
          </div>
        )}

        {showForm && (
          <div className="panel mb-6">
            <div className="panel-header">
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#e0e0e0" }}>
                Agregar Dispositivo MikroTik
              </h3>
            </div>
            <div className="panel-body">
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="label-text">Nombre del Dispositivo *</label>
                    <input type="text" required value={formData.name} onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))} placeholder="Ej. Router Central" className="input-field" />
                  </div>
                  <div>
                    <label className="label-text">Host / IP *</label>
                    <input type="text" required value={formData.host} onChange={(e) => setFormData((p) => ({ ...p, host: e.target.value }))} placeholder="Ej. 192.168.1.1" className="input-field" />
                  </div>
                  <div>
                    <label className="label-text">Puerto API</label>
                    <input type="number" value={formData.port} onChange={(e) => setFormData((p) => ({ ...p, port: parseInt(e.target.value, 10) || 8728 }))} placeholder="8728" className="input-field" />
                    <p style={{ fontSize: "10px", color: "#5a5f6a", marginTop: "4px" }}>
                      Predeterminado: 8728 (plain) o 8729 (TLS). Configurable para NAT/seguridad personalizada.
                    </p>
                  </div>
                  <div>
                    <label className="label-text">Usuario *</label>
                    <input type="text" required value={formData.username} onChange={(e) => setFormData((p) => ({ ...p, username: e.target.value }))} placeholder="admin" className="input-field" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label-text">Contraseña *</label>
                    <input type="password" required value={formData.password} onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))} placeholder="••••••••" className="input-field" />
                    <p style={{ fontSize: "10px", color: "#5a5f6a", marginTop: "4px" }}>
                      Almacenada cifrada con AES-256-GCM. Configure la variable de entorno MIKROTIK_ENCRYPTION_SECRET en producción.
                    </p>
                  </div>
                </div>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? "Agregando y Probando..." : "Agregar Dispositivo"}
                </button>
              </form>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {devices.length === 0 ? (
            <div className="panel" style={{ textAlign: "center", padding: "48px 24px" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#5a5f6a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px" }}>
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                <line x1="6" y1="6" x2="6.01" y2="6"/>
                <line x1="6" y1="18" x2="6.01" y2="18"/>
              </svg>
              <p style={{ color: "#8e8e8e", fontSize: "14px", marginBottom: "4px" }}>
                No hay dispositivos configurados
              </p>
              <p style={{ color: "#5a5f6a", fontSize: "12px" }}>
                Agregue su primer dispositivo MikroTik para comenzar.
              </p>
              <button onClick={() => setShowForm(true)} className="btn-primary" style={{ marginTop: "16px" }}>
                Agregar Dispositivo
              </button>
            </div>
          ) : (
            devices.map((device) => (
              <div key={device.id} className="panel">
                <div className="panel-body">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className={`status-dot ${
                          device.status === "online"
                            ? "status-dot-online"
                            : device.status === "offline"
                              ? "status-dot-offline"
                              : "status-dot-unknown"
                        }`}
                      />
                      <div>
                        <p style={{ fontWeight: 600, color: "#e0e0e0", fontSize: "14px" }}>
                          {device.name}
                        </p>
                        <p style={{ fontSize: "12px", color: "#8e8e8e", fontVariantNumeric: "tabular-nums" }}>
                          {device.host}:{device.port} — {device.username}
                          {device.routerosVersion && (
                            <span style={{ marginLeft: 8, color: "#5a5f6a" }}>
                              RouterOS {device.routerosVersion}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(device.id)}
                      className="btn-danger"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
