"use client";

import { useState, useEffect, useCallback } from "react";
import { TopNav } from "@/components/ui/TopNav";

interface TelegramConfig {
  id: number;
  botToken: string;
  botUsername: string | null;
  enabled: boolean;
  alertDeviceOffline: boolean;
  alertHighCpu: boolean;
  alertHighCpuThreshold: number;
  alertHighLatency: boolean;
  alertHighLatencyThreshold: number;
  alertIntervalMinutes: number;
}

interface TelegramUser {
  id: number;
  telegramChatId: string;
  telegramUsername: string | null;
  telegramFirstName: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function TelegramPage() {
  const [config, setConfig] = useState<TelegramConfig | null>(null);
  const [users, setUsers] = useState<TelegramUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string } | null>(null);

  const [botToken, setBotToken] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [alertDeviceOffline, setAlertDeviceOffline] = useState(true);
  const [alertHighCpu, setAlertHighCpu] = useState(true);
  const [alertHighCpuThreshold, setAlertHighCpuThreshold] = useState(80);
  const [alertHighLatency, setAlertHighLatency] = useState(true);
  const [alertHighLatencyThreshold, setAlertHighLatencyThreshold] = useState(150);
  const [alertIntervalMinutes, setAlertIntervalMinutes] = useState(5);

  const [newChatId, setNewChatId] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [addingUser, setAddingUser] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/telegram");
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setConfig(data.config);
          setBotToken(data.config.botToken);
          setEnabled(data.config.enabled);
          setAlertDeviceOffline(data.config.alertDeviceOffline);
          setAlertHighCpu(data.config.alertHighCpu);
          setAlertHighCpuThreshold(data.config.alertHighCpuThreshold);
          setAlertHighLatency(data.config.alertHighLatency);
          setAlertHighLatencyThreshold(data.config.alertHighLatencyThreshold);
          setAlertIntervalMinutes(data.config.alertIntervalMinutes);
        }
        setUsers(data.users || []);
      } else if (res.status === 403) {
        setMessage({ type: "error", text: "Solo administradores pueden gestionar Telegram" });
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session");
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchData();
    fetchSession();
  }, [fetchData, fetchSession]);

  const handleSaveConfig = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_config",
          botToken,
          enabled,
          alertDeviceOffline,
          alertHighCpu,
          alertHighCpuThreshold,
          alertHighLatency,
          alertHighLatencyThreshold,
          alertIntervalMinutes,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessage({ type: "success", text: `Configuración guardada${data.botUsername ? ` — Bot: @${data.botUsername}` : ""}` });
        await fetchData();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Error al guardar" });
      }
    } catch {
      setMessage({ type: "error", text: "Error de red" });
    } finally {
      setSaving(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatId) return;
    setAddingUser(true);
    setMessage(null);
    try {
      const res = await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_user",
          telegramChatId: newChatId,
          telegramUsername: newUsername || undefined,
          telegramFirstName: newFirstName || undefined,
        }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Usuario de Telegram agregado" });
        setNewChatId("");
        setNewUsername("");
        setNewFirstName("");
        setShowAddUser(false);
        await fetchData();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Error al agregar" });
      }
    } catch {
      setMessage({ type: "error", text: "Error de red" });
    } finally {
      setAddingUser(false);
    }
  };

  const handleRemoveUser = async (id: number) => {
    try {
      await fetch(`/api/telegram?id=${id}`, { method: "DELETE" });
      setMessage({ type: "success", text: "Usuario eliminado" });
      await fetchData();
    } catch {}
  };

  const handleToggleUser = async (userId: number, isActive: boolean) => {
    try {
      await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_user", userId, isActive }),
      });
      await fetchData();
    } catch {}
  };

  const handleTestBot = async () => {
    setMessage(null);
    try {
      const res = await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_bot" }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: `Bot conectado: @${data.bot.username}` });
      } else {
        setMessage({ type: "error", text: data.error || "Error de conexión" });
      }
    } catch {
      setMessage({ type: "error", text: "Error de red" });
    }
  };

  const handleSendTestMessage = async () => {
    setSendingTest(true);
    setMessage(null);
    try {
      const res = await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_test" }),
      });
      const data = await res.json();
      if (data.results) {
        const successCount = data.results.filter((r: { success: boolean }) => r.success).length;
        setMessage({ type: "success", text: `Mensaje enviado a ${successCount}/${data.results.length} usuarios` });
      } else {
        setMessage({ type: "error", text: data.error || "Error al enviar" });
      }
    } catch {
      setMessage({ type: "error", text: "Error de red" });
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0b0c0e" }}>
        <div style={{ color: "#8e8e8e" }}>Cargando configuración de Telegram...</div>
      </div>
    );
  }

  if (currentUser && currentUser.role !== "admin") {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#0b0c0e" }}>
        <TopNav />
        <main style={{ maxWidth: 700, margin: "0 auto", padding: "24px" }}>
          <div className="panel" style={{ textAlign: "center", padding: "48px 24px" }}>
            <p style={{ color: "#f2495c", fontSize: "14px" }}>Solo los administradores pueden acceder a esta sección.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0b0c0e" }}>
      <TopNav />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "24px" }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#e0e0e0" }}>Telegram</h1>
            <p style={{ fontSize: "12px", color: "#5a5f6a" }}>Configuración del bot y monitoreo desde Telegram</p>
          </div>
          {config && (
            <div className="flex items-center gap-2">
              <span className={`status-dot ${enabled ? "status-dot-online" : "status-dot-offline"}`} />
              <span style={{ fontSize: "12px", color: "#8e8e8e" }}>
                {enabled ? "Bot activo" : "Bot inactivo"}
              </span>
            </div>
          )}
        </div>

        {message && (
          <div className={message.type === "success" ? "toast-success" : "toast-error"} style={{ marginBottom: "16px" }}>
            {message.text}
          </div>
        )}

        <div className="panel mb-6">
          <div className="panel-header">
            <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#d8d9da" }}>Configuración del Bot</h3>
          </div>
          <div className="panel-body">
            <div className="mb-4">
              <label className="label-text">Token del Bot *</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                  className="input-field"
                  style={{ flex: 1 }}
                />
                <button onClick={handleTestBot} className="btn-secondary" style={{ whiteSpace: "nowrap" }}>
                  Probar Conexión
                </button>
              </div>
              <p style={{ fontSize: "11px", color: "#5a5f6a", marginTop: "4px" }}>
                Obtén el token de @BotFather en Telegram
              </p>
            </div>

            {config?.botUsername && (
              <div style={{ marginBottom: "16px", padding: "8px 12px", backgroundColor: "rgba(110,159,255,0.1)", borderRadius: 4, border: "1px solid rgba(110,159,255,0.2)" }}>
                <span style={{ fontSize: "12px", color: "#6e9fff" }}>Bot detectado: @{config.botUsername}</span>
              </div>
            )}

            <div className="mb-4">
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  style={{ accentColor: "#3b82f6" }}
                />
                <span style={{ fontSize: "13px", color: "#d8d9da" }}>Habilitar bot de Telegram</span>
              </label>
            </div>

            <div style={{ borderTop: "1px solid #2c3039", paddingTop: "16px", marginBottom: "16px" }}>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "#8e8e8e", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Alertas Automáticas
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input type="checkbox" checked={alertDeviceOffline} onChange={(e) => setAlertDeviceOffline(e.target.checked)} style={{ accentColor: "#3b82f6" }} />
                  <span style={{ fontSize: "12px", color: "#d8d9da" }}>Dispositivo fuera de línea</span>
                </label>

                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input type="checkbox" checked={alertHighCpu} onChange={(e) => setAlertHighCpu(e.target.checked)} style={{ accentColor: "#3b82f6" }} />
                    <span style={{ fontSize: "12px", color: "#d8d9da" }}>CPU alta (umbral:</span>
                    <input
                      type="number"
                      value={alertHighCpuThreshold}
                      onChange={(e) => setAlertHighCpuThreshold(parseInt(e.target.value) || 80)}
                      className="input-field"
                      style={{ width: 60, padding: "2px 6px", fontSize: "11px", textAlign: "center" }}
                      min={0}
                      max={100}
                    />
                    <span style={{ fontSize: "12px", color: "#d8d9da" }}>% )</span>
                  </label>
                </div>

                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                    <input type="checkbox" checked={alertHighLatency} onChange={(e) => setAlertHighLatency(e.target.checked)} style={{ accentColor: "#3b82f6" }} />
                    <span style={{ fontSize: "12px", color: "#d8d9da" }}>Latencia alta (umbral:</span>
                    <input
                      type="number"
                      value={alertHighLatencyThreshold}
                      onChange={(e) => setAlertHighLatencyThreshold(parseInt(e.target.value) || 150)}
                      className="input-field"
                      style={{ width: 60, padding: "2px 6px", fontSize: "11px", textAlign: "center" }}
                      min={0}
                    />
                    <span style={{ fontSize: "12px", color: "#d8d9da" }}>ms )</span>
                  </label>
                </div>

                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "12px", color: "#d8d9da" }}>Intervalo de chequeo:</span>
                    <input
                      type="number"
                      value={alertIntervalMinutes}
                      onChange={(e) => setAlertIntervalMinutes(parseInt(e.target.value) || 5)}
                      className="input-field"
                      style={{ width: 60, padding: "2px 6px", fontSize: "11px", textAlign: "center" }}
                      min={1}
                    />
                    <span style={{ fontSize: "12px", color: "#d8d9da" }}>min</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={handleSaveConfig} disabled={saving || !botToken} className="btn-primary">
                {saving ? "Guardando..." : "Guardar Configuración"}
              </button>
              {config && (
                <button onClick={handleSendTestMessage} disabled={sendingTest || users.length === 0} className="btn-success">
                  {sendingTest ? "Enviando..." : "Enviar Mensaje de Prueba"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="panel mb-6">
          <div className="panel-header">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#d8d9da" }}>Usuarios de Telegram</h3>
                <span style={{ fontSize: "11px", color: "#5a5f6a" }}>{users.length}</span>
              </div>
              <button onClick={() => setShowAddUser(!showAddUser)} className="btn-primary" style={{ padding: "4px 10px", fontSize: "11px" }}>
                {showAddUser ? "Cancelar" : "+ Agregar Usuario"}
              </button>
            </div>
          </div>
          <div className="panel-body">
            {showAddUser && (
              <form onSubmit={handleAddUser} style={{ marginBottom: "16px", paddingBottom: "16px", borderBottom: "1px solid #2c3039" }}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="label-text">Chat ID *</label>
                    <input
                      type="text"
                      required
                      value={newChatId}
                      onChange={(e) => setNewChatId(e.target.value)}
                      placeholder="Ej: 123456789"
                      className="input-field"
                    />
                    <p style={{ fontSize: "10px", color: "#5a5f6a", marginTop: "2px" }}>El usuario debe enviar /start al bot primero</p>
                  </div>
                  <div>
                    <label className="label-text">Username</label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="@usuario"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label-text">Nombre</label>
                    <input
                      type="text"
                      value={newFirstName}
                      onChange={(e) => setNewFirstName(e.target.value)}
                      placeholder="Nombre"
                      className="input-field"
                    />
                  </div>
                </div>
                <button type="submit" disabled={addingUser || !newChatId} className="btn-primary">
                  {addingUser ? "Agregando..." : "Agregar Usuario"}
                </button>
              </form>
            )}

            {users.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "#5a5f6a", fontSize: "13px" }}>
                No hay usuarios de Telegram registrados.
                <br />
                <span style={{ fontSize: "11px" }}>Agregue usuarios por su Chat ID para recibir alertas y usar comandos del bot.</span>
              </div>
            ) : (
              <table style={{ width: "100%", fontSize: "13px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #2c3039" }}>
                    {["Nombre", "Username", "Chat ID", "Estado", ""].map((h) => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#5a5f6a", fontWeight: 600, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} style={{ borderBottom: "1px solid #1e2028" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <td style={{ padding: "8px 12px", color: "#e0e0e0", fontWeight: 600 }}>
                        {u.telegramFirstName || "—"}
                      </td>
                      <td style={{ padding: "8px 12px", color: "#8e8e8e" }}>
                        {u.telegramUsername ? `@${u.telegramUsername}` : "—"}
                      </td>
                      <td style={{ padding: "8px 12px", color: "#5a5f6a", fontVariantNumeric: "tabular-nums", fontFamily: "monospace", fontSize: "12px" }}>
                        {u.telegramChatId}
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <button
                          onClick={() => handleToggleUser(u.id, !u.isActive)}
                          style={{
                            fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: 3, cursor: "pointer", border: "none",
                            backgroundColor: u.isActive ? "rgba(115,191,105,0.15)" : "rgba(242,73,92,0.15)",
                            color: u.isActive ? "#73bf69" : "#f2495c",
                          }}
                        >
                          {u.isActive ? "Activo" : "Inactivo"}
                        </button>
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <button onClick={() => handleRemoveUser(u.id)} className="btn-danger" style={{ padding: "3px 8px", fontSize: "10px" }}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#d8d9da" }}>Comandos del Bot</h3>
          </div>
          <div className="panel-body">
            <p style={{ fontSize: "12px", color: "#8e8e8e", marginBottom: "12px" }}>
              Los usuarios registrados pueden usar estos comandos en Telegram:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { cmd: "/start", desc: "Mensaje de bienvenida" },
                { cmd: "/help", desc: "Lista de comandos disponibles" },
                { cmd: "/status", desc: "Estado de todos los dispositivos" },
                { cmd: "/devices", desc: "Lista de dispositivos configurados" },
                { cmd: "/cpu", desc: "Carga de CPU de cada dispositivo" },
                { cmd: "/latency", desc: "Latencia y pérdida de paquetes" },
              ].map((c) => (
                <div key={c.cmd} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <code style={{ backgroundColor: "#181b1f", padding: "2px 8px", borderRadius: 3, fontSize: "12px", color: "#6e9fff", border: "1px solid #2c3039" }}>
                    {c.cmd}
                  </code>
                  <span style={{ fontSize: "12px", color: "#8e8e8e" }}>{c.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
