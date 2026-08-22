CREATE TABLE `image_generate` (
	`id` text PRIMARY KEY NOT NULL,
	`prompt` text NOT NULL,
	`model` text,
	`size` text,
	`path` text,
	`width` integer,
	`height` integer,
	`status` text NOT NULL,
	`error` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_image_generate_created` ON `image_generate` (`created_at`);