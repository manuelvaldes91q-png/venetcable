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

export default function ProvisioningPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [arpEntries, setArpEntries] = useState<ArpEntry[]>([]);
  const [step, setStep] = useState<Step>("idle");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [selectedLease, setSelectedLease] = useState<Lease | null>(null);
  const [clientName, setClientName] = useState("");
  const [wanInterface, setWanInterface] = useState("SALIDA");
  const [uploadLimit, setUploadLimit] = useState("5M");
  const [downloadLimit, setDownloadLimit] = useState("10M");

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
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error || "Error al cargar leases" });
      }
    } catch {
      setMessage({ type: "error", text: "Error de red" });
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
      }
    } catch {}
  };

  const handleCortar = async (arpId: string, clientName: string) => {
    if (!selectedDevice || !arpId) return;
    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch("/api/provisioning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_arp", deviceId: selectedDevice, arpId, enable: false }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setMessage({ type: "success", text: `${clientName} cortado correctamente` });
          loadQueues();
        } else {
          setMessage({ type: "error", text: "Error al cortar" });
        }
      }
    } catch {
      setMessage({ type: "error", text: "Error de red" });
    } finally {
      setWorking(false);
    }
  };

  const handleHabilitar = async (arpId: string, clientName: string) => {
    if (!selectedDevice || !arpId) return;
    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch("/api/provisioning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_arp", deviceId: selectedDevice, arpId, enable: true }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setMessage({ type: "success", text: `${clientName} habilitado correctamente` });
          loadQueues();
        } else {
          setMessage({ type: "error", text: "Error al habilitar" });
        }
      }
    } catch {
      setMessage({ type: "error", text: "Error de red" });
    } finally {
      setWorking(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    if (selectedDevice) {
      loadLeases();
      loadQueues();
    }
  }, [selectedDevice]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMakeStatic = async () => {
    if (!selectedDevice || !selectedLease) return;
    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch("/api/provisioning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "make_static",
          deviceId: selectedDevice,
          leaseId: selectedLease.id,
          clientName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setMessage({ type: "success", text: `Lease ${selectedLease.address} convertido a estático como "${clientName}"` });
          setStep("add_arp");
        } else {
          setMessage({ type: "error", text: "Error al convertir a estático" });
        }
      }
    } catch {
      setMessage({ type: "error", text: "Error de red" });
    } finally {
      setWorking(false);
    }
  };

  const handleAddArp = async () => {
    if (!selectedDevice || !selectedLease) return;
    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch("/api/provisioning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_arp",
          deviceId: selectedDevice,
          macAddress: selectedLease.macAddress,
          ipAddress: selectedLease.address,
          interfaceName: wanInterface,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setMessage({ type: "success", text: `ARP vinculado: ${selectedLease.address} → ${selectedLease.macAddress}` });
          setStep("set_speed");
        } else {
          setMessage({ type: "error", text: "Error al agregar ARP" });
        }
      }
    } catch {
      setMessage({ type: "error", text: "Error de red" });
    } finally {
      setWorking(false);
    }
  };

  const handleAddQueue = async () => {
    if (!selectedDevice || !selectedLease) return;
    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch("/api/provisioning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_queue",
          deviceId: selectedDevice,
          queueName: clientName,
          targetIp: selectedLease.address,
          uploadLimit,
          downloadLimit,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setMessage({ type: "success", text: `Cola "${clientName}" creada: ${uploadLimit}/${downloadLimit}` });
          setStep("done");
          loadQueues();
        } else {
          setMessage({ type: "error", text: "Error al crear cola" });
        }
      }
    } catch {
      setMessage({ type: "error", text: "Error de red" });
    } finally {
      setWorking(false);
    }
  };

  const resetFlow = () => {
    setStep("idle");
    setSelectedLease(null);
    setClientName("");
    setMessage(null);
    loadLeases();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0b0c0e" }}>
        <div style={{ color: "#8e8e8e", fontSize: "14px" }}>Cargando...</div>
      </div>
    );
  }

  const stepLabels = [
    { key: "select_lease", num: 1, label: "Seleccionar Lease" },
    { key: "set_static", num: 2, label: "Fijar Estático" },
    { key: "add_arp", num: 3, label: "Vincular ARP" },
    { key: "set_speed", num: 4, label: "Asignar Velocidad" },
  ];

  const stepIndex = stepLabels.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0b0c0e" }}>
      <TopNav />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#e0e0e0" }}>Aprovisionamiento</h1>
            <p style={{ fontSize: "12px", color: "#5a5f6a" }}>
              Flujo: DHCP → Estático → ARP → Velocidad
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedDevice || ""}
              onChange={(e) => setSelectedDevice(parseInt(e.target.value, 10) || null)}
              className="select-field"
              style={{ width: 200 }}
            >
              <option value="">Seleccionar dispositivo</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.status === "online" ? "●" : "○"}
                </option>
              ))}
            </select>
            <button onClick={loadLeases} disabled={working || !selectedDevice} className="btn-primary">
              Actualizar
            </button>
          </div>
        </div>

        {message && (
          <div className={message.type === "success" ? "toast-success" : "toast-error"} style={{ marginBottom: "16px" }}>
            {message.text}
          </div>
        )}

        {step !== "idle" && step !== "done" && (
          <div className="panel mb-6">
            <div className="panel-body">
              <div className="flex items-center gap-3">
                {stepLabels.map((s, i) => (
                  <div key={s.key} className="flex items-center gap-2">
                    <div
                      style={{
                        width: 28, height: 28, borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "12px", fontWeight: 700,
                        backgroundColor: i <= stepIndex ? "#3b82f6" : "#2c3039",
                        color: i <= stepIndex ? "#fff" : "#5a5f6a",
                      }}
                    >
                      {s.num}
                    </div>
                    <span style={{ fontSize: "12px", color: i <= stepIndex ? "#d8d9da" : "#5a5f6a", fontWeight: i === stepIndex ? 600 : 400 }}>
                      {s.label}
                    </span>
                    {i < stepLabels.length - 1 && (
                      <span style={{ color: "#2c3039", margin: "0 4px" }}>→</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === "set_static" && selectedLease && (
          <div className="panel mb-6">
            <div className="panel-header">
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#e0e0e0" }}>Paso 2: Fijar IP Estática</h3>
            </div>
            <div className="panel-body">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="label-text">IP</p>
                  <p style={{ fontSize: "14px", color: "#d8d9da", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{selectedLease.address}</p>
                </div>
                <div>
                  <p className="label-text">MAC</p>
                  <p style={{ fontSize: "14px", color: "#8e8e8e", fontVariantNumeric: "tabular-nums" }}>{selectedLease.macAddress}</p>
                </div>
                <div>
                  <p className="label-text">Host</p>
                  <p style={{ fontSize: "14px", color: "#8e8e8e" }}>{selectedLease.hostName || "—"}</p>
                </div>
              </div>
              <div className="mb-4">
                <label className="label-text">Nombre del Cliente *</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ej. Juan Pérez - Casa 5"
                  className="input-field"
                  style={{ maxWidth: 400 }}
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleMakeStatic} disabled={working || !clientName} className="btn-primary">
                  {working ? "Convirtiendo..." : "Convertir a Estático"}
                </button>
                <button onClick={resetFlow} className="btn-secondary">Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {step === "add_arp" && selectedLease && (
          <div className="panel mb-6">
            <div className="panel-header">
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#e0e0e0" }}>Paso 3: Vinculación ARP (IP-MAC)</h3>
            </div>
            <div className="panel-body">
              <p style={{ fontSize: "12px", color: "#8e8e8e", marginBottom: "12px" }}>
                Crear entrada ARP estática para amarrar IP con MAC.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="label-text">IP</p>
                  <p style={{ fontSize: "14px", color: "#d8d9da", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{selectedLease.address}</p>
                </div>
                <div>
                  <p className="label-text">MAC</p>
                  <p style={{ fontSize: "14px", color: "#8e8e8e", fontVariantNumeric: "tabular-nums" }}>{selectedLease.macAddress}</p>
                </div>
                <div>
                  <label className="label-text">Interfaz</label>
                  <input type="text" value={wanInterface} onChange={(e) => setWanInterface(e.target.value)} placeholder="ether1" className="input-field" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddArp} disabled={working} className="btn-primary">
                  {working ? "Agregando..." : "Agregar ARP"}
                </button>
                <button onClick={() => setStep("set_speed")} className="btn-secondary">Omitir</button>
              </div>
            </div>
          </div>
        )}

        {step === "set_speed" && selectedLease && (
          <div className="panel mb-6">
            <div className="panel-header">
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#e0e0e0" }}>Paso 4: Asignar Velocidad (Simple Queue)</h3>
            </div>
            <div className="panel-body">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="label-text">Cliente</p>
                  <p style={{ fontSize: "14px", color: "#d8d9da", fontWeight: 600 }}>{clientName}</p>
                </div>
                <div>
                  <p className="label-text">IP Objetivo</p>
                  <p style={{ fontSize: "14px", color: "#8e8e8e", fontVariantNumeric: "tabular-nums" }}>{selectedLease.address}</p>
                </div>
                <div>
                  <label className="label-text">Subida Máxima (Upload)</label>
                  <input type="text" value={uploadLimit} onChange={(e) => setUploadLimit(e.target.value)} placeholder="5M" className="input-field" />
                  <p style={{ fontSize: "10px", color: "#5a5f6a", marginTop: "2px" }}>Ej: 5M, 10M, 1M, 512k</p>
                </div>
                <div>
                  <label className="label-text">Bajada Máxima (Download)</label>
                  <input type="text" value={downloadLimit} onChange={(e) => setDownloadLimit(e.target.value)} placeholder="10M" className="input-field" />
                  <p style={{ fontSize: "10px", color: "#5a5f6a", marginTop: "2px" }}>Ej: 10M, 20M, 50M, 100M</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddQueue} disabled={working} className="btn-success">
                  {working ? "Creando..." : "Crear Cola de Velocidad"}
                </button>
                <button onClick={resetFlow} className="btn-secondary">Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="panel mb-6">
            <div className="panel-body text-center" style={{ padding: "32px" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#73bf69" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px" }}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <p style={{ fontSize: "16px", fontWeight: 600, color: "#73bf69", marginBottom: "4px" }}>
                Aprovisionamiento Completado
              </p>
              <p style={{ fontSize: "12px", color: "#8e8e8e", marginBottom: "16px" }}>
                {clientName} — {selectedLease?.address} — {uploadLimit}/{downloadLimit}
              </p>
              <button onClick={resetFlow} className="btn-primary">
                Aprovisionar Otro Cliente
              </button>
            </div>
          </div>
        )}

        {step === "idle" && (
          <div className="panel">
            <div className="panel-header">
              <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#d8d9da" }}>
                Leases DHCP Activos
              </h3>
              <span style={{ fontSize: "11px", color: "#5a5f6a" }}>
                {leases.length} leases
              </span>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              {leases.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px" }}>
                  <p style={{ fontSize: "12px", color: "#5a5f6a" }}>
                    {selectedDevice ? "Sin leases. Presione 'Actualizar'." : "Seleccione un dispositivo."}
                  </p>
                </div>
              ) : (
                <table style={{ width: "100%", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #2c3039" }}>
                      {["IP", "MAC", "Host", "Estado", "Servidor", "Expira", "Acción"].map((h) => (
                        <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#5a5f6a", fontWeight: 600, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leases.map((lease) => (
                      <tr
                        key={lease.id}
                        style={{ borderBottom: "1px solid #1e2028", transition: "background-color 0.1s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <td style={{ padding: "8px 16px", color: "#d8d9da", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{lease.address}</td>
                        <td style={{ padding: "8px 16px", color: "#8e8e8e", fontVariantNumeric: "tabular-nums" }}>{lease.macAddress}</td>
                        <td style={{ padding: "8px 16px", color: "#8e8e8e" }}>{lease.hostName || "—"}</td>
                        <td style={{ padding: "8px 16px" }}>
                          <span style={{
                            fontSize: "10px", fontWeight: 600, padding: "2px 6px", borderRadius: 3,
                            backgroundColor: lease.status === "bound" ? "rgba(115,191,105,0.15)" : "rgba(255,152,48,0.15)",
                            color: lease.status === "bound" ? "#73bf69" : "#ff9830",
                          }}>
                            {lease.status}
                          </span>
                        </td>
                        <td style={{ padding: "8px 16px", color: "#5a5f6a" }}>{lease.server}</td>
                        <td style={{ padding: "8px 16px", color: "#5a5f6a" }}>{lease.expiresAfter}</td>
                        <td style={{ padding: "8px 16px" }}>
                          <button
                            onClick={() => {
                              setSelectedLease(lease);
                              setClientName(lease.hostName || "");
                              setStep("set_static");
                              setMessage(null);
                            }}
                            className="btn-primary"
                            style={{ padding: "3px 10px", fontSize: "10px" }}
                          >
                            Aprovisionar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {queues.length > 0 && (
          <div className="panel mt-4">
            <div className="panel-header">
              <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#d8d9da" }}>Clientes Aprovisionados</h3>
              <span style={{ fontSize: "11px", color: "#5a5f6a" }}>{queues.length} clientes</span>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              <table style={{ width: "100%", fontSize: "12px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #2c3039" }}>
                    {["Nombre", "IP", "Plan (Subida)", "Plan (Bajada)", "ARP", "Acción"].map((h) => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#5a5f6a", fontWeight: 600, fontSize: "11px", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queues.map((q) => {
                    const parts = q.maxLimit.split("/");
                    const uploadRaw = parts[0] || "0";
                    const downloadRaw = parts[1] || "0";

                    const formatPlan = (val: string): string => {
                      const num = parseFloat(val);
                      if (val.toUpperCase().includes("G")) return `${num} Gbps`;
                      if (val.toUpperCase().includes("M") || val.toUpperCase().includes("m")) return `${num} Mbps`;
                      if (val.toUpperCase().includes("K") || val.toUpperCase().includes("k")) return `${(num / 1000).toFixed(1)} Mbps`;
                      if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(0)} Mbps`;
                      if (num >= 1_000) return `${(num / 1_000).toFixed(0)} Kbps`;
                      return `${num} bps`;
                    };

                    const ip = q.target.replace("/32", "");
                    const matchingArp = arpEntries.find((arp) => arp.address === ip);
                    const isArpDisabled = matchingArp?.disabled === "true";

                    return (
                      <tr key={q.id} style={{ borderBottom: "1px solid #1e2028" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <td style={{ padding: "8px 16px", color: "#d8d9da", fontWeight: 500 }}>{q.name}</td>
                        <td style={{ padding: "8px 16px", color: "#8e8e8e", fontVariantNumeric: "tabular-nums" }}>{ip}</td>
                        <td style={{ padding: "8px 16px", color: "#ff9830", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                          {formatPlan(uploadRaw)}
                        </td>
                        <td style={{ padding: "8px 16px", color: "#b877d9", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                          {formatPlan(downloadRaw)}
                        </td>
                        <td style={{ padding: "8px 16px" }}>
                          {matchingArp ? (
                            <span className={`status-dot ${isArpDisabled ? "status-dot-offline" : "status-dot-online"}`} />
                          ) : (
                            <span style={{ fontSize: "10px", color: "#5a5f6a" }}>—</span>
                          )}
                          <span style={{ marginLeft: 6, fontSize: "11px", color: isArpDisabled ? "#f2495c" : matchingArp ? "#73bf69" : "#5a5f6a" }}>
                            {isArpDisabled ? "Cortado" : matchingArp ? "Activo" : "Sin ARP"}
                          </span>
                        </td>
                        <td style={{ padding: "8px 16px" }}>
                          {matchingArp && (
                            isArpDisabled ? (
                              <button
                                onClick={() => handleHabilitar(matchingArp.id, q.name)}
                                disabled={working}
                                className="btn-success"
                                style={{ padding: "3px 10px", fontSize: "10px" }}
                              >
                                Habilitar
                              </button>
                            ) : (
                              <button
                                onClick={() => handleCortar(matchingArp.id, q.name)}
                                disabled={working}
                                className="btn-danger"
                                style={{ padding: "3px 10px", fontSize: "10px" }}
                              >
                                Cortar
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
