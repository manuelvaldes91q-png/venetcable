export default function Loading() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0b0c0e" }}>
      <div className="topbar" />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ width: 180, height: 20, backgroundColor: "#1e2028", borderRadius: 4, marginBottom: 8 }} />
          <div style={{ width: 300, height: 12, backgroundColor: "#1e2028", borderRadius: 4 }} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="panel"><div className="panel-body" style={{ height: 150, animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i * 0.1}s` }}>
              <div style={{ width: "60%", height: 14, backgroundColor: "#1e2028", borderRadius: 4, marginBottom: 12 }} />
              <div style={{ width: "80%", height: 10, backgroundColor: "#1e2028", borderRadius: 4, marginBottom: 8 }} />
              <div style={{ width: "50%", height: 10, backgroundColor: "#1e2028", borderRadius: 4 }} />
            </div></div>
          ))}
        </div>
      </main>
    </div>
  );
}
