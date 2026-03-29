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
            <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#e0e0e0" }}>Asistente IA</h1>
            <p style={{ fontSize: "12px", color: "#5a5f6a" }}>Análisis inteligente de tu red MikroTik</p>
          </div>
          <button onClick={runAnalysis} disabled={loading} className="btn-primary">
            {loading ? "Analizando..." : "🔄 Actualizar Análisis"}
          </button>
        </div>

        <div className="panel mb-6">
          <div className="panel-header">
            <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#d8d9da" }}>📊 Diagnóstico Automático</h3>
          </div>
          <div className="panel-body">
            {loading ? (
              <div style={{ textAlign: "center", padding: "24px", color: "#5a5f6a" }}>
                <p>Analizando la red con IA...</p>
              </div>
            ) : analysis ? (
              <pre style={{
                fontSize: "13px", color: "#d8d9da", whiteSpace: "pre-wrap",
                fontFamily: "inherit", lineHeight: 1.6, margin: 0,
              }}>
                {analysis}
              </pre>
            ) : (
              <p style={{ color: "#5a5f6a", textAlign: "center", padding: "24px" }}>
                Presiona &quot;Actualizar Análisis&quot; para diagnosticar la red.
              </p>
            )}
          </div>
        </div>

        <div className="panel mb-6">
          <div className="panel-header">
            <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#d8d9da" }}>💬 Preguntar a la IA</h3>
          </div>
          <div className="panel-body">
            <form onSubmit={askQuestion} className="flex gap-2 mb-4">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ej: ¿Por qué el CPU está alto? ¿Cómo optimizar la red?"
                className="input-field"
                style={{ flex: 1 }}
              />
              <button type="submit" disabled={asking || !question.trim()} className="btn-primary">
                {asking ? "..." : "Preguntar"}
              </button>
            </form>

            {history.length > 0 && (
              <div style={{ borderTop: "1px solid #2c3039", paddingTop: "16px" }}>
                {history.slice().reverse().map((item, i) => (
                  <div key={i} style={{ marginBottom: "16px" }}>
                    <p style={{ fontSize: "12px", fontWeight: 600, color: "#6e9fff", marginBottom: "4px" }}>
                      🙋 {item.q}
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
            <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#d8d9da" }}>⚙️ Configuración</h3>
          </div>
          <div className="panel-body">
            <p style={{ fontSize: "12px", color: "#8e8e8e", marginBottom: "8px" }}>
              Para usar el asistente de IA, necesitas una API key gratuita de OpenRouter:
            </p>
            <ol style={{ fontSize: "12px", color: "#5a5f6a", paddingLeft: "20px", lineHeight: 2 }}>
              <li>Ve a <span style={{ color: "#6e9fff" }}>https://openrouter.ai</span> y crea una cuenta</li>
              <li>Ve a Keys y crea una API key</li>
              <li>Agrega la variable de entorno: <code style={{ backgroundColor: "#1e2028", padding: "2px 6px", borderRadius: 3 }}>OPENROUTER_API_KEY=tu_key</code></li>
              <li>Reinicia la app</li>
            </ol>
            <p style={{ fontSize: "11px", color: "#5a5f6a", marginTop: "8px" }}>
              Modelo usado: Llama 3.3 8B (gratis)
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
