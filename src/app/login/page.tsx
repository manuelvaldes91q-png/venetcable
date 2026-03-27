"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "Error de autenticación");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0b0c0e" }}>
      <div style={{ width: 380 }}>
        <div className="panel">
          <div className="panel-body">
            <div className="text-center mb-6">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6e9fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px" }}>
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
              <h1 style={{ fontSize: "18px", fontWeight: 600, color: "#e0e0e0" }}>
                MikroTik Monitor
              </h1>
              <p style={{ fontSize: "12px", color: "#5a5f6a", marginTop: "4px" }}>
                Ingrese sus credenciales para acceder
              </p>
            </div>

            {error && (
              <div className="toast-error" style={{ marginBottom: "16px", fontSize: "12px" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "16px" }}>
                <label className="label-text">Usuario</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ingrese su usuario"
                  className="input-field"
                  autoFocus
                />
              </div>
              <div style={{ marginBottom: "20px" }}>
                <label className="label-text">Contraseña</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingrese su contraseña"
                  className="input-field"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{ width: "100%", padding: "8px", fontSize: "13px" }}
              >
                {loading ? "Ingresando..." : "Iniciar Sesión"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
