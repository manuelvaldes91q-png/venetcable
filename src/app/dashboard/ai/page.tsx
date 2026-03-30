"use client";

import { useState, useEffect } from "react";
import { TopNav } from "@/components/ui/TopNav";

export default function AiPage() {
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [history, setHistory] = useState<{ q: string; a: string }[]>([]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai");
      if (res.ok) {
        const data = await res.json();
        setAnalysis(data.analysis);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const askQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (res.ok) {
        const data = await res.json();
        setHistory((prev) => [...prev, { q: question, a: data.analysis }]);
        setQuestion("");
      }
    } catch {} finally {
      setAsking(false);
    }
  };

  useEffect(() => {
    runAnalysis();
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0b0c0e" }}>
      <TopNav />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "24px" }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#e0e0e0" }}>Analizador de Red</h1>
            <p style={{ fontSize: "12px", color: "#5a5f6a" }}>Análisis experto de configuración MikroTik — sin IA externa</p>
          </div>
          <button onClick={runAnalysis} disabled={loading} className="btn-primary">
            {loading ? "Analizando..." : "🔄 Actualizar Análisis"}
          </button>
        </div>

        <div className="panel mb-6">
          <div className="panel-header">
            <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#d8d9da" }}>📊 Diagnóstico</h3>
          </div>
          <div className="panel-body">
            {loading ? (
              <div style={{ textAlign: "center", padding: "24px", color: "#5a5f6a" }}>Analizando...</div>
            ) : analysis ? (
              <pre style={{ fontSize: "13px", color: "#d8d9da", whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.6, margin: 0 }}>
                {analysis}
              </pre>
            ) : (
              <p style={{ color: "#5a5f6a", textAlign: "center", padding: "24px" }}>
                Presiona &quot;Actualizar Análisis&quot; para diagnosticar.
              </p>
            )}
          </div>
        </div>

        <div className="panel mb-6">
          <div className="panel-header">
            <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#d8d9da" }}>🔍 Filtrar por categoría</h3>
          </div>
          <div className="panel-body">
            <form onSubmit={askQuestion} className="flex gap-2 mb-4">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="firewall, cpu, colas, puertos, dns, ntp..."
                className="input-field"
                style={{ flex: 1 }}
              />
              <button type="submit" disabled={asking || !question.trim()} className="btn-primary">
                {asking ? "..." : "Filtrar"}
              </button>
            </form>

            {history.length > 0 && (
              <div style={{ borderTop: "1px solid #2c3039", paddingTop: "16px" }}>
                {history.slice().reverse().map((item, i) => (
                  <div key={i} style={{ marginBottom: "16px" }}>
                    <p style={{ fontSize: "12px", fontWeight: 600, color: "#6e9fff", marginBottom: "4px" }}>
                      🔍 {item.q}
                    </p>
                    <pre style={{
                      fontSize: "13px", color: "#d8d9da", whiteSpace: "pre-wrap",
                      fontFamily: "inherit", lineHeight: 1.6, margin: 0,
                      padding: "12px", backgroundColor: "#141619", borderRadius: 4,
                    }}>
                      {item.a}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#d8d9da" }}>📋 Categorías disponibles</h3>
          </div>
          <div className="panel-body">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "🔥 Firewall", desc: "Reglas, puertos abiertos" },
                { label: "🔒 Seguridad", desc: "Winbox, SSH, DNS, proxy" },
                { label: "⚡ Rendimiento", desc: "FastTrack, CPU, RAM" },
                { label: "🔌 Interfaces", desc: "Puertos, errores, cable" },
                { label: "🌐 Red", desc: "NAT, rutas, DNS, ARP" },
                { label: "📊 ISP", desc: "Colas, DHCP, clientes" },
                { label: "🔧 Mantenimiento", desc: "NTP, logs, backups" },
                { label: "💻 Sistema", desc: "CPU, RAM, uptime" },
                { label: "📡 Antenas", desc: "Estado up/down" },
              ].map((cat) => (
                <div key={cat.label} style={{ padding: "8px 12px", backgroundColor: "#141619", borderRadius: 4, border: "1px solid #2c3039" }}>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "#d8d9da" }}>{cat.label}</p>
                  <p style={{ fontSize: "10px", color: "#5a5f6a" }}>{cat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
