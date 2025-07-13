CREATE TABLE `grandeo_account_balance` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`currentAccountId` text(255) NOT NULL,
	`date` integer NOT NULL,
	`balance` real NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()),
	`updatedAt` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`currentAccountId`) REFERENCES `grandeo_current_account`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `account_balance_account_idx` ON `grandeo_account_balance` (`currentAccountId`);--> statement-breakpoint
CREATE INDEX `account_balance_date_idx` ON `grandeo_account_balance` (`date`);--> statement-breakpoint
CREATE INDEX `account_balance_account_date_idx` ON `grandeo_account_balance` (`currentAccountId`,`date`);--> statement-breakpoint
DROP TABLE `grandeo_recorded_account_balance`;