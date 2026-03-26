import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const devices = sqliteTable("devices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  host: text("host").notNull(),
  port: integer("port").notNull().default(8728),
  username: text("username").notNull(),
  encryptedPassword: text("encrypted_password").notNull(),
  routerosVersion: text("routeros_version").default("v6"),
  wanInterfaceName: text("wan_interface_name"),
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

export const antennas = sqliteTable("antennas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  ip: text("ip"),
  ssid: text("ssid"),
  frequency: text("frequency"),
  channelWidth: text("channel_width"),
  mode: text("mode", {
    enum: ["ap-bridge", "station", "bridge", "wds-slave", "other"],
  }).default("other"),
  deviceId: integer("device_id").references(() => devices.id, {
    onDelete: "set null",
  }),
  interfaceName: text("interface_name"),
  location: text("location"),
  notes: text("notes"),
  status: text("status", { enum: ["up", "down", "unknown"] })
    .notNull()
    .default("unknown"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

export const antennaReadings = sqliteTable("antenna_readings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  antennaId: integer("antenna_id")
    .notNull()
    .references(() => antennas.id, { onDelete: "cascade" }),
  signalStrength: real("signal_strength"),
  signalNoise: real("signal_noise"),
  ccq: real("ccq"),
  txRate: text("tx_rate"),
  rxRate: text("rx_rate"),
  txBytes: integer("tx_bytes").default(0),
  rxBytes: integer("rx_bytes").default(0),
  registeredClients: integer("registered_clients").default(0),
  notes: text("notes"),
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

export const latencyMetrics = sqliteTable("latency_metrics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  deviceId: integer("device_id")
    .notNull()
    .references(() => devices.id, { onDelete: "cascade" }),
  rttMin: real("rtt_min"),
  rttAvg: real("rtt_avg"),
  rttMax: real("rtt_max"),
  packetLoss: real("packet_loss").default(0),
  jitter: real("jitter"),
  timestamp: integer("timestamp", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

export const telegramConfig = sqliteTable("telegram_config", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  botToken: text("bot_token").notNull(),
  botUsername: text("bot_username"),
  webhookUrl: text("webhook_url"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  alertDeviceOffline: integer("alert_device_offline", { mode: "boolean" }).notNull().default(true),
  alertHighCpu: integer("alert_high_cpu", { mode: "boolean" }).notNull().default(true),
  alertHighCpuThreshold: integer("alert_high_cpu_threshold").notNull().default(80),
  alertHighLatency: integer("alert_high_latency", { mode: "boolean" }).notNull().default(true),
  alertHighLatencyThreshold: integer("alert_high_latency_threshold").notNull().default(150),
  alertIntervalMinutes: integer("alert_interval_minutes").notNull().default(5),
  lastPollUpdateId: integer("last_poll_update_id").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const telegramUsers = sqliteTable("telegram_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  telegramChatId: text("telegram_chat_id").notNull(),
  telegramUsername: text("telegram_username"),
  telegramFirstName: text("telegram_first_name"),
  addedByUserId: integer("added_by_user_id").references(() => users.id, { onDelete: "set null" }),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  subscribedAlerts: text("subscribed_alerts").default("all"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const telegramAlertHistory = sqliteTable("telegram_alert_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  alertType: text("alert_type").notNull(),
  targetId: integer("target_id").notNull(),
  targetName: text("target_name").notNull(),
  lastState: text("last_state").notNull(),
  lastNotifiedAt: integer("last_notified_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "user"] })
    .notNull()
    .default("user"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});
