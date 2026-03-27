"use client";

import { useState, useEffect, useCallback } from "react";
import { TopNav } from "@/components/ui/TopNav";

interface Lease {
  id: string;
  address: string;
  macAddress: string;
  hostName: string;
  status: string;
  server: string;
  expiresAfter: string;
}

interface Queue {
  id: string;
  name: string;
  target: string;
  maxLimit: string;
  disabled: string;
}

interface ArpEntry {
  id: string;
  address: string;
  macAddress: string;
  interface: string;
  disabled: string;
}

interface Device {
  id: number;
  name: string;
  host: string;
  port: number;
  status: string;
}

type Step = "idle" | "select_lease" | "set_static" | "add_arp" | "set_speed" | "done";

const SPEED_PRESETS = [
  { label: "1/2 Mbps", upload: "1M", download: "2M" },
  { label: "2/5 Mbps", upload: "2M", download: "5M" },
  { label: "3/10 Mbps", upload: "3M", download: "10M" },
  { label: "5/10 Mbps", upload: "5M", download: "10M" },
  { label: "5/20 Mbps", upload: "5M", download: "20M" },
  { label: "10/20 Mbps", upload: "10M", download: "20M" },
  { label: "10/50 Mbps", upload: "10M", download: "50M" },
  { label: "20/50 Mbps", upload: "20M", download: "50M" },
  { label: "20/100 Mbps", upload: "20M", download: "100M" },
  { label: "50/100 Mbps", upload: "50M", download: "100M" },
];

