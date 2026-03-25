CREATE TABLE `devices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`host` text NOT NULL,
	`port` integer DEFAULT 8728 NOT NULL,
	`username` text NOT NULL,
	`encrypted_password` text NOT NULL,
	`routeros_version` text DEFAULT 'v6',
	`status` text DEFAULT 'unknown' NOT NULL,
	`last_seen` integer,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `firewall_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`device_id` integer NOT NULL,
	`total_rules` integer DEFAULT 0,
	`fasttrack_rules` integer DEFAULT 0,
	`filter_rules` integer DEFAULT 0,
	`nat_rules` integer DEFAULT 0,
	`mangle_rules` integer DEFAULT 0,
	`timestamp` integer,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `interface_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`device_id` integer NOT NULL,
	`interface_name` text NOT NULL,
	`rx_bytes` integer DEFAULT 0,
	`tx_bytes` integer DEFAULT 0,
	`rx_packets` integer DEFAULT 0,
	`tx_packets` integer DEFAULT 0,
	`status` text DEFAULT 'unknown',
	`timestamp` integer,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `routing_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`device_id` integer NOT NULL,
	`protocol` text DEFAULT 'other' NOT NULL,
	`destination` text,
	`gateway` text,
	`active_sessions` integer DEFAULT 0,
	`total_routes` integer DEFAULT 0,
	`timestamp` integer,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `system_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`device_id` integer NOT NULL,
	`cpu_load` real,
	`free_memory` integer,
	`total_memory` integer,
	`uptime` text,
	`timestamp` integer,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade
);
