PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_projects` (
	`id` text PRIMARY KEY,
	`path` text NOT NULL,
	`display_name` text NOT NULL,
	`vcs_kind` text NOT NULL,
	`vcs_root_path` text,
	`git_remote_url` text,
	`git_repository_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "projects_vcs_none_no_metadata" CHECK("vcs_kind" != 'none' OR ("vcs_root_path" IS NULL AND "git_remote_url" IS NULL AND "git_repository_id" IS NULL))
);
--> statement-breakpoint
INSERT INTO `__new_projects`(`id`, `path`, `display_name`, `vcs_kind`, `vcs_root_path`, `git_remote_url`, `git_repository_id`, `created_at`, `updated_at`) SELECT `id`, `path`, `display_name`, `vcs_kind`, `vcs_root_path`, `git_remote_url`, `git_repository_id`, `created_at`, `updated_at` FROM `projects`;--> statement-breakpoint
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_projects_path` ON `projects` (`path`);--> statement-breakpoint
CREATE INDEX `idx_projects_display_name` ON `projects` (`display_name`);