CREATE TABLE `latency_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`device_id` integer NOT NULL,
	`rtt_min` real,
	`rtt_avg` real,
	`rtt_max` real,
	`packet_loss` real DEFAULT 0,
	`jitter` real,
	`timestamp` integer,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `devices` ADD `wan_interface_name` text;