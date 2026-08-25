PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_chat_sub` (
	`chat_id` text NOT NULL,
	`sub_id` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`chat_id`, `sub_id`)
);
--> statement-breakpoint
INSERT INTO `__new_chat_sub`("chat_id", "sub_id", "data") SELECT "chat_id", "sub_id", "data" FROM `chat_sub`;--> statement-breakpoint
DROP TABLE `chat_sub`;--> statement-breakpoint
ALTER TABLE `__new_chat_sub` RENAME TO `chat_sub`;--> statement-breakpoint
PRAGMA foreign_keys=ON;