CREATE TABLE `telegram_config` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bot_token` text NOT NULL,
	`bot_username` text,
	`webhook_url` text,
	`enabled` integer DEFAULT false NOT NULL,
	`alert_device_offline` integer DEFAULT true NOT NULL,
	`alert_high_cpu` integer DEFAULT true NOT NULL,
	`alert_high_cpu_threshold` integer DEFAULT 80 NOT NULL,
	`alert_high_latency` integer DEFAULT true NOT NULL,
	`alert_high_latency_threshold` integer DEFAULT 150 NOT NULL,
	`alert_interval_minutes` integer DEFAULT 5 NOT NULL,
	`last_poll_update_id` integer DEFAULT 0,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `telegram_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`telegram_chat_id` text NOT NULL,
	`telegram_username` text,
	`telegram_first_name` text,
	`added_by_user_id` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`subscribed_alerts` text DEFAULT 'all',
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`added_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
