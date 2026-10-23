CREATE TABLE `user_prefs` (
	`user_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `calendars` ADD `source_url` text;--> statement-breakpoint
ALTER TABLE `calendars` ADD `source_etag` text;--> statement-breakpoint
ALTER TABLE `calendars` ADD `source_last_modified` text;--> statement-breakpoint
ALTER TABLE `calendars` ADD `fetched_at` integer;--> statement-breakpoint
ALTER TABLE `calendars` ADD `fetch_error` text;--> statement-breakpoint
CREATE INDEX `calendars_source_idx` ON `calendars` (`source_url`);