CREATE TABLE `grandeo_workspace_membership` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`workspaceId` text(255) NOT NULL,
	`userId` text(255) NOT NULL,
	`role` text(50) DEFAULT 'member' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()),
	`updatedAt` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`workspaceId`) REFERENCES `grandeo_workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `grandeo_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workspace_membership_workspace_idx` ON `grandeo_workspace_membership` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `workspace_membership_user_idx` ON `grandeo_workspace_membership` (`userId`);--> statement-breakpoint
CREATE INDEX `workspace_membership_unique_idx` ON `grandeo_workspace_membership` (`workspaceId`,`userId`);--> statement-breakpoint
CREATE TABLE `grandeo_workspace` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`name` text(255) NOT NULL,
	`description` text(500),
	`createdBy` text(255) NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()),
	`updatedAt` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`createdBy`) REFERENCES `grandeo_user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `workspace_name_idx` ON `grandeo_workspace` (`name`);--> statement-breakpoint
CREATE INDEX `workspace_created_by_idx` ON `grandeo_workspace` (`createdBy`);--> statement-breakpoint
DROP TABLE `grandeo_account`;--> statement-breakpoint
DROP TABLE `grandeo_session`;--> statement-breakpoint
DROP TABLE `grandeo_verification_token`;--> statement-breakpoint
DROP INDEX `grandeo_current_account_name_unique`;--> statement-breakpoint
ALTER TABLE `grandeo_current_account` ADD `workspaceId` text(255) NOT NULL REFERENCES grandeo_workspace(id);--> statement-breakpoint
CREATE INDEX `current_account_workspace_idx` ON `grandeo_current_account` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `current_account_workspace_name_idx` ON `grandeo_current_account` (`workspaceId`,`name`);--> statement-breakpoint
DROP INDEX `grandeo_expense_category_name_unique`;--> statement-breakpoint
ALTER TABLE `grandeo_expense_category` ADD `workspaceId` text(255) NOT NULL REFERENCES grandeo_workspace(id);--> statement-breakpoint
CREATE INDEX `expense_category_workspace_idx` ON `grandeo_expense_category` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `expense_category_workspace_name_idx` ON `grandeo_expense_category` (`workspaceId`,`name`);--> statement-breakpoint
ALTER TABLE `grandeo_account_balance` ADD `workspaceId` text(255) NOT NULL REFERENCES grandeo_workspace(id);--> statement-breakpoint
CREATE INDEX `account_balance_workspace_idx` ON `grandeo_account_balance` (`workspaceId`);--> statement-breakpoint
ALTER TABLE `grandeo_recurring_expense` ADD `workspaceId` text(255) NOT NULL REFERENCES grandeo_workspace(id);--> statement-breakpoint
CREATE INDEX `recurring_expense_workspace_idx` ON `grandeo_recurring_expense` (`workspaceId`);--> statement-breakpoint
ALTER TABLE `grandeo_statement` ADD `workspaceId` text(255) NOT NULL REFERENCES grandeo_workspace(id);--> statement-breakpoint
CREATE INDEX `statement_workspace_idx` ON `grandeo_statement` (`workspaceId`);--> statement-breakpoint
ALTER TABLE `grandeo_transaction_split` ADD `workspaceId` text(255) NOT NULL REFERENCES grandeo_workspace(id);--> statement-breakpoint
CREATE INDEX `transaction_split_workspace_idx` ON `grandeo_transaction_split` (`workspaceId`);--> statement-breakpoint
ALTER TABLE `grandeo_transaction` ADD `workspaceId` text(255) NOT NULL REFERENCES grandeo_workspace(id);--> statement-breakpoint
CREATE INDEX `transaction_workspace_idx` ON `grandeo_transaction` (`workspaceId`);--> statement-breakpoint
ALTER TABLE `grandeo_user` ADD `firstName` text(255);--> statement-breakpoint
ALTER TABLE `grandeo_user` ADD `lastName` text(255);--> statement-breakpoint
ALTER TABLE `grandeo_user` ADD `imageUrl` text(500);--> statement-breakpoint
ALTER TABLE `grandeo_user` ADD `createdAt` integer DEFAULT (unixepoch());--> statement-breakpoint
ALTER TABLE `grandeo_user` ADD `updatedAt` integer DEFAULT (unixepoch());--> statement-breakpoint
CREATE UNIQUE INDEX `grandeo_user_email_unique` ON `grandeo_user` (`email`);--> statement-breakpoint
CREATE INDEX `user_email_idx` ON `grandeo_user` (`email`);--> statement-breakpoint
ALTER TABLE `grandeo_user` DROP COLUMN `name`;--> statement-breakpoint
ALTER TABLE `grandeo_user` DROP COLUMN `emailVerified`;--> statement-breakpoint
ALTER TABLE `grandeo_user` DROP COLUMN `image`;