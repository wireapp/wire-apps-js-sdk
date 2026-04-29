CREATE TABLE `conversation` (
	`id` text NOT NULL,
	`domain` text NOT NULL,
	`name` text,
	`team_id` text,
	`mls_group_id` text NOT NULL,
	`creation_date` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`type` text NOT NULL,
	PRIMARY KEY(`id`, `domain`)
);
--> statement-breakpoint
CREATE TABLE `conversation_member` (
	`user_id` text NOT NULL,
	`user_domain` text NOT NULL,
	`conversation_id` text NOT NULL,
	`conversation_domain` text NOT NULL,
	`role` text NOT NULL,
	`creation_date` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	PRIMARY KEY(`user_id`, `user_domain`, `conversation_id`, `conversation_domain`),
	FOREIGN KEY (`conversation_id`,`conversation_domain`) REFERENCES `conversation`(`id`,`domain`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `app_properties` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`creation_date` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
