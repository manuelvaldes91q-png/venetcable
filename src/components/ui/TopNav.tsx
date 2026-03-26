"use client";

import { usePathname, useRouter } from "next/navigation";

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();

  const links = [
    { href: "/dashboard", label: "Panel Principal" },
    { href: "/dashboard/antennas", label: "Antenas" },
    { href: "/dashboard/provisioning", label: "Aprovisionamiento" },
    { href: "/dashboard/devices", label: "Dispositivos" },
    { href: "/dashboard/users", label: "Usuarios" },
  ];

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <nav className="topbar">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6e9fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
          <span className="topbar-brand">MikroTik Monitor</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#3b82f6]/15 text-[#6e9fff] font-medium">
            RouterOS v6
          </span>
        </div>
        <div className="topbar-nav ml-4">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`topbar-nav-item ${pathname === link.href ? "active" : ""}`}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <LiveClock />
        <button
          onClick={handleLogout}
          style={{
            background: "none",
            border: "1px solid #343841",
            color: "#8e8e8e",
            fontSize: "11px",
            padding: "4px 10px",
            borderRadius: 4,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#f2495c"; e.currentTarget.style.borderColor = "rgba(242,73,92,0.4)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#8e8e8e"; e.currentTarget.style.borderColor = "#343841"; }}
        >
          Salir
        </button>
      </div>
    </nav>
  );
}

function LiveClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dateStr = now.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="text-right">
      <div className="topbar-time font-mono">{timeStr}</div>
      <div className="text-[10px] text-[#5a5f6a] capitalize">{dateStr}</div>
    </div>
  );
}
