export default function DashboardLoading() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0b0c0e" }}>
      <div className="topbar" style={{ animation: "pulse 1.5s ease-in-out infinite" }}>
        <div style={{ width: 160, height: 20, backgroundColor: "#1e2028", borderRadius: 4 }} />
      </div>
      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "24px" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ width: 200, height: 20, backgroundColor: "#1e2028", borderRadius: 4, marginBottom: 8 }} />
          <div style={{ width: 280, height: 12, backgroundColor: "#1e2028", borderRadius: 4 }} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="panel"><div className="panel-body text-center" style={{ animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i * 0.1}s` }}>
              <div style={{ width: 80, height: 10, backgroundColor: "#1e2028", borderRadius: 4, margin: "0 auto 8px" }} />
              <div style={{ width: 40, height: 28, backgroundColor: "#1e2028", borderRadius: 4, margin: "0 auto" }} />
            </div></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="panel"><div className="panel-body" style={{ height: 120, animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i * 0.15}s` }}>
              <div style={{ width: "60%", height: 14, backgroundColor: "#1e2028", borderRadius: 4, marginBottom: 12 }} />
              <div style={{ width: "80%", height: 10, backgroundColor: "#1e2028", borderRadius: 4, marginBottom: 8 }} />
              <div style={{ width: "40%", height: 10, backgroundColor: "#1e2028", borderRadius: 4 }} />
            </div></div>
          ))}
        </div>
      </main>
    </div>
  );
}
