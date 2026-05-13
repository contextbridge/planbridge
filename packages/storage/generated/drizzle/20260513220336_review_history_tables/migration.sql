CREATE TABLE `plan_versions` (
	`id` text PRIMARY KEY,
	`session_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`parent_plan_version_id` text,
	`created_by` text NOT NULL,
	`content_hash` text NOT NULL,
	`title` text,
	`summary` text,
	`markdown` text NOT NULL,
	`byte_length` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_plan_versions_session_id_review_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `review_sessions`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_plan_versions_parent_plan_version_id_plan_versions_id_fk` FOREIGN KEY (`parent_plan_version_id`) REFERENCES `plan_versions`(`id`) ON DELETE SET NULL,
	CONSTRAINT "plan_versions_version_number_nonnegative" CHECK("version_number" >= 0)
);
--> statement-breakpoint
CREATE TABLE `review_comments` (
	`id` text PRIMARY KEY,
	`thread_id` text NOT NULL,
	`author_kind` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_review_comments_thread_id_review_threads_id_fk` FOREIGN KEY (`thread_id`) REFERENCES `review_threads`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `review_sessions` (
	`id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`kind` text NOT NULL,
	`external_session_id` text,
	`transcript_path` text,
	`title` text,
	`status` text NOT NULL,
	`closed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_review_sessions_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `review_submissions` (
	`id` text PRIMARY KEY,
	`session_id` text NOT NULL,
	`plan_version_id` text NOT NULL,
	`status` text NOT NULL,
	`submitted_at` text NOT NULL,
	`payload_schema` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_review_submissions_session_id_review_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `review_sessions`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_review_submissions_plan_version_id_plan_versions_id_fk` FOREIGN KEY (`plan_version_id`) REFERENCES `plan_versions`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `review_threads` (
	`id` text PRIMARY KEY,
	`session_id` text NOT NULL,
	`subject_kind` text NOT NULL,
	`anchor_json` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_review_threads_session_id_review_sessions_id_fk` FOREIGN KEY (`session_id`) REFERENCES `review_sessions`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_plan_versions_session_number` ON `plan_versions` (`session_id`,`version_number`);--> statement-breakpoint
CREATE INDEX `idx_plan_versions_session_created` ON `plan_versions` (`session_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_plan_versions_parent` ON `plan_versions` (`parent_plan_version_id`);--> statement-breakpoint
CREATE INDEX `idx_review_comments_thread_created` ON `review_comments` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_review_sessions_project_kind_status` ON `review_sessions` (`project_id`,`kind`,`status`);--> statement-breakpoint
CREATE INDEX `idx_review_sessions_external` ON `review_sessions` (`project_id`,`kind`,`external_session_id`);--> statement-breakpoint
CREATE INDEX `idx_review_sessions_updated_at` ON `review_sessions` (`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_review_submissions_plan_version` ON `review_submissions` (`plan_version_id`);--> statement-breakpoint
CREATE INDEX `idx_review_submissions_session_plan_version` ON `review_submissions` (`session_id`,`plan_version_id`);--> statement-breakpoint
CREATE INDEX `idx_review_submissions_submitted_at` ON `review_submissions` (`submitted_at`);--> statement-breakpoint
CREATE INDEX `idx_review_threads_session_status` ON `review_threads` (`session_id`,`status`);