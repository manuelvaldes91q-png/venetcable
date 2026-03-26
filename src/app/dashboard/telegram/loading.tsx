export default function Loading() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0b0c0e" }}>
      <div className="topbar" />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "24px" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ width: 180, height: 20, backgroundColor: "#1e2028", borderRadius: 4, marginBottom: 8 }} />
          <div style={{ width: 320, height: 12, backgroundColor: "#1e2028", borderRadius: 4 }} />
        </div>
        <div className="panel"><div className="panel-body" style={{ height: 250, animation: "pulse 1.5s ease-in-out infinite" }}>
          <div style={{ width: "50%", height: 14, backgroundColor: "#1e2028", borderRadius: 4, marginBottom: 16 }} />
          <div style={{ width: "100%", height: 10, backgroundColor: "#1e2028", borderRadius: 4, marginBottom: 8 }} />
          <div style={{ width: "70%", height: 10, backgroundColor: "#1e2028", borderRadius: 4 }} />
        </div></div>
      </main>
    </div>
  );
}
