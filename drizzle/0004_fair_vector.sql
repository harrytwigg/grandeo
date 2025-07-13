CREATE TABLE `grandeo_transaction` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`currentAccountId` text(255) NOT NULL,
	`amountInPounds` real NOT NULL,
	`description` text(500),
	`date` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()),
	`updatedAt` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`currentAccountId`) REFERENCES `grandeo_current_account`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `transaction_account_idx` ON `grandeo_transaction` (`currentAccountId`);--> statement-breakpoint
CREATE INDEX `transaction_date_idx` ON `grandeo_transaction` (`date`);--> statement-breakpoint
CREATE INDEX `transaction_account_date_idx` ON `grandeo_transaction` (`currentAccountId`,`date`);