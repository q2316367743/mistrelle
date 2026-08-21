CREATE TABLE `chat` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`top` integer NOT NULL,
	`workspace` text NOT NULL,
	`project_id` text,
	`task_id` text,
	`type` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_chat_created` ON `chat` (`created_at`);--> statement-breakpoint
CREATE TABLE `chat_content` (
	`chat_id` text PRIMARY KEY NOT NULL,
	`updated_time` integer NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_sub` (
	`chat_id` text NOT NULL,
	`sub_id` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_chat_sub_chat` ON `chat_sub` (`chat_id`);