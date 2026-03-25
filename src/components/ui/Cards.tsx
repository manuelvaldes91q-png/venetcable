"use client";

function getGaugeColor(pct: number): string {
  if (pct >= 80) return "#f2495c";
  if (pct >= 50) return "#ff9830";
  return "#73bf69";
}

function GaugeCircle({ value, max, label, unit }: { value: number; max?: number; label: string; unit?: string }) {
  const pct = max ? (value / max) * 100 : Math.min(value, 100);
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color = getGaugeColor(pct);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 52, height: 52 }}>
        <svg width="52" height="52" viewBox="0 0 52 52">
          <circle
            cx="26" cy="26" r={radius}
            className="metric-gauge-bg"
          />
          <circle
            cx="26" cy="26" r={radius}
            className="metric-gauge-fill"
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <span
          className="metric-gauge-text"
          style={{ color }}
        >
          {value}{unit || "%"}
        </span>
      </div>
      <span className="text-[10px] mt-1" style={{ color: "#8e8e8e" }}>
        {label}
      </span>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
}

export function StatCard({ title, value, subtitle, icon }: StatCardProps) {
  return (
    <div className="panel">
      <div className="panel-body">
        <div className="flex items-center justify-between">
          <div>
            <p style={{ fontSize: "11px", fontWeight: 500, color: "#8e8e8e", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {title}
            </p>
            <p style={{ fontSize: "28px", fontWeight: 700, color: "#e0e0e0", marginTop: "4px", fontVariantNumeric: "tabular-nums" }}>
              {value}
            </p>
            {subtitle && (
              <p style={{ fontSize: "11px", color: "#5a5f6a", marginTop: "2px" }}>
                {subtitle}
              </p>
            )}
          </div>
          {icon && <div style={{ color: "#5a5f6a" }}>{icon}</div>}
        </div>
      </div>
    </div>
  );
}

interface DeviceCardProps {
  name: string;
  host: string;
  port: number;
  status: string;
  cpuLoad?: number;
  freeMemory?: number;
  totalMemory?: number;
  uptime?: string;
  routerosVersion?: string;
  onCollectMetrics?: () => void;
  onDelete?: () => void;
  collecting?: boolean;
}

export function DeviceCard({
  name,
  host,
  port,
  status,
  cpuLoad,
  freeMemory,
  totalMemory,
  uptime,
  routerosVersion,
  onCollectMetrics,
  onDelete,
  collecting,
}: DeviceCardProps) {
  const memoryPct =
    totalMemory && freeMemory
      ? Math.round(((totalMemory - freeMemory) / totalMemory) * 100)
      : null;

  const freeMemMB = freeMemory ? Math.round(freeMemory / 1024 / 1024) : null;
  const totalMemMB = totalMemory ? Math.round(totalMemory / 1024 / 1024) : null;

  return (
    <div className="panel" style={{ transition: "border-color 0.15s ease" }}>
      <div className="panel-header">
        <div className="flex items-center gap-2.5">
          <span
            className={`status-dot ${
              status === "online"
                ? "status-dot-online"
                : status === "offline"
                  ? "status-dot-offline"
                  : "status-dot-unknown"
            }`}
          />
          <div>
            <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#e0e0e0" }}>
              {name}
            </h3>
            <p style={{ fontSize: "11px", color: "#8e8e8e", fontVariantNumeric: "tabular-nums" }}>
              {host}:{port}
              {routerosVersion && (
                <span style={{ marginLeft: 8, color: "#5a5f6a" }}>
                  v{routerosVersion}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onCollectMetrics && (
            <button
              onClick={onCollectMetrics}
              disabled={collecting}
              className="btn-primary"
              style={{ padding: "4px 10px", fontSize: "11px" }}
            >
              {collecting ? "Recolectando..." : "Recolectar"}
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="btn-danger"
              style={{ padding: "4px 10px", fontSize: "11px" }}
            >
              Eliminar
            </button>
          )}
        </div>
      </div>
      <div className="panel-body">
        {cpuLoad !== undefined ? (
          <div className="flex items-center justify-around">
            <GaugeCircle value={cpuLoad} label="CPU" />
            {memoryPct !== null && (
              <GaugeCircle value={memoryPct} label="RAM" />
            )}
            {uptime && (
              <div className="flex flex-col items-center">
                <span style={{ fontSize: "18px", fontWeight: 700, color: "#6e9fff" }}>
                  {uptime.split("d")[0]}
                </span>
                <span className="text-[10px]" style={{ color: "#8e8e8e" }}>
                  Uptime
                </span>
                <span className="text-[9px]" style={{ color: "#5a5f6a" }}>
                  {uptime.length > 8 ? uptime.substring(0, 16) : uptime}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <p style={{ fontSize: "12px", color: "#5a5f6a" }}>
              Sin datos — presione &quot;Recolectar&quot; para obtener métricas
            </p>
          </div>
        )}
        {freeMemMB !== null && totalMemMB !== null && (
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid #2c3039" }}>
            <div className="flex justify-between text-[11px]">
              <span style={{ color: "#5a5f6a" }}>
                Memoria libre: <span style={{ color: "#8e8e8e" }}>{freeMemMB} MB</span>
              </span>
              <span style={{ color: "#5a5f6a" }}>
                Total: <span style={{ color: "#8e8e8e" }}>{totalMemMB} MB</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
