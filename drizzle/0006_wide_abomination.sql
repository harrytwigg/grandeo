CREATE TABLE `grandeo_staged_transaction` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`workspaceId` text(255) NOT NULL,
	`batchId` text(255) NOT NULL,
	`expenseCategoryId` text(255),
	`amountInPounds` real DEFAULT 0 NOT NULL,
	`description` text(500),
	`date` integer,
	`included` integer DEFAULT true NOT NULL,
	`duplicateOfTransactionId` text(255),
	`createdAt` integer DEFAULT (unixepoch()),
	`updatedAt` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`workspaceId`) REFERENCES `grandeo_workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`batchId`) REFERENCES `grandeo_statement_import_batch`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`expenseCategoryId`) REFERENCES `grandeo_expense_category`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`duplicateOfTransactionId`) REFERENCES `grandeo_transaction`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `staged_transaction_workspace_idx` ON `grandeo_staged_transaction` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `staged_transaction_batch_idx` ON `grandeo_staged_transaction` (`batchId`);--> statement-breakpoint
CREATE INDEX `staged_transaction_date_idx` ON `grandeo_staged_transaction` (`date`);--> statement-breakpoint
CREATE INDEX `staged_transaction_expense_category_idx` ON `grandeo_staged_transaction` (`expenseCategoryId`);--> statement-breakpoint
CREATE TABLE `grandeo_statement_import_batch` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`workspaceId` text(255) NOT NULL,
	`statementId` text(255) NOT NULL,
	`currentAccountId` text(255) NOT NULL,
	`status` text(50) DEFAULT 'pending' NOT NULL,
	`periodStartDate` integer,
	`periodEndDate` integer,
	`openingBalance` real,
	`closingBalance` real,
	`reviewedAt` integer,
	`reviewedBy` text(255),
	`createdAt` integer DEFAULT (unixepoch()),
	`updatedAt` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`workspaceId`) REFERENCES `grandeo_workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`statementId`) REFERENCES `grandeo_statement`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`currentAccountId`) REFERENCES `grandeo_current_account`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewedBy`) REFERENCES `grandeo_user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `statement_import_batch_workspace_idx` ON `grandeo_statement_import_batch` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `statement_import_batch_statement_idx` ON `grandeo_statement_import_batch` (`statementId`);--> statement-breakpoint
CREATE INDEX `statement_import_batch_account_idx` ON `grandeo_statement_import_batch` (`currentAccountId`);--> statement-breakpoint
CREATE INDEX `statement_import_batch_status_idx` ON `grandeo_statement_import_batch` (`status`);--> statement-breakpoint
CREATE INDEX `statement_import_batch_statement_status_idx` ON `grandeo_statement_import_batch` (`statementId`,`status`);