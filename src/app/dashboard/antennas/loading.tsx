export default function Loading() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0b0c0e" }}>
      <div className="topbar" />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ width: 120, height: 20, backgroundColor: "#1e2028", borderRadius: 4, marginBottom: 8 }} />
          <div style={{ width: 300, height: 12, backgroundColor: "#1e2028", borderRadius: 4 }} />
        </div>
        <div className="panel"><div className="panel-body" style={{ height: 300, animation: "pulse 1.5s ease-in-out infinite" }}>
          <div style={{ width: "70%", height: 14, backgroundColor: "#1e2028", borderRadius: 4, marginBottom: 16 }} />
          <div style={{ width: "100%", height: 10, backgroundColor: "#1e2028", borderRadius: 4, marginBottom: 8 }} />
          <div style={{ width: "90%", height: 10, backgroundColor: "#1e2028", borderRadius: 4, marginBottom: 8 }} />
          <div style={{ width: "80%", height: 10, backgroundColor: "#1e2028", borderRadius: 4 }} />
        </div></div>
      </main>
    </div>
  );
}
