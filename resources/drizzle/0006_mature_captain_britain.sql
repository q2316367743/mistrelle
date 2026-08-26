CREATE TABLE `compare_question` (
	`key` text PRIMARY KEY NOT NULL,
	`tag` text NOT NULL,
	`order_index` integer NOT NULL,
	`enable` integer NOT NULL,
	`question` text NOT NULL,
	`reference` text NOT NULL,
	`answer_keys` text NOT NULL,
	`pattern` text,
	`note` text
);
--> statement-breakpoint
CREATE TABLE `model_compare` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`exec_mode` text NOT NULL,
	`speed_runs` integer NOT NULL,
	`consistency_count` integer NOT NULL,
	`models` text NOT NULL,
	`results` text NOT NULL,
	`logs` text NOT NULL,
	`duration_ms` integer,
	`report_path` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_model_compare_created` ON `model_compare` (`created_at`);