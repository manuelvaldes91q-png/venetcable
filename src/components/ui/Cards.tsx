"use client";

import { getStatusDotColor } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
}

export function StatCard({ title, value, subtitle, icon }: StatCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            {title}
          </p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        {icon && <div className="text-gray-400">{icon}</div>}
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
  const memoryUsed =
    totalMemory && freeMemory
      ? (((totalMemory - freeMemory) / totalMemory) * 100).toFixed(1)
      : null;

  return (
    <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${getStatusDotColor(status)}`}
            />
            <h3 className="text-lg font-semibold text-white">{name}</h3>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            {host}:{port}
          </p>
          {routerosVersion && (
            <p className="text-xs text-gray-500 mt-0.5">
              RouterOS {routerosVersion}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {onCollectMetrics && (
            <button
              onClick={onCollectMetrics}
              disabled={collecting}
              className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-md transition-colors"
            >
              {collecting ? "Collecting..." : "Collect"}
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="px-3 py-1.5 text-xs font-medium bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-md transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {cpuLoad !== undefined && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-gray-500">CPU</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    cpuLoad > 80
                      ? "bg-red-500"
                      : cpuLoad > 50
                        ? "bg-yellow-500"
                        : "bg-green-500"
                  }`}
                  style={{ width: `${Math.min(cpuLoad, 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-300 w-8 text-right">
                {cpuLoad}%
              </span>
            </div>
          </div>

          {memoryUsed && (
            <div>
              <p className="text-xs text-gray-500">Memory</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      parseFloat(memoryUsed) > 80
                        ? "bg-red-500"
                        : parseFloat(memoryUsed) > 50
                          ? "bg-yellow-500"
                          : "bg-green-500"
                    }`}
                    style={{ width: `${Math.min(parseFloat(memoryUsed), 100)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-300 w-8 text-right">
                  {memoryUsed}%
                </span>
              </div>
            </div>
          )}

          {uptime && (
            <div>
              <p className="text-xs text-gray-500">Uptime</p>
              <p className="text-xs text-gray-300 mt-1 truncate" title={uptime}>
                {uptime}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
