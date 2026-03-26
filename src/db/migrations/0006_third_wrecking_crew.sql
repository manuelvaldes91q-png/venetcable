CREATE TABLE `telegram_alert_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`alert_type` text NOT NULL,
	`target_id` integer NOT NULL,
	`target_name` text NOT NULL,
	`last_state` text NOT NULL,
	`last_notified_at` integer,
	`created_at` integer,
	`updated_at` integer
);
