DROP INDEX IF EXISTS `idx_plan_revisions_plan_sequence`;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_plan_revisions_plan_sequence` ON `plan_revisions` (`plan_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `idx_plan_revisions_plan_id` ON `plan_revisions` (`plan_id`);