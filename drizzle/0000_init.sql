CREATE TABLE `calendars` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '#007aff' NOT NULL,
	`timezone` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `calendars_owner_idx` ON `calendars` (`owner_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`calendar_id` text NOT NULL,
	`uid` text NOT NULL,
	`recurrence_id` text DEFAULT '' NOT NULL,
	`data` text NOT NULL,
	`sequence` integer DEFAULT 0 NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`calendar_id`) REFERENCES `calendars`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_identity_idx` ON `events` (`calendar_id`,`uid`,`recurrence_id`);--> statement-breakpoint
CREATE INDEX `events_calendar_start_idx` ON `events` (`calendar_id`,`starts_at`);--> statement-breakpoint
CREATE TABLE `logto_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `logto_sessions_expires_idx` ON `logto_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`resource_type`, `resource_id`, `user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `memberships_user_idx` ON `memberships` (`user_id`);--> statement-breakpoint
CREATE TABLE `share_links` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`calendar_id` text NOT NULL,
	`event_uid` text,
	`permission` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`personal` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	`revoked_at` integer,
	`last_accessed_at` integer,
	`access_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`calendar_id`) REFERENCES `calendars`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "share_links_permission_check" CHECK("share_links"."permission" in ('busy', 'limited', 'full', 'edit'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `share_links_token_unique` ON `share_links` (`token`);--> statement-breakpoint
CREATE INDEX `share_links_target_idx` ON `share_links` (`calendar_id`,`event_uid`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`logto_sub` text NOT NULL,
	`email` text,
	`name` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_logto_sub_unique` ON `users` (`logto_sub`);