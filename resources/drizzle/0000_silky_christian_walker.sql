CREATE TABLE `aihot_item` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`category` text,
	`discovered_at` text,
	`published_at` text,
	`search_text` text,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_aihot_category` ON `aihot_item` (`category`);--> statement-breakpoint
CREATE INDEX `idx_aihot_discovered` ON `aihot_item` (`discovered_at`);--> statement-breakpoint
CREATE INDEX `idx_aihot_published` ON `aihot_item` (`published_at`);--> statement-breakpoint
CREATE TABLE `aihot_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
