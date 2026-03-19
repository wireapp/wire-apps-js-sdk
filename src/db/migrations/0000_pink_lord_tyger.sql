CREATE TABLE `app_properties` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`creationDate` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `conversation` (
	`id` text NOT NULL,
	`domain` text NOT NULL,
	`name` text,
	`teamId` text,
	`mlsGroupId` text NOT NULL,
	`creationDate` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`' NOT NULL,
	`type` text NOT NULL,
	PRIMARY KEY(`id`, `domain`)
);
--> statement-breakpoint
CREATE TABLE `conversation_member` (
	`userId` text NOT NULL,
	`userDomain` text NOT NULL,
	`conversationId` text NOT NULL,
	`conversationDomain` text NOT NULL,
	`role` text NOT NULL,
	`creationDate` text DEFAULT 'sql`(CURRENT_TIMESTAMP)`' NOT NULL,
	PRIMARY KEY(`userId`, `userDomain`, `conversationId`, `conversationDomain`),
	FOREIGN KEY (`conversationId`,`conversationDomain`) REFERENCES `conversation`(`id`,`domain`) ON UPDATE no action ON DELETE no action
);
