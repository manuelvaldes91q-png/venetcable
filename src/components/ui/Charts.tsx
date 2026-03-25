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

interface ChartProps {
  data: ChartDataPoint[];
  dataKeys: { key: string; color: string; name: string }[];
  title: string;
  height?: number;
}

function PanelWrapper({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h3
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "#d8d9da",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h3>
      </div>
      <div className="panel-body">{children}</div>
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: "#1e2028",
  border: "1px solid #343841",
  borderRadius: "4px",
  color: "#d8d9da",
  fontSize: "12px",
  padding: "8px 12px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
};

const axisStyle = {
  tick: { fill: "#8e8e8e", fontSize: 11 },
  stroke: "#2c3039",
};

export function MetricLineChart({
  data,
  dataKeys,
  title,
  height = 280,
}: ChartProps) {
  return (
    <PanelWrapper title={title}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2028" vertical={false} />
          <XAxis dataKey="timestamp" {...axisStyle} />
          <YAxis {...axisStyle} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend
            wrapperStyle={{ fontSize: "11px", color: "#8e8e8e", paddingTop: "8px" }}
          />
          {dataKeys.map((dk) => (
            <Line
              key={dk.key}
              type="monotone"
              dataKey={dk.key}
              stroke={dk.color}
              name={dk.name}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </PanelWrapper>
  );
}

export function MetricAreaChart({
  data,
  dataKeys,
  title,
  height = 280,
}: ChartProps) {
  return (
    <PanelWrapper title={title}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <defs>
            {dataKeys.map((dk) => (
              <linearGradient key={dk.key} id={`grad-${dk.key.replace(/[^a-zA-Z]/g, "")}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={dk.color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={dk.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2028" vertical={false} />
          <XAxis dataKey="timestamp" {...axisStyle} />
          <YAxis {...axisStyle} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend
            wrapperStyle={{ fontSize: "11px", color: "#8e8e8e", paddingTop: "8px" }}
          />
          {dataKeys.map((dk) => (
            <Area
              key={dk.key}
              type="monotone"
              dataKey={dk.key}
              fill={`url(#grad-${dk.key.replace(/[^a-zA-Z]/g, "")})`}
              stroke={dk.color}
              name={dk.name}
              strokeWidth={2}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </PanelWrapper>
  );
}

export function MetricBarChart({
  data,
  dataKeys,
  title,
  height = 280,
}: ChartProps) {
  return (
    <PanelWrapper title={title}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2028" vertical={false} />
          <XAxis dataKey="timestamp" {...axisStyle} />
          <YAxis {...axisStyle} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend
            wrapperStyle={{ fontSize: "11px", color: "#8e8e8e", paddingTop: "8px" }}
          />
          {dataKeys.map((dk) => (
            <Bar
              key={dk.key}
              dataKey={dk.key}
              fill={dk.color}
              name={dk.name}
              radius={[2, 2, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </PanelWrapper>
  );
}