function formatLimit(val: string): string {
  const num = parseFloat(val);
  if (val.toUpperCase().includes("G")) return `${num} Gbps`;
  if (val.toUpperCase().includes("M")) return `${num} Mbps`;
  if (val.toUpperCase().includes("K")) return `${(num / 1000).toFixed(1)} Mbps`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(0)} Mbps`;
  return `${num} bps`;
}

export default function ProvisioningPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [allLeases, setAllLeases] = useState<Lease[]>([]);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [arpEntries, setArpEntries] = useState<ArpEntry[]>([]);
  const [interfaces, setInterfaces] = useState<string[]>([]);
  const [step, setStep] = useState<Step>("idle");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [selectedLease, setSelectedLease] = useState<Lease | null>(null);
  const [clientName, setClientName] = useState("");
  const [selectedInterface, setSelectedInterface] = useState("SALIDA");
  const [uploadLimit, setUploadLimit] = useState("5M");
  const [downloadLimit, setDownloadLimit] = useState("10M");
  const [customUpload, setCustomUpload] = useState("");
  const [customDownload, setCustomDownload] = useState("");

  const [editingQueue, setEditingQueue] = useState<Queue | null>(null);
  const [editUpload, setEditUpload] = useState("");
  const [editDownload, setEditDownload] = useState("");

  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch("/api/devices");
      if (res.ok) {
        const data = await res.json();
        setDevices(data);
        if (data.length > 0 && !selectedDevice) {
          const online = data.find((d: Device) => d.status === "online");
          if (online) setSelectedDevice(online.id);
        }
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [selectedDevice]);

  const loadLeases = async () => {
    if (!selectedDevice) return;
    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch("/api/provisioning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_leases", deviceId: selectedDevice }),
      });
      if (res.ok) {
        const data = await res.json();
        setLeases(data.leases);
      }
    } catch {
    } finally {
      setWorking(false);
    }
  };

  const loadQueues = async () => {
    if (!selectedDevice) return;
    try {
      const res = await fetch("/api/provisioning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_queues", deviceId: selectedDevice }),
      });
      if (res.ok) {
        const data = await res.json();
        setQueues(data.queues);
        setArpEntries(data.arpEntries || []);
        setAllLeases(data.leases || []);
      }
    } catch {}
  };

  const loadInterfaces = async () => {
    if (!selectedDevice) return;
    try {
      const res = await fetch("/api/provisioning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_interfaces", deviceId: selectedDevice }),
      });
      if (res.ok) {
        const data = await res.json();
        setInterfaces(data.interfaces || []);
        if (data.interfaces?.length > 0 && !data.interfaces.includes(selectedInterface)) {
          setSelectedInterface(data.interfaces[0]);
        }
      }
    } catch {}
  };

  const handleCortar = async (arpId: string, name: string) => {
    if (!selectedDevice) return;
    setWorking(true);
    try {
      await fetch("/api/provisioning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_arp", deviceId: selectedDevice, arpId, enable: false }),
      });
      setMessage({ type: "success", text: `${name} cortado` });
      loadQueues();
    } catch { setMessage({ type: "error", text: "Error" }); }
    finally { setWorking(false); }
  };

  const handleHabilitar = async (arpId: string, name: string) => {
    if (!selectedDevice) return;
    setWorking(true);
    try {
      await fetch("/api/provisioning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_arp", deviceId: selectedDevice, arpId, enable: true }),
      });
      setMessage({ type: "success", text: `${name} habilitado` });
      loadQueues();
    } catch { setMessage({ type: "error", text: "Error" }); }
    finally { setWorking(false); }
  };

  const handleDeleteClient = async (queue: Queue) => {
    if (!selectedDevice) return;
    const ip = queue.target.replace("/32", "");
    const matchingArp = arpEntries.find((arp) => arp.address === ip);
    const matchingLease = allLeases.find((l) => l.address === ip);

    if (!confirm(`¿Eliminar a "${queue.name}" (${ip}) del sistema?\n\nSe eliminarán:\n• ARP\n• Cola\n• Lease DHCP`)) return;

    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch("/api/provisioning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_client",
          deviceId: selectedDevice,
          arpId: matchingArp?.id,
          queueId: queue.id,
          leaseId: matchingLease?.id,
          clientName: queue.name,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setMessage({ type: "success", text: `${queue.name} eliminado completamente` });
        } else {
          setMessage({ type: "error", text: `Eliminación parcial: ${JSON.stringify(data.results)}` });
        }
        loadLeases();
        loadQueues();
      }
    } catch { setMessage({ type: "error", text: "Error al eliminar" }); }
    finally { setWorking(false); }
  };

  const handleUpdateSpeed = async () => {
    if (!selectedDevice || !editingQueue) return;
    const up = customUpload || editUpload;
    const down = customDownload || editDownload;
    if (!up || !down) return;
    setWorking(true);
    try {
      const res = await fetch("/api/provisioning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_queue",
          deviceId: selectedDevice,
          queueId: editingQueue.id,
          uploadLimit: up,
          downloadLimit: down,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setMessage({ type: "success", text: `Velocidad de ${editingQueue.name} actualizada` });
          setEditingQueue(null);
          setCustomUpload("");
          setCustomDownload("");
          loadQueues();
        }
      }
    } catch { setMessage({ type: "error", text: "Error" }); }
    finally { setWorking(false); }
  };

  const handleMakeStatic = async () => {
    if (!selectedDevice || !selectedLease) return;
    setWorking(true);
    try {
      const res = await fetch("/api/provisioning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "make_static", deviceId: selectedDevice, leaseId: selectedLease.id, clientName }),
      });
      if (res.ok && (await res.json()).success) {
        setMessage({ type: "success", text: `${selectedLease.address} → estático` });
        setStep("add_arp");
      }
    } catch {} finally { setWorking(false); }
  };

  const handleAddArp = async () => {
    if (!selectedDevice || !selectedLease) return;
    setWorking(true);
    try {
      const res = await fetch("/api/provisioning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_arp", deviceId: selectedDevice,
          macAddress: selectedLease.macAddress, ipAddress: selectedLease.address,
          interfaceName: selectedInterface,
        }),
      });
      if (res.ok && (await res.json()).success) {
        setMessage({ type: "success", text: `ARP: ${selectedLease.address} → ${selectedInterface}` });
        setStep("set_speed");
      }
    } catch {} finally { setWorking(false); }
  };

  const handleAddQueue = async () => {
    if (!selectedDevice || !selectedLease) return;
    const up = customUpload || uploadLimit;
    const down = customDownload || downloadLimit;
    setWorking(true);
    try {
      const res = await fetch("/api/provisioning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_queue", deviceId: selectedDevice,
          queueName: clientName, targetIp: selectedLease.address,
          uploadLimit: up, downloadLimit: down,
        }),
      });
      if (res.ok && (await res.json()).success) {
        setMessage({ type: "success", text: `${clientName}: ${formatLimit(up)}↑ / ${formatLimit(down)}↓` });
        setStep("done");
        loadQueues();
      }
    } catch {} finally { setWorking(false); }
  };

  const resetFlow = () => {
    setStep("idle");
    setSelectedLease(null);
    setClientName("");
    setCustomUpload("");
    setCustomDownload("");
    setMessage(null);
    loadLeases();
  };

  useEffect(() => { fetchDevices(); }, [fetchDevices]);
  useEffect(() => {
    if (selectedDevice) { loadLeases(); loadQueues(); loadInterfaces(); }
  }, [selectedDevice]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0b0c0e" }}>
        <div style={{ color: "#8e8e8e" }}>Cargando...</div>
      </div>
    );
  }

  const stepLabels = [
    { key: "select_lease", num: 1, label: "Lease DHCP" },
    { key: "set_static", num: 2, label: "Fijar IP" },
    { key: "add_arp", num: 3, label: "ARP" },
    { key: "set_speed", num: 4, label: "Velocidad" },
  ];
  const stepIndex = stepLabels.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0b0c0e" }}>
      <TopNav />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#e0e0e0" }}>Aprovisionamiento</h1>
            <p style={{ fontSize: "12px", color: "#5a5f6a" }}>DHCP → Estático → ARP → Velocidad</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={selectedDevice || ""} onChange={(e) => setSelectedDevice(parseInt(e.target.value, 10) || null)} className="select-field" style={{ width: 200 }}>
              <option value="">Seleccionar dispositivo</option>
              {devices.map((d) => <option key={d.id} value={d.id}>{d.name} {d.status === "online" ? "●" : "○"}</option>)}
            </select>
            <button onClick={loadLeases} disabled={working || !selectedDevice} className="btn-primary">Actualizar</button>
          </div>
        </div>

        {message && (
          <div className={message.type === "success" ? "toast-success" : "toast-error"} style={{ marginBottom: "16px" }}>{message.text}</div>
        )}

        {step !== "idle" && step !== "done" && (
          <div className="panel mb-6">
            <div className="panel-body">
              <div className="flex items-center gap-3">
                {stepLabels.map((s, i) => (
                  <div key={s.key} className="flex items-center gap-2">
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "12px", fontWeight: 700, backgroundColor: i <= stepIndex ? "#3b82f6" : "#2c3039",
                      color: i <= stepIndex ? "#fff" : "#5a5f6a",
                    }}>{s.num}</div>
                    <span style={{ fontSize: "12px", color: i <= stepIndex ? "#d8d9da" : "#5a5f6a", fontWeight: i === stepIndex ? 600 : 400 }}>{s.label}</span>
                    {i < stepLabels.length - 1 && <span style={{ color: "#2c3039", margin: "0 4px" }}>→</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === "set_static" && selectedLease && (
          <div className="panel mb-6">
            <div className="panel-header"><h3 style={{ fontSize: "14px", fontWeight: 600, color: "#e0e0e0" }}>Paso 2: Fijar IP Estática</h3></div>
            <div className="panel-body">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div><p className="label-text">IP</p><p style={{ color: "#d8d9da", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{selectedLease.address}</p></div>
                <div><p className="label-text">MAC</p><p style={{ color: "#8e8e8e", fontVariantNumeric: "tabular-nums" }}>{selectedLease.macAddress}</p></div>
                <div>
                  <label className="label-text">Nombre del Cliente *</label>
                  <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Ej. Juan Pérez" className="input-field" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleMakeStatic} disabled={working || !clientName} className="btn-primary">{working ? "..." : "Convertir a Estático"}</button>
                <button onClick={resetFlow} className="btn-secondary">Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {step === "add_arp" && selectedLease && (
          <div className="panel mb-6">
            <div className="panel-header"><h3 style={{ fontSize: "14px", fontWeight: 600, color: "#e0e0e0" }}>Paso 3: Vinculación ARP</h3></div>
            <div className="panel-body">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div><p className="label-text">IP</p><p style={{ color: "#d8d9da", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{selectedLease.address}</p></div>
                <div><p className="label-text">MAC</p><p style={{ color: "#8e8e8e", fontVariantNumeric: "tabular-nums" }}>{selectedLease.macAddress}</p></div>
                <div>
                  <label className="label-text">Interfaz</label>
                  {interfaces.length > 0 ? (
                    <select value={selectedInterface} onChange={(e) => setSelectedInterface(e.target.value)} className="select-field">
                      {interfaces.map((iface) => <option key={iface} value={iface}>{iface}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={selectedInterface} onChange={(e) => setSelectedInterface(e.target.value)} placeholder="SALIDA" className="input-field" />
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddArp} disabled={working} className="btn-primary">{working ? "..." : "Agregar ARP"}</button>
                <button onClick={() => setStep("set_speed")} className="btn-secondary">Omitir</button>
              </div>
            </div>
          </div>
        )}

        {step === "set_speed" && selectedLease && (
          <div className="panel mb-6">
            <div className="panel-header"><h3 style={{ fontSize: "14px", fontWeight: 600, color: "#e0e0e0" }}>Paso 4: Asignar Velocidad</h3></div>
            <div className="panel-body">
              <p className="label-text" style={{ marginBottom: "8px" }}>Planes predefinidos</p>
              <div className="flex flex-wrap gap-2 mb-4">
                {SPEED_PRESETS.map((p) => {
                  const isActive = uploadLimit === p.upload && downloadLimit === p.download && !customUpload && !customDownload;
                  return (
                    <button key={p.label} onClick={() => { setUploadLimit(p.upload); setDownloadLimit(p.download); setCustomUpload(""); setCustomDownload(""); }}
                      className={isActive ? "btn-primary" : "btn-secondary"} style={{ padding: "5px 12px", fontSize: "11px" }}>
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="label-text">Subida personalizada</label>
                  <input type="text" value={customUpload} onChange={(e) => setCustomUpload(e.target.value)} placeholder="Ej: 5M" className="input-field" />
                </div>
                <div>
                  <label className="label-text">Bajada personalizada</label>
                  <input type="text" value={customDownload} onChange={(e) => setCustomDownload(e.target.value)} placeholder="Ej: 20M" className="input-field" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddQueue} disabled={working} className="btn-success">
                  {working ? "..." : `Crear: ${formatLimit(customUpload || uploadLimit)}↑ / ${formatLimit(customDownload || downloadLimit)}↓`}
                </button>
                <button onClick={resetFlow} className="btn-secondary">Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="panel mb-6">
            <div className="panel-body text-center" style={{ padding: "32px" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#73bf69" strokeWidth="2" style={{ margin: "0 auto 12px" }}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <p style={{ fontSize: "16px", fontWeight: 600, color: "#73bf69", marginBottom: "4px" }}>Aprovisionamiento Completado</p>
              <button onClick={resetFlow} className="btn-primary" style={{ marginTop: "12px" }}>Aprovisionar Otro Cliente</button>
            </div>
          </div>
        )}

        {step === "idle" && (
          <div className="panel">
            <div className="panel-header">
              <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#d8d9da" }}>Leases DHCP Activos</h3>
              <span style={{ fontSize: "11px", color: "#5a5f6a" }}>{leases.length} dinámicos</span>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              {leases.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px" }}>
                  <p style={{ fontSize: "12px", color: "#5a5f6a" }}>{selectedDevice ? "Sin leases dinámicos" : "Seleccione un dispositivo"}</p>
                </div>
              ) : (
                <table style={{ width: "100%", fontSize: "12px" }}>
                  <thead><tr style={{ borderBottom: "1px solid #2c3039" }}>
                    {["IP", "MAC", "Host", "Estado", "Acción"].map((h) => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#5a5f6a", fontWeight: 600, fontSize: "11px", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {leases.map((l) => (
                      <tr key={l.id} style={{ borderBottom: "1px solid #1e2028" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                        <td style={{ padding: "8px 16px", color: "#d8d9da", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{l.address}</td>
                        <td style={{ padding: "8px 16px", color: "#8e8e8e", fontVariantNumeric: "tabular-nums" }}>{l.macAddress}</td>
                        <td style={{ padding: "8px 16px", color: "#8e8e8e" }}>{l.hostName || "—"}</td>
                        <td style={{ padding: "8px 16px" }}>
                          <span style={{ fontSize: "10px", fontWeight: 600, padding: "2px 6px", borderRadius: 3, backgroundColor: "rgba(115,191,105,0.15)", color: "#73bf69" }}>{l.status}</span>
                        </td>
                        <td style={{ padding: "8px 16px" }}>
                          <button onClick={() => { setSelectedLease(l); setClientName(l.hostName || ""); setStep("set_static"); setMessage(null); }} className="btn-primary" style={{ padding: "3px 10px", fontSize: "10px" }}>Aprovisionar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {queues.length > 0 && step === "idle" && (
          <div className="panel mt-4">
            <div className="panel-header">
              <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#d8d9da" }}>Clientes Aprovisionados</h3>
              <span style={{ fontSize: "11px", color: "#5a5f6a" }}>{queues.length}</span>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              <table style={{ width: "100%", fontSize: "12px" }}>
                <thead><tr style={{ borderBottom: "1px solid #2c3039" }}>
                  {["Nombre", "IP", "Subida", "Bajada", "ARP", "Acción"].map((h) => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#5a5f6a", fontWeight: 600, fontSize: "11px", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {queues.map((q) => {
                    const parts = q.maxLimit.split("/");
                    const ip = q.target.replace("/32", "");
                    const matchingArp = arpEntries.find((arp) => arp.address === ip);
                    const isCut = matchingArp?.disabled === "true";
                    const isEditing = editingQueue?.id === q.id;

                    return (
                      <tr key={q.id} style={{ borderBottom: "1px solid #1e2028" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                        <td style={{ padding: "8px 16px", color: "#d8d9da", fontWeight: 500 }}>{q.name}</td>
                        <td style={{ padding: "8px 16px", color: "#8e8e8e", fontVariantNumeric: "tabular-nums" }}>{ip}</td>
                        <td style={{ padding: "8px 16px", color: "#ff9830", fontWeight: 600 }}>{formatLimit(parts[0] || "0")}</td>
                        <td style={{ padding: "8px 16px", color: "#b877d9", fontWeight: 600 }}>{formatLimit(parts[1] || "0")}</td>
                        <td style={{ padding: "8px 16px" }}>
                          {matchingArp && (
                            <span className={`status-dot ${isCut ? "status-dot-offline" : "status-dot-online"}`} />
                          )}
                          <span style={{ marginLeft: 6, fontSize: "11px", color: isCut ? "#f2495c" : matchingArp ? "#73bf69" : "#5a5f6a" }}>
                            {isCut ? "Cortado" : matchingArp ? "Activo" : "—"}
                          </span>
                        </td>
                        <td style={{ padding: "8px 16px" }}>
                          <div className="flex gap-1">
                            {matchingArp && (
                              isCut
                                ? <button onClick={() => handleHabilitar(matchingArp.id, q.name)} disabled={working} className="btn-success" style={{ padding: "3px 8px", fontSize: "10px" }}>Habilitar</button>
                                : <button onClick={() => handleCortar(matchingArp.id, q.name)} disabled={working} className="btn-danger" style={{ padding: "3px 8px", fontSize: "10px" }}>Cortar</button>
                            )}
                            <button onClick={() => {
                              setEditingQueue(isEditing ? null : q);
                              setEditUpload(parts[0] || "");
                              setEditDownload(parts[1] || "");
                              setCustomUpload("");
                              setCustomDownload("");
                            }} className="btn-secondary" style={{ padding: "3px 8px", fontSize: "10px" }}>
                              {isEditing ? "Cerrar" : "Modificar"}
                            </button>
                            <button onClick={() => handleDeleteClient(q)} disabled={working} className="btn-danger" style={{ padding: "3px 8px", fontSize: "10px" }}>
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {editingQueue && (
                <div style={{ padding: "16px", borderTop: "1px solid #2c3039", backgroundColor: "#141619" }}>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "#e0e0e0", marginBottom: "8px" }}>
                    Modificar velocidad: {editingQueue.name}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {SPEED_PRESETS.map((p) => {
                      const isActive = editUpload === p.upload && editDownload === p.download && !customUpload && !customDownload;
                      return (
                        <button key={p.label} onClick={() => { setEditUpload(p.upload); setEditDownload(p.download); setCustomUpload(""); setCustomDownload(""); }}
                          className={isActive ? "btn-primary" : "btn-secondary"} style={{ padding: "4px 10px", fontSize: "10px" }}>
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="text" value={customUpload} onChange={(e) => setCustomUpload(e.target.value)} placeholder={`Subida (actual: ${formatLimit(editUpload)})`} className="input-field" style={{ width: 200, fontSize: "11px" }} />
                    <input type="text" value={customDownload} onChange={(e) => setCustomDownload(e.target.value)} placeholder={`Bajada (actual: ${formatLimit(editDownload)})`} className="input-field" style={{ width: 200, fontSize: "11px" }} />
                    <button onClick={handleUpdateSpeed} disabled={working} className="btn-success" style={{ padding: "5px 12px", fontSize: "11px" }}>
                      {working ? "..." : "Guardar"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
