ALTER TABLE `logto_sessions` ADD `subject` text;--> statement-breakpoint
CREATE INDEX `logto_sessions_subject_idx` ON `logto_sessions` (`subject`);