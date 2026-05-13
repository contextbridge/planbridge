CREATE TABLE `projects` (
	`id` text PRIMARY KEY,
	`path` text NOT NULL,
	`display_name` text NOT NULL,
	`vcs_kind` text NOT NULL,
	`vcs_root_path` text,
	`git_remote_url` text,
	`git_repository_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_projects_path` ON `projects` (`path`);--> statement-breakpoint
CREATE INDEX `idx_projects_display_name` ON `projects` (`display_name`);