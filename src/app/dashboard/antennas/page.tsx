"use client";

import { useState, useEffect, useCallback } from "react";
import { TopNav } from "@/components/ui/TopNav";
import { MetricLineChart, MetricAreaChart } from "@/components/ui/Charts";

interface Reading {
  id: number;
  antennaId: number;
  signalStrength: number | null;
  signalNoise: number | null;
  ccq: number | null;
  txRate: string | null;
  rxRate: string | null;
  txBytes: number;
  rxBytes: number;
  registeredClients: number;
  notes: string | null;
  timestamp: string;
}

interface Antenna {
  id: number;
  name: string;
  ip: string | null;
  ssid: string | null;
  frequency: string | null;
  channelWidth: string | null;
  mode: string;
  deviceId: number | null;
  interfaceName: string | null;
  location: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  latestReading: Reading | null;
  readings: Reading[];
  reachable: boolean | null;
  pingRtt: number | null;
}

const SIGNAL_LABELS: Record<string, string> = {
  excellent: "Excelente",
  good: "Buena",
  fair: "Regular",
  poor: "Débil",
  bad: "Muy débil",
};

function getSignalQuality(dbm: number | null): { label: string; color: string; pct: number } {
  if (dbm == null) return { label: "Sin datos", color: "#5a5f6a", pct: 0 };
  if (dbm >= -50) return { label: SIGNAL_LABELS.excellent, color: "#73bf69", pct: 100 };
  if (dbm >= -60) return { label: SIGNAL_LABELS.good, color: "#6e9fff", pct: 80 };
  if (dbm >= -70) return { label: SIGNAL_LABELS.fair, color: "#ff9830", pct: 60 };
  if (dbm >= -80) return { label: SIGNAL_LABELS.poor, color: "#e0752d", pct: 35 };
  return { label: SIGNAL_LABELS.bad, color: "#f2495c", pct: 15 };
}

function formatTime(ts: string) {
  try {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  } catch {
    return ts;
  }
}

