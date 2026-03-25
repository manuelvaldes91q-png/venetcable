import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const devices = sqliteTable("devices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  host: text("host").notNull(),
  port: integer("port").notNull().default(8728),
  username: text("username").notNull(),
  encryptedPassword: text("encrypted_password").notNull(),
  routerosVersion: text("routeros_version").default("v6"),
  status: text("status", { enum: ["online", "offline", "unknown"] })
    .notNull()
    .default("unknown"),
  lastSeen: integer("last_seen", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

export const systemMetrics = sqliteTable("system_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deviceId: integer("device_id")
    .notNull()
    .references(() => devices.id, { onDelete: "cascade" }),
  cpuLoad: real("cpu_load"),
  freeMemory: integer("free_memory"),
  totalMemory: integer("total_memory"),
  uptime: text("uptime"),
  timestamp: integer("timestamp", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

export const interfaceMetrics = sqliteTable("interface_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deviceId: integer("device_id")
    .notNull()
    .references(() => devices.id, { onDelete: "cascade" }),
  interfaceName: text("interface_name").notNull(),
  rxBytes: integer("rx_bytes").default(0),
  txBytes: integer("tx_bytes").default(0),
  rxPackets: integer("rx_packets").default(0),
  txPackets: integer("tx_packets").default(0),
  status: text("status").default("unknown"),
  timestamp: integer("timestamp", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

export const routingMetrics = sqliteTable("routing_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deviceId: integer("device_id")
    .notNull()
    .references(() => devices.id, { onDelete: "cascade" }),
  protocol: text("protocol", { enum: ["bgp", "ospf", "static", "other"] })
    .notNull()
    .default("other"),
  destination: text("destination"),
  gateway: text("gateway"),
  activeSessions: integer("active_sessions").default(0),
  totalRoutes: integer("total_routes").default(0),
  timestamp: integer("timestamp", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

export const firewallMetrics = sqliteTable("firewall_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deviceId: integer("device_id")
    .notNull()
    .references(() => devices.id, { onDelete: "cascade" }),
  totalRules: integer("total_rules").default(0),
  fasttrackRules: integer("fasttrack_rules").default(0),
  filterRules: integer("filter_rules").default(0),
  natRules: integer("nat_rules").default(0),
  mangleRules: integer("mangle_rules").default(0),
  timestamp: integer("timestamp", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});
