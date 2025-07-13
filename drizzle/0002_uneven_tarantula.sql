PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_grandeo_statement` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`currentAccountId` text(255) NOT NULL,
	`statementDate` integer,
	`periodStartDate` integer,
	`periodEndDate` integer,
	`openingBalance` real,
	`closingBalance` real,
	`sourceFileName` text(255) NOT NULL,
	`sourcePathDataBucket` text(255) NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()),
	`updatedAt` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`currentAccountId`) REFERENCES `grandeo_current_account`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_grandeo_statement`("id", "currentAccountId", "statementDate", "periodStartDate", "periodEndDate", "openingBalance", "closingBalance", "sourceFileName", "sourcePathDataBucket", "createdAt", "updatedAt") SELECT "id", "currentAccountId", "statementDate", "periodStartDate", "periodEndDate", "openingBalance", "closingBalance", "sourceFileName", "sourcePathDataBucket", "createdAt", "updatedAt" FROM `grandeo_statement`;--> statement-breakpoint
DROP TABLE `grandeo_statement`;--> statement-breakpoint
ALTER TABLE `__new_grandeo_statement` RENAME TO `grandeo_statement`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `statement_account_idx` ON `grandeo_statement` (`currentAccountId`);--> statement-breakpoint
CREATE INDEX `statement_date_idx` ON `grandeo_statement` (`statementDate`);--> statement-breakpoint
CREATE INDEX `statement_period_idx` ON `grandeo_statement` (`periodStartDate`,`periodEndDate`);