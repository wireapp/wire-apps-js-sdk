PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_conversation` (
	`id` text NOT NULL,
	`domain` text NOT NULL,
	`name` text,
	`team_id` text,
	`mls_group_id` text NOT NULL,
	`creation_date` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`type` integer NOT NULL,
	PRIMARY KEY(`id`, `domain`)
);
--> statement-breakpoint
INSERT INTO `__new_conversation`("id", "domain", "name", "team_id", "mls_group_id", "creation_date", "type") SELECT "id", "domain", "name", "team_id", "mls_group_id", "creation_date", "type" FROM `conversation`;--> statement-breakpoint
DROP TABLE `conversation`;--> statement-breakpoint
ALTER TABLE `__new_conversation` RENAME TO `conversation`;--> statement-breakpoint
PRAGMA foreign_keys=ON;