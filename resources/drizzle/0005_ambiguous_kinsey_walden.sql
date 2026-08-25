CREATE TABLE `model_health` (
	`id` text PRIMARY KEY NOT NULL,
	`provide_name` text,
	`api_url` text NOT NULL,
	`model_id` text NOT NULL,
	`model_name` text,
	`format` text NOT NULL,
	`mode` text NOT NULL,
	`status` text NOT NULL,
	`conclusion` text NOT NULL,
	`items` text NOT NULL,
	`logs` text NOT NULL,
	`duration_ms` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_model_health_created` ON `model_health` (`created_at`);