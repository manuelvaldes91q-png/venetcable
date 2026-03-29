CREATE TABLE `ai_knowledge` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`error_pattern` text NOT NULL,
	`error_type` text NOT NULL,
	`description` text NOT NULL,
	`solution` text NOT NULL,
	`occurrences` integer DEFAULT 1 NOT NULL,
	`last_occurred_at` integer,
	`created_at` integer
);
--> statement-breakpoint
CREATE TABLE `ai_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`analysis_type` text NOT NULL,
	`findings` text NOT NULL,
	`recommendations` text,
	`severity` text DEFAULT 'info' NOT NULL,
	`created_at` integer
);
