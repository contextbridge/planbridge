CREATE TABLE `plan_revisions` (
	`id` text PRIMARY KEY,
	`plan_id` text NOT NULL,
	`revision_number` integer NOT NULL,
	`content` text NOT NULL,
	`title` text,
	`source_path` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_plan_revisions_plan_id_plans_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON DELETE CASCADE,
	CONSTRAINT "plan_revisions_revision_number_positive" CHECK("revision_number" > 0)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY,
	`title` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_plan_revisions_plan_revision_number` ON `plan_revisions` (`plan_id`,`revision_number`);