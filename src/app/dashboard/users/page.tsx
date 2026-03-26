"use client";

import { useState, useEffect, useCallback } from "react";
import { TopNav } from "@/components/ui/TopNav";

interface User {
  id: number;
  username: string;
  role: string;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string } | null>(null);

  const [form, setForm] = useState({ username: "", password: "", role: "user" });

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else if (res.status === 403) {
        setMessage({ type: "error", text: "Solo administradores pueden gestionar usuarios" });
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
    fetchUsers();
    fetchSession();
  }, [fetchUsers, fetchSession]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setMessage({ type: "success", text: `Usuario "${form.username}" creado` });
        setForm({ username: "", password: "", role: "user" });
        setShowForm(false);
        await fetchUsers();
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

  const handleDelete = async (id: number, username: string) => {
    try {
      await fetch(`/api/users?id=${id}`, { method: "DELETE" });
      setMessage({ type: "success", text: `Usuario "${username}" eliminado` });
      await fetchUsers();
    } catch {}
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0b0c0e" }}>
        <div style={{ color: "#8e8e8e" }}>Cargando usuarios...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0b0c0e" }}>
      <TopNav />
      <main style={{ maxWidth: 700, margin: "0 auto", padding: "24px" }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#e0e0e0" }}>Usuarios</h1>
            <p style={{ fontSize: "12px", color: "#5a5f6a" }}>Gestión de usuarios con acceso al panel</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            {showForm ? "Cancelar" : "+ Nuevo Usuario"}
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
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#e0e0e0" }}>Crear Usuario</h3>
            </div>
            <div className="panel-body">
              <form onSubmit={handleCreate}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="label-text">Usuario *</label>
                    <input type="text" required value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} placeholder="Nombre de usuario" className="input-field" />
                  </div>
                  <div>
                    <label className="label-text">Contraseña *</label>
                    <input type="password" required value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="Contraseña" className="input-field" />
                  </div>
                  <div>
                    <label className="label-text">Rol</label>
                    <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} className="select-field">
                      <option value="user">Usuario</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                </div>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? "Creando..." : "Crear Usuario"}
                </button>
              </form>
            </div>
          </div>
        )}

        <div className="panel">
          <div className="panel-header">
            <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#d8d9da" }}>Lista de Usuarios</h3>
            <span style={{ fontSize: "11px", color: "#5a5f6a" }}>{users.length}</span>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            <table style={{ width: "100%", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #2c3039" }}>
                  {["Usuario", "Rol", "Creado", ""].map((h) => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#5a5f6a", fontWeight: 600, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid #1e2028" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.02)")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <td style={{ padding: "10px 16px", color: "#e0e0e0", fontWeight: 600 }}>
                      {u.username}
                      {u.username === currentUser?.username && (
                        <span style={{ marginLeft: 8, fontSize: "10px", color: "#6e9fff" }}>(tú)</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <span style={{
                        fontSize: "10px", fontWeight: 600, padding: "2px 8px", borderRadius: 3,
                        backgroundColor: u.role === "admin" ? "rgba(110,159,255,0.15)" : "rgba(115,191,105,0.15)",
                        color: u.role === "admin" ? "#6e9fff" : "#73bf69",
                      }}>
                        {u.role === "admin" ? "Admin" : "Usuario"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 16px", color: "#5a5f6a", fontSize: "12px" }}>
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString("es-ES") : "—"}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      {u.username !== currentUser?.username && (
                        <button onClick={() => handleDelete(u.id, u.username)} className="btn-danger" style={{ padding: "3px 8px", fontSize: "10px" }}>
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