export default function AntennasPage() {
  const [antennas, setAntennas] = useState<Antenna[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showReadingForm, setShowReadingForm] = useState<number | null>(null);
  const [selectedAntenna, setSelectedAntenna] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [addForm, setAddForm] = useState({
    name: "", ip: "", ssid: "", frequency: "", channelWidth: "", mode: "other", location: "", notes: "",
  });

  const [readingForm, setReadingForm] = useState({
    signalStrength: "", signalNoise: "", ccq: "", txRate: "", rxRate: "",
    txBytes: "", rxBytes: "", registeredClients: "", notes: "",
  });

  const fetchAntennas = useCallback(async () => {
    try {
      const res = await fetch("/api/antennas");
      if (res.ok) {
        const data = await res.json();
        setAntennas(data);
        if (data.length > 0 && !selectedAntenna) setSelectedAntenna(data[0].id);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [selectedAntenna]);

  useEffect(() => {
    fetchAntennas();
    const interval = setInterval(fetchAntennas, 180000);
    return () => clearInterval(interval);
  }, [fetchAntennas]);

  const handleAddAntenna = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/antennas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Antena agregada correctamente" });
        setAddForm({ name: "", ip: "", ssid: "", frequency: "", channelWidth: "", mode: "other", location: "", notes: "" });
        setShowAddForm(false);
        await fetchAntennas();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Error al agregar antena" });
      }
    } catch {
      setMessage({ type: "error", text: "Error de red" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReadingForm) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = { antennaId: showReadingForm };
      if (readingForm.signalStrength) payload.signalStrength = parseFloat(readingForm.signalStrength);
      if (readingForm.signalNoise) payload.signalNoise = parseFloat(readingForm.signalNoise);
      if (readingForm.ccq) payload.ccq = parseFloat(readingForm.ccq);
      if (readingForm.txRate) payload.txRate = readingForm.txRate;
      if (readingForm.rxRate) payload.rxRate = readingForm.rxRate;
      if (readingForm.txBytes) payload.txBytes = parseInt(readingForm.txBytes, 10);
      if (readingForm.rxBytes) payload.rxBytes = parseInt(readingForm.rxBytes, 10);
      if (readingForm.registeredClients) payload.registeredClients = parseInt(readingForm.registeredClients, 10);
      if (readingForm.notes) payload.notes = readingForm.notes;

      const res = await fetch("/api/antennas/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Lectura registrada correctamente" });
        setReadingForm({ signalStrength: "", signalNoise: "", ccq: "", txRate: "", rxRate: "", txBytes: "", rxBytes: "", registeredClients: "", notes: "" });
        setShowReadingForm(null);
        await fetchAntennas();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Error al registrar lectura" });
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
      if (selectedAntenna === id) setSelectedAntenna(null);
      await fetchAntennas();
    } catch {}
  };

  const handleStatusToggle = async (antenna: Antenna) => {
    const newStatus = antenna.status === "up" ? "down" : "up";
    try {
      await fetch("/api/antennas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: antenna.id, status: newStatus }),
      });
      await fetchAntennas();
    } catch {}
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0b0c0e" }}>
        <div style={{ color: "#8e8e8e", fontSize: "14px" }}>Cargando antenas...</div>
      </div>
    );
  }

  const selectedData = antennas.find((a) => a.id === selectedAntenna);

  const signalChartData = selectedData?.readings?.slice().reverse().map((r) => ({
    timestamp: formatTime(r.timestamp),
    "Señal (dBm)": r.signalStrength ?? 0,
    "Ruido (dBm)": r.signalNoise ?? 0,
  })) || [];

  const ccqChartData = selectedData?.readings?.slice().reverse().map((r) => ({
    timestamp: formatTime(r.timestamp),
    "CCQ %": r.ccq ?? 0,
  })) || [];

  const snrChartData = selectedData?.readings?.slice().reverse().map((r) => ({
    timestamp: formatTime(r.timestamp),
    "SNR (dB)": r.signalStrength != null && r.signalNoise != null
      ? parseFloat((r.signalStrength - r.signalNoise).toFixed(1))
      : 0,
  })) || [];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0b0c0e" }}>
      <TopNav />

      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "24px" }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#e0e0e0" }}>
              Monitoreo de Antenas
            </h1>
            <p style={{ fontSize: "12px", color: "#5a5f6a", marginTop: "2px" }}>
              Registro manual y análisis de señal inalámbrica
            </p>
          </div>
          <button
            onClick={() => { setShowAddForm(!showAddForm); setShowReadingForm(null); }}
            className="btn-primary"
          >
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
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#e0e0e0" }}>
                Agregar Nueva Antena
              </h3>
            </div>
            <div className="panel-body">
              <form onSubmit={handleAddAntenna}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="label-text">Nombre *</label>
                    <input type="text" required value={addForm.name} onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ej. Sector Norte" className="input-field" />
                  </div>
                  <div>
                    <label className="label-text">IP de la Antena</label>
                    <input type="text" value={addForm.ip} onChange={(e) => setAddForm((p) => ({ ...p, ip: e.target.value }))} placeholder="Ej. 192.168.1.10" className="input-field" />
                    <p style={{ fontSize: "10px", color: "#5a5f6a", marginTop: "2px" }}>Se hará ping para verificar estado (arriba/abajo)</p>
                  </div>
                  <div>
                    <label className="label-text">SSID</label>
                    <input type="text" value={addForm.ssid} onChange={(e) => setAddForm((p) => ({ ...p, ssid: e.target.value }))} placeholder="Ej. WISP-AP-01" className="input-field" />
                  </div>
                  <div>
                    <label className="label-text">Frecuencia</label>
                    <input type="text" value={addForm.frequency} onChange={(e) => setAddForm((p) => ({ ...p, frequency: e.target.value }))} placeholder="Ej. 5180 MHz" className="input-field" />
                  </div>
                  <div>
                    <label className="label-text">Ancho de Canal</label>
                    <input type="text" value={addForm.channelWidth} onChange={(e) => setAddForm((p) => ({ ...p, channelWidth: e.target.value }))} placeholder="Ej. 20 MHz" className="input-field" />
                  </div>
                  <div>
                    <label className="label-text">Modo</label>
                    <select value={addForm.mode} onChange={(e) => setAddForm((p) => ({ ...p, mode: e.target.value }))} className="select-field">
                      <option value="ap-bridge">AP Bridge</option>
                      <option value="station">Station</option>
                      <option value="bridge">Bridge</option>
                      <option value="wds-slave">WDS Slave</option>
                      <option value="other">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-text">Ubicación</label>
                    <input type="text" value={addForm.location} onChange={(e) => setAddForm((p) => ({ ...p, location: e.target.value }))} placeholder="Ej. Torre A - Techo" className="input-field" />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="label-text">Notas</label>
                    <textarea value={addForm.notes} onChange={(e) => setAddForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Detalles adicionales..." rows={2} className="input-field" style={{ resize: "none" }} />
                  </div>
                </div>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? "Agregando..." : "Agregar Antena"}
                </button>
              </form>
            </div>
          </div>
        )}

        {showReadingForm && (
          <div className="panel mb-6">
            <div className="panel-header">
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#e0e0e0" }}>
                Registrar Lectura — {antennas.find((a) => a.id === showReadingForm)?.name}
              </h3>
            </div>
            <div className="panel-body">
              <form onSubmit={handleAddReading}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="label-text">Intensidad de Señal (dBm)</label>
                    <input type="number" step="0.1" value={readingForm.signalStrength} onChange={(e) => setReadingForm((p) => ({ ...p, signalStrength: e.target.value }))} placeholder="Ej. -65" className="input-field" />
                  </div>
                  <div>
                    <label className="label-text">Nivel de Ruido (dBm)</label>
                    <input type="number" step="0.1" value={readingForm.signalNoise} onChange={(e) => setReadingForm((p) => ({ ...p, signalNoise: e.target.value }))} placeholder="Ej. -95" className="input-field" />
                  </div>
                  <div>
                    <label className="label-text">CCQ (%)</label>
                    <input type="number" step="0.1" min="0" max="100" value={readingForm.ccq} onChange={(e) => setReadingForm((p) => ({ ...p, ccq: e.target.value }))} placeholder="Ej. 95" className="input-field" />
                  </div>
                  <div>
                    <label className="label-text">Velocidad Tx</label>
                    <input type="text" value={readingForm.txRate} onChange={(e) => setReadingForm((p) => ({ ...p, txRate: e.target.value }))} placeholder="Ej. 130 Mbps" className="input-field" />
                  </div>
                  <div>
                    <label className="label-text">Velocidad Rx</label>
                    <input type="text" value={readingForm.rxRate} onChange={(e) => setReadingForm((p) => ({ ...p, rxRate: e.target.value }))} placeholder="Ej. 130 Mbps" className="input-field" />
                  </div>
                  <div>
                    <label className="label-text">Clientes Registrados</label>
                    <input type="number" min="0" value={readingForm.registeredClients} onChange={(e) => setReadingForm((p) => ({ ...p, registeredClients: e.target.value }))} placeholder="Ej. 12" className="input-field" />
                  </div>
                  <div>
                    <label className="label-text">Bytes Tx</label>
                    <input type="number" min="0" value={readingForm.txBytes} onChange={(e) => setReadingForm((p) => ({ ...p, txBytes: e.target.value }))} placeholder="Total bytes tx" className="input-field" />
                  </div>
                  <div>
                    <label className="label-text">Bytes Rx</label>
                    <input type="number" min="0" value={readingForm.rxBytes} onChange={(e) => setReadingForm((p) => ({ ...p, rxBytes: e.target.value }))} placeholder="Total bytes rx" className="input-field" />
                  </div>
                  <div className="lg:col-span-3">
                    <label className="label-text">Notas</label>
                    <textarea value={readingForm.notes} onChange={(e) => setReadingForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Observaciones de esta lectura..." rows={2} className="input-field" style={{ resize: "none" }} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={submitting} className="btn-success">
                    {submitting ? "Guardando..." : "Guardar Lectura"}
                  </button>
                  <button type="button" onClick={() => setShowReadingForm(null)} className="btn-secondary">
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {antennas.length === 0 ? (
          <div className="panel" style={{ textAlign: "center", padding: "48px 24px" }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#5a5f6a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px" }}>
              <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
              <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
              <line x1="12" y1="20" x2="12.01" y2="20"/>
            </svg>
            <p style={{ color: "#8e8e8e", fontSize: "14px", marginBottom: "4px" }}>
              No hay antenas configuradas
            </p>
            <p style={{ color: "#5a5f6a", fontSize: "12px" }}>
              Agregue su primera antena para comenzar el monitoreo de señal.
            </p>
            <button onClick={() => setShowAddForm(true)} className="btn-primary" style={{ marginTop: "16px" }}>
              Agregar Antena
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
              {antennas.map((ant) => {
                const sq = getSignalQuality(ant.latestReading?.signalStrength ?? null);
                const snr = ant.latestReading?.signalStrength != null && ant.latestReading?.signalNoise != null
                  ? (ant.latestReading.signalStrength - ant.latestReading.signalNoise).toFixed(1)
                  : null;

                return (
                  <div
                    key={ant.id}
                    onClick={() => setSelectedAntenna(ant.id)}
                    className="panel"
                    style={{
                      cursor: "pointer",
                      outline: selectedAntenna === ant.id ? "2px solid #3b82f6" : "2px solid transparent",
                      outlineOffset: "-1px",
                      transition: "outline 0.15s ease",
                    }}
                  >
                    <div className="panel-header">
                      <div className="flex items-center gap-2">
                        <span
                          className={`status-dot ${
                            ant.ip
                              ? (ant.reachable ? "status-dot-online" : "status-dot-offline")
                              : (ant.status === "up" ? "status-dot-online" : ant.status === "down" ? "status-dot-offline" : "status-dot-unknown")
                          }`}
                        />
                        <div>
                          <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#e0e0e0" }}>
                            {ant.name}
                          </h3>
                          <div className="flex gap-2 mt-0.5">
                            {ant.ip && (
                              <span style={{ fontSize: "10px", color: ant.reachable ? "#73bf69" : "#f2495c", fontWeight: 600 }}>
                                {ant.ip}{ant.reachable && ant.pingRtt ? ` — ${ant.pingRtt}ms` : ant.reachable === false ? " — Sin respuesta" : ""}
                              </span>
                            )}
                            {ant.ssid && <span style={{ fontSize: "10px", color: "#5a5f6a" }}>{ant.ssid}</span>}
                            {ant.frequency && <span style={{ fontSize: "10px", color: "#8e8e8e" }}>{ant.frequency}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowReadingForm(ant.id); setShowAddForm(false); }}
                          className="btn-success"
                          style={{ padding: "3px 8px", fontSize: "10px" }}
                        >
                          + Lectura
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStatusToggle(ant); }}
                          className={ant.status === "up" ? "btn-danger" : "btn-success"}
                          style={{ padding: "3px 8px", fontSize: "10px" }}
                        >
                          {ant.status === "up" ? "Bajar" : "Subir"}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(ant.id); }}
                          className="btn-danger"
                          style={{ padding: "3px 8px", fontSize: "10px" }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>

                    <div className="panel-body">
                      <div className="grid grid-cols-4 gap-1">
                        <div className="text-center">
                          <p style={{ fontSize: "9px", color: "#5a5f6a", textTransform: "uppercase", letterSpacing: "0.06em" }}>Señal</p>
                          <p style={{ fontSize: "14px", fontWeight: 700, color: sq.color, fontVariantNumeric: "tabular-nums" }}>
                            {ant.latestReading?.signalStrength != null ? `${ant.latestReading.signalStrength}` : "—"}
                          </p>
                          <p style={{ fontSize: "9px", color: sq.color }}>{sq.label}</p>
                        </div>
                        <div className="text-center">
                          <p style={{ fontSize: "9px", color: "#5a5f6a", textTransform: "uppercase", letterSpacing: "0.06em" }}>Ruido</p>
                          <p style={{ fontSize: "14px", fontWeight: 700, color: "#8e8e8e", fontVariantNumeric: "tabular-nums" }}>
                            {ant.latestReading?.signalNoise != null ? `${ant.latestReading.signalNoise}` : "—"}
                          </p>
                        </div>
                        <div className="text-center">
                          <p style={{ fontSize: "9px", color: "#5a5f6a", textTransform: "uppercase", letterSpacing: "0.06em" }}>SNR</p>
                          <p style={{ fontSize: "14px", fontWeight: 700, color: "#1f78c4", fontVariantNumeric: "tabular-nums" }}>
                            {snr ? snr : "—"}
                          </p>
                        </div>
                        <div className="text-center">
                          <p style={{ fontSize: "9px", color: "#5a5f6a", textTransform: "uppercase", letterSpacing: "0.06em" }}>CCQ</p>
                          <p style={{ fontSize: "14px", fontWeight: 700, color: "#b877d9", fontVariantNumeric: "tabular-nums" }}>
                            {ant.latestReading?.ccq != null ? `${ant.latestReading.ccq}` : "—"}
                          </p>
                        </div>
                      </div>

                      {ant.latestReading && (
                        <div className="flex gap-3 mt-2 pt-2" style={{ borderTop: "1px solid #1e2028" }}>
                          {ant.latestReading.txRate && <span style={{ fontSize: "10px", color: "#5a5f6a" }}>Tx: {ant.latestReading.txRate}</span>}
                          {ant.latestReading.rxRate && <span style={{ fontSize: "10px", color: "#5a5f6a" }}>Rx: {ant.latestReading.rxRate}</span>}
                          {ant.latestReading.registeredClients > 0 && (
                            <span style={{ fontSize: "10px", color: "#5a5f6a" }}>Clientes: {ant.latestReading.registeredClients}</span>
                          )}
                          {ant.location && <span style={{ fontSize: "10px", color: "#5a5f6a" }}>{ant.location}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedData && selectedData.readings.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#e0e0e0" }}>
                    {selectedData.name}
                  </h2>
                  <span style={{ color: "#5a5f6a", fontSize: "13px" }}>
                    — Historial de Señal
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                  {signalChartData.length > 0 && (
                    <MetricLineChart
                      data={signalChartData}
                      dataKeys={[
                        { key: "Señal (dBm)", color: "#3b82f6", name: "Señal" },
                        { key: "Ruido (dBm)", color: "#f2495c", name: "Ruido" },
                      ]}
                      title="Señal y Ruido (dBm)"
                    />
                  )}
                  {snrChartData.length > 0 && (
                    <MetricAreaChart
                      data={snrChartData}
                      dataKeys={[{ key: "SNR (dB)", color: "#1f78c4", name: "SNR" }]}
                      title="Relación Señal-Ruido (dB)"
                    />
                  )}
                </div>

                {ccqChartData.length > 0 && (
                  <div className="mb-4">
                    <MetricAreaChart
                      data={ccqChartData}
                      dataKeys={[{ key: "CCQ %", color: "#b877d9", name: "CCQ" }]}
                      title="Calidad de Conexión (CCQ %)"
                    />
                  </div>
                )}

                <div className="panel">
                  <div className="panel-header">
                    <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#d8d9da" }}>
                      Historial de Lecturas
                    </h3>
                  </div>
                  <div className="panel-body" style={{ padding: 0 }}>
                    <div className="overflow-x-auto">
                      <table style={{ width: "100%", fontSize: "12px" }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid #2c3039" }}>
                            {["Fecha/Hora", "Señal", "Ruido", "SNR", "CCQ", "Tx", "Rx", "Notas"].map((h) => (
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
                          {selectedData.readings.slice(0, 20).map((r) => {
                            const snrVal = r.signalStrength != null && r.signalNoise != null
                              ? (r.signalStrength - r.signalNoise).toFixed(1) : null;
                            const sq = getSignalQuality(r.signalStrength);
                            return (
                              <tr
                                key={r.id}
                                style={{ borderBottom: "1px solid #1e2028", transition: "background-color 0.1s" }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)")}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                              >
                                <td style={{ padding: "8px 16px", color: "#8e8e8e", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                                  {new Date(r.timestamp).toLocaleString("es-ES")}
                                </td>
                                <td style={{ padding: "8px 16px", color: sq.color, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                                  {r.signalStrength != null ? `${r.signalStrength} dBm` : "—"}
                                </td>
                                <td style={{ padding: "8px 16px", color: "#8e8e8e", fontVariantNumeric: "tabular-nums" }}>
                                  {r.signalNoise != null ? `${r.signalNoise} dBm` : "—"}
                                </td>
                                <td style={{ padding: "8px 16px", color: "#1f78c4", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                                  {snrVal ? `${snrVal} dB` : "—"}
                                </td>
                                <td style={{ padding: "8px 16px", color: "#b877d9", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                                  {r.ccq != null ? `${r.ccq}%` : "—"}
                                </td>
                                <td style={{ padding: "8px 16px", color: "#8e8e8e" }}>
                                  {r.txRate || "—"}
                                </td>
                                <td style={{ padding: "8px 16px", color: "#8e8e8e" }}>
                                  {r.rxRate || "—"}
                                </td>
                                <td style={{ padding: "8px 16px", color: "#5a5f6a", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {r.notes || "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
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
