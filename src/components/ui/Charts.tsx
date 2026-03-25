"use client";

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ChartDataPoint {
  timestamp: string;
  [key: string]: string | number;
}

interface LineChartProps {
  data: ChartDataPoint[];
  dataKeys: { key: string; color: string; name: string }[];
  title: string;
  height?: number;
}

export function MetricLineChart({
  data,
  dataKeys,
  title,
  height = 300,
}: LineChartProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-sm font-medium text-gray-300 mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="timestamp"
            tick={{ fill: "#9CA3AF", fontSize: 11 }}
            stroke="#4B5563"
          />
          <YAxis
            tick={{ fill: "#9CA3AF", fontSize: 11 }}
            stroke="#4B5563"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1F2937",
              border: "1px solid #374151",
              borderRadius: "8px",
              color: "#F3F4F6",
            }}
          />
          <Legend />
          {dataKeys.map((dk) => (
            <Line
              key={dk.key}
              type="monotone"
              dataKey={dk.key}
              stroke={dk.color}
              name={dk.name}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface AreaChartProps {
  data: ChartDataPoint[];
  dataKeys: { key: string; color: string; name: string }[];
  title: string;
  height?: number;
}

export function MetricAreaChart({
  data,
  dataKeys,
  title,
  height = 300,
}: AreaChartProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-sm font-medium text-gray-300 mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="timestamp"
            tick={{ fill: "#9CA3AF", fontSize: 11 }}
            stroke="#4B5563"
          />
          <YAxis
            tick={{ fill: "#9CA3AF", fontSize: 11 }}
            stroke="#4B5563"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1F2937",
              border: "1px solid #374151",
              borderRadius: "8px",
              color: "#F3F4F6",
            }}
          />
          <Legend />
          {dataKeys.map((dk) => (
            <Area
              key={dk.key}
              type="monotone"
              dataKey={dk.key}
              fill={dk.color}
              stroke={dk.color}
              name={dk.name}
              fillOpacity={0.3}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface BarChartProps {
  data: ChartDataPoint[];
  dataKeys: { key: string; color: string; name: string }[];
  title: string;
  height?: number;
}

export function MetricBarChart({
  data,
  dataKeys,
  title,
  height = 300,
}: BarChartProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-sm font-medium text-gray-300 mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="timestamp"
            tick={{ fill: "#9CA3AF", fontSize: 11 }}
            stroke="#4B5563"
          />
          <YAxis
            tick={{ fill: "#9CA3AF", fontSize: 11 }}
            stroke="#4B5563"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1F2937",
              border: "1px solid #374151",
              borderRadius: "8px",
              color: "#F3F4F6",
            }}
          />
          <Legend />
          {dataKeys.map((dk) => (
            <Bar
              key={dk.key}
              dataKey={dk.key}
              fill={dk.color}
              name={dk.name}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
