CREATE TABLE `antenna_readings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`antenna_id` integer NOT NULL,
	`signal_strength` real,
	`signal_noise` real,
	`ccq` real,
	`tx_rate` text,
	`rx_rate` text,
	`tx_bytes` integer DEFAULT 0,
	`rx_bytes` integer DEFAULT 0,
	`registered_clients` integer DEFAULT 0,
	`notes` text,
	`timestamp` integer,
	FOREIGN KEY (`antenna_id`) REFERENCES `antennas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `antennas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`ssid` text,
	`frequency` text,
	`channel_width` text,
	`mode` text DEFAULT 'other',
	`device_id` integer,
	`interface_name` text,
	`location` text,
	`notes` text,
	`status` text DEFAULT 'unknown' NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE set null
);
