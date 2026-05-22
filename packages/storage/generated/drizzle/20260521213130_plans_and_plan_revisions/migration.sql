CREATE TABLE `plan_revisions` (
	`id` text PRIMARY KEY,
	`plan_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`source_path` text,
	`content` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_plan_revisions_plan_id_plans_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY,
	`project_root` text NOT NULL,
	`status` text NOT NULL,
	`approved_plan_revision_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_plan_revisions_plan_sequence` ON `plan_revisions` (`plan_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `idx_plans_project_root_status` ON `plans` (`project_root`,`status`);