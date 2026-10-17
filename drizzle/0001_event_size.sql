ALTER TABLE `events` ADD `size` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `events` SET `size` = length(`data`);--> statement-breakpoint
CREATE INDEX `events_calendar_size_idx` ON `events` (`calendar_id`,`size`);
