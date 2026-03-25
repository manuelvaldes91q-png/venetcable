"use client";

import { useState, useEffect, useCallback } from "react";
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
}

const SIGNAL_COLORS = {
  excellent: "text-green-400",
  good: "text-blue-400",
  fair: "text-yellow-400",
  poor: "text-orange-400",
  bad: "text-red-400",
};

function getSignalQuality(dbm: number | null): { label: string; color: string; pct: number } {
  if (dbm == null) return { label: "N/A", color: "text-gray-500", pct: 0 };
  if (dbm >= -50) return { label: "Excellent", color: SIGNAL_COLORS.excellent, pct: 100 };
  if (dbm >= -60) return { label: "Good", color: SIGNAL_COLORS.good, pct: 80 };
  if (dbm >= -70) return { label: "Fair", color: SIGNAL_COLORS.fair, pct: 60 };
  if (dbm >= -80) return { label: "Poor", color: SIGNAL_COLORS.poor, pct: 35 };
  return { label: "Bad", color: SIGNAL_COLORS.bad, pct: 15 };
}

function formatTimestamp(ts: string) {
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
    name: "",
    ssid: "",
    frequency: "",
    channelWidth: "",
    mode: "other",
    location: "",
    notes: "",
  });

  const [readingForm, setReadingForm] = useState({
    signalStrength: "",
    signalNoise: "",
    ccq: "",
    txRate: "",
    rxRate: "",
    txBytes: "",
    rxBytes: "",
    registeredClients: "",
    notes: "",
  });

  const fetchAntennas = useCallback(async () => {
    try {
      const res = await fetch("/api/antennas");
      if (res.ok) {
        const data = await res.json();
        setAntennas(data);
        if (data.length > 0 && !selectedAntenna) {
          setSelectedAntenna(data[0].id);
        }
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [selectedAntenna]);

  useEffect(() => {
    fetchAntennas();
    const interval = setInterval(fetchAntennas, 30000);
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
        setMessage({ type: "success", text: "Antenna added successfully" });
        setAddForm({ name: "", ssid: "", frequency: "", channelWidth: "", mode: "other", location: "", notes: "" });
        setShowAddForm(false);
        await fetchAntennas();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to add antenna" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
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
        setMessage({ type: "success", text: "Reading added successfully" });
        setReadingForm({ signalStrength: "", signalNoise: "", ccq: "", txRate: "", rxRate: "", txBytes: "", rxBytes: "", registeredClients: "", notes: "" });
        setShowReadingForm(null);
        await fetchAntennas();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to add reading" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/antennas?id=${id}`, { method: "DELETE" });
      if (selectedAntenna === id) {
        setSelectedAntenna(null);
      }
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 text-lg">Loading antennas...</div>
      </div>
    );
  }

  const selectedData = antennas.find((a) => a.id === selectedAntenna);

  const signalChartData =
    selectedData?.readings
      ?.slice()
      .reverse()
      .map((r) => ({
        timestamp: formatTimestamp(r.timestamp),
        "Signal (dBm)": r.signalStrength ?? 0,
        "Noise (dBm)": r.signalNoise ?? 0,
      })) || [];

  const ccqChartData =
    selectedData?.readings
      ?.slice()
      .reverse()
      .map((r) => ({
        timestamp: formatTimestamp(r.timestamp),
        "CCQ %": r.ccq ?? 0,
      })) || [];

  const snrChartData =
    selectedData?.readings
      ?.slice()
      .reverse()
      .map((r) => ({
        timestamp: formatTimestamp(r.timestamp),
        "SNR (dB)":
          r.signalStrength != null && r.signalNoise != null
            ? parseFloat((r.signalStrength - r.signalNoise).toFixed(1))
            : 0,
      })) || [];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <a href="/dashboard" className="text-sm text-blue-400 hover:text-blue-300">
              &larr; Back to Dashboard
            </a>
            <h1 className="text-xl font-bold text-white mt-1">Antenna Monitoring</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Manual wireless antenna tracking and signal analysis
            </p>
          </div>
          <button
            onClick={() => { setShowAddForm(!showAddForm); setShowReadingForm(null); }}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
          >
            {showAddForm ? "Cancel" : "Add Antenna"}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
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

        {showAddForm && (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
            <h2 className="text-lg font-semibold mb-4">Add Antenna</h2>
            <form onSubmit={handleAddAntenna} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={addForm.name}
                    onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Sector Norte"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">SSID</label>
                  <input
                    type="text"
                    value={addForm.ssid}
                    onChange={(e) => setAddForm((p) => ({ ...p, ssid: e.target.value }))}
                    placeholder="e.g. WISP-AP-01"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Frequency</label>
                  <input
                    type="text"
                    value={addForm.frequency}
                    onChange={(e) => setAddForm((p) => ({ ...p, frequency: e.target.value }))}
                    placeholder="e.g. 5180 MHz"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Channel Width</label>
                  <input
                    type="text"
                    value={addForm.channelWidth}
                    onChange={(e) => setAddForm((p) => ({ ...p, channelWidth: e.target.value }))}
                    placeholder="e.g. 20 MHz"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Mode</label>
                  <select
                    value={addForm.mode}
                    onChange={(e) => setAddForm((p) => ({ ...p, mode: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ap-bridge">AP Bridge</option>
                    <option value="station">Station</option>
                    <option value="bridge">Bridge</option>
                    <option value="wds-slave">WDS Slave</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Location</label>
                  <input
                    type="text"
                    value={addForm.location}
                    onChange={(e) => setAddForm((p) => ({ ...p, location: e.target.value }))}
                    placeholder="e.g. Torre A - Techo"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-sm text-gray-400 mb-1">Notes</label>
                  <textarea
                    value={addForm.notes}
                    onChange={(e) => setAddForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Additional details..."
                    rows={2}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-sm font-medium rounded-md transition-colors"
              >
                {submitting ? "Adding..." : "Add Antenna"}
              </button>
            </form>
          </div>
        )}

        {showReadingForm && (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-6">
            <h2 className="text-lg font-semibold mb-4">
              Add Reading — {antennas.find((a) => a.id === showReadingForm)?.name}
            </h2>
            <form onSubmit={handleAddReading} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Signal Strength (dBm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={readingForm.signalStrength}
                    onChange={(e) => setReadingForm((p) => ({ ...p, signalStrength: e.target.value }))}
                    placeholder="e.g. -65"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Noise Floor (dBm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={readingForm.signalNoise}
                    onChange={(e) => setReadingForm((p) => ({ ...p, signalNoise: e.target.value }))}
                    placeholder="e.g. -95"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">CCQ (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={readingForm.ccq}
                    onChange={(e) => setReadingForm((p) => ({ ...p, ccq: e.target.value }))}
                    placeholder="e.g. 95"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Tx Rate</label>
                  <input
                    type="text"
                    value={readingForm.txRate}
                    onChange={(e) => setReadingForm((p) => ({ ...p, txRate: e.target.value }))}
                    placeholder="e.g. 130 Mbps"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Rx Rate</label>
                  <input
                    type="text"
                    value={readingForm.rxRate}
                    onChange={(e) => setReadingForm((p) => ({ ...p, rxRate: e.target.value }))}
                    placeholder="e.g. 130 Mbps"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Registered Clients</label>
                  <input
                    type="number"
                    min="0"
                    value={readingForm.registeredClients}
                    onChange={(e) => setReadingForm((p) => ({ ...p, registeredClients: e.target.value }))}
                    placeholder="e.g. 12"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Tx Bytes</label>
                  <input
                    type="number"
                    min="0"
                    value={readingForm.txBytes}
                    onChange={(e) => setReadingForm((p) => ({ ...p, txBytes: e.target.value }))}
                    placeholder="Total tx bytes"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Rx Bytes</label>
                  <input
                    type="number"
                    min="0"
                    value={readingForm.rxBytes}
                    onChange={(e) => setReadingForm((p) => ({ ...p, rxBytes: e.target.value }))}
                    placeholder="Total rx bytes"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="lg:col-span-3">
                  <label className="block text-sm text-gray-400 mb-1">Notes</label>
                  <textarea
                    value={readingForm.notes}
                    onChange={(e) => setReadingForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="Observations for this reading..."
                    rows={2}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-green-800 text-white text-sm font-medium rounded-md transition-colors"
                >
                  {submitting ? "Saving..." : "Save Reading"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReadingForm(null)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-md transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {antennas.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-12 border border-gray-700 text-center">
            <p className="text-gray-400 text-lg mb-2">No antennas configured</p>
            <p className="text-gray-500 text-sm">
              Add your first antenna to start manual signal monitoring.
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-block mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm transition-colors"
            >
              Add Antenna
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
              {antennas.map((ant) => {
                const sq = getSignalQuality(ant.latestReading?.signalStrength ?? null);
                const snr =
                  ant.latestReading?.signalStrength != null && ant.latestReading?.signalNoise != null
                    ? (ant.latestReading.signalStrength - ant.latestReading.signalNoise).toFixed(1)
                    : null;

                return (
                  <div
                    key={ant.id}
                    onClick={() => setSelectedAntenna(ant.id)}
                    className={`bg-gray-800 rounded-lg p-5 border cursor-pointer transition-all hover:border-gray-600 ${
                      selectedAntenna === ant.id
                        ? "border-blue-500 ring-1 ring-blue-500"
                        : "border-gray-700"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              ant.status === "up"
                                ? "bg-green-500"
                                : ant.status === "down"
                                  ? "bg-red-500"
                                  : "bg-yellow-500"
                            }`}
                          />
                          <h3 className="text-base font-semibold text-white">{ant.name}</h3>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                          {ant.ssid && <p className="text-xs text-gray-400">SSID: {ant.ssid}</p>}
                          {ant.frequency && <p className="text-xs text-gray-400">{ant.frequency}</p>}
                          {ant.location && <p className="text-xs text-gray-500">{ant.location}</p>}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowReadingForm(ant.id); setShowAddForm(false); }}
                          className="px-2.5 py-1 text-xs font-medium bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded-md transition-colors"
                        >
                          + Reading
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStatusToggle(ant); }}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                            ant.status === "up"
                              ? "bg-red-600/20 hover:bg-red-600/40 text-red-400"
                              : "bg-green-600/20 hover:bg-green-600/40 text-green-400"
                          }`}
                        >
                          {ant.status === "up" ? "Set Down" : "Set Up"}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(ant.id); }}
                          className="px-2.5 py-1 text-xs font-medium bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-md transition-colors"
                        >
                          Del
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 mt-3">
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase">Signal</p>
                        <p className={`text-sm font-bold ${sq.color}`}>
                          {ant.latestReading?.signalStrength != null
                            ? `${ant.latestReading.signalStrength} dBm`
                            : "--"}
                        </p>
                        <p className={`text-[10px] ${sq.color}`}>{sq.label}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase">Noise</p>
                        <p className="text-sm font-bold text-gray-300">
                          {ant.latestReading?.signalNoise != null
                            ? `${ant.latestReading.signalNoise} dBm`
                            : "--"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase">SNR</p>
                        <p className="text-sm font-bold text-cyan-400">
                          {snr ? `${snr} dB` : "--"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase">CCQ</p>
                        <p className="text-sm font-bold text-purple-400">
                          {ant.latestReading?.ccq != null
                            ? `${ant.latestReading.ccq}%`
                            : "--"}
                        </p>
                      </div>
                    </div>

                    {ant.latestReading && (
                      <div className="flex gap-4 mt-2 text-[10px] text-gray-500">
                        {ant.latestReading.txRate && <span>Tx: {ant.latestReading.txRate}</span>}
                        {ant.latestReading.rxRate && <span>Rx: {ant.latestReading.rxRate}</span>}
                        {ant.latestReading.registeredClients > 0 && (
                          <span>Clients: {ant.latestReading.registeredClients}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {selectedData && selectedData.readings.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white">
                  {selectedData.name} — Signal History
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {signalChartData.length > 0 && (
                    <MetricLineChart
                      data={signalChartData}
                      dataKeys={[
                        { key: "Signal (dBm)", color: "#3B82F6", name: "Signal" },
                        { key: "Noise (dBm)", color: "#EF4444", name: "Noise" },
                      ]}
                      title="Signal & Noise (dBm)"
                    />
                  )}

                  {snrChartData.length > 0 && (
                    <MetricAreaChart
                      data={snrChartData}
                      dataKeys={[{ key: "SNR (dB)", color: "#06B6D4", name: "SNR" }]}
                      title="Signal-to-Noise Ratio (dB)"
                    />
                  )}
                </div>

                {ccqChartData.length > 0 && (
                  <MetricAreaChart
                    data={ccqChartData}
                    dataKeys={[{ key: "CCQ %", color: "#A855F7", name: "CCQ" }]}
                    title="Connection Quality (CCQ %)"
                  />
                )}

                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Reading History</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-700">
                          <th className="pb-2 pr-4">Time</th>
                          <th className="pb-2 pr-4">Signal</th>
                          <th className="pb-2 pr-4">Noise</th>
                          <th className="pb-2 pr-4">SNR</th>
                          <th className="pb-2 pr-4">CCQ</th>
                          <th className="pb-2 pr-4">Tx Rate</th>
                          <th className="pb-2 pr-4">Rx Rate</th>
                          <th className="pb-2">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedData.readings.slice(0, 20).map((r) => {
                          const snrVal =
                            r.signalStrength != null && r.signalNoise != null
                              ? (r.signalStrength - r.signalNoise).toFixed(1)
                              : null;
                          return (
                            <tr key={r.id} className="border-b border-gray-700/50">
                              <td className="py-2 pr-4 text-gray-300 whitespace-nowrap">
                                {new Date(r.timestamp).toLocaleString()}
                              </td>
                              <td className={`py-2 pr-4 ${getSignalQuality(r.signalStrength).color}`}>
                                {r.signalStrength != null ? `${r.signalStrength} dBm` : "--"}
                              </td>
                              <td className="py-2 pr-4 text-gray-300">
                                {r.signalNoise != null ? `${r.signalNoise} dBm` : "--"}
                              </td>
                              <td className="py-2 pr-4 text-cyan-400">
                                {snrVal ? `${snrVal} dB` : "--"}
                              </td>
                              <td className="py-2 pr-4 text-purple-400">
                                {r.ccq != null ? `${r.ccq}%` : "--"}
                              </td>
                              <td className="py-2 pr-4 text-gray-300">{r.txRate || "--"}</td>
                              <td className="py-2 pr-4 text-gray-300">{r.rxRate || "--"}</td>
                              <td className="py-2 text-gray-500 max-w-[200px] truncate">
                                {r.notes || "--"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
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
