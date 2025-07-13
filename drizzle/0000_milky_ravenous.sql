CREATE TABLE `grandeo_account` (
	`userId` text(255) NOT NULL,
	`type` text(255) NOT NULL,
	`provider` text(255) NOT NULL,
	`providerAccountId` text(255) NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text(255),
	`scope` text(255),
	`id_token` text,
	`session_state` text(255),
	PRIMARY KEY(`provider`, `providerAccountId`),
	FOREIGN KEY (`userId`) REFERENCES `grandeo_user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `grandeo_account` (`userId`);--> statement-breakpoint
CREATE TABLE `grandeo_current_account` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`name` text(255) NOT NULL,
	`accountType` text(50) DEFAULT 'current_account' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()),
	`updatedAt` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX `grandeo_current_account_name_unique` ON `grandeo_current_account` (`name`);--> statement-breakpoint
CREATE INDEX `current_account_name_idx` ON `grandeo_current_account` (`name`);--> statement-breakpoint
CREATE INDEX `current_account_type_idx` ON `grandeo_current_account` (`accountType`);--> statement-breakpoint
CREATE TABLE `grandeo_expense_category` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`name` text(255) NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()),
	`updatedAt` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX `grandeo_expense_category_name_unique` ON `grandeo_expense_category` (`name`);--> statement-breakpoint
CREATE INDEX `expense_category_name_idx` ON `grandeo_expense_category` (`name`);--> statement-breakpoint
CREATE TABLE `grandeo_recorded_account_balance` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`currentAccountId` text(255) NOT NULL,
	`amountInPounds` real NOT NULL,
	`date` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()),
	`updatedAt` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`currentAccountId`) REFERENCES `grandeo_current_account`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `recorded_balance_account_idx` ON `grandeo_recorded_account_balance` (`currentAccountId`);--> statement-breakpoint
CREATE INDEX `recorded_balance_date_idx` ON `grandeo_recorded_account_balance` (`date`);--> statement-breakpoint
CREATE INDEX `recorded_balance_account_date_idx` ON `grandeo_recorded_account_balance` (`currentAccountId`,`date`);--> statement-breakpoint
CREATE TABLE `grandeo_recurring_expense` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`name` text(255) NOT NULL,
	`amountInPounds` real NOT NULL,
	`expenseCategoryId` text(255) NOT NULL,
	`currentAccountId` text(255) NOT NULL,
	`startDate` integer NOT NULL,
	`endDate` integer,
	`frequency` text(50) NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()),
	`updatedAt` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`expenseCategoryId`) REFERENCES `grandeo_expense_category`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`currentAccountId`) REFERENCES `grandeo_current_account`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `recurring_expense_category_idx` ON `grandeo_recurring_expense` (`expenseCategoryId`);--> statement-breakpoint
CREATE INDEX `recurring_expense_account_idx` ON `grandeo_recurring_expense` (`currentAccountId`);--> statement-breakpoint
CREATE INDEX `recurring_expense_start_date_idx` ON `grandeo_recurring_expense` (`startDate`);--> statement-breakpoint
CREATE INDEX `recurring_expense_frequency_idx` ON `grandeo_recurring_expense` (`frequency`);--> statement-breakpoint
CREATE TABLE `grandeo_session` (
	`sessionToken` text(255) PRIMARY KEY NOT NULL,
	`userId` text(255) NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `grandeo_user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `grandeo_session` (`userId`);--> statement-breakpoint
CREATE TABLE `grandeo_statement` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`currentAccountId` text(255) NOT NULL,
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
CREATE INDEX `statement_account_idx` ON `grandeo_statement` (`currentAccountId`);--> statement-breakpoint
CREATE INDEX `statement_period_idx` ON `grandeo_statement` (`periodStartDate`,`periodEndDate`);--> statement-breakpoint
CREATE TABLE `grandeo_transaction_split` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`sourceTransactionId` text(255),
	`currentAccountId` text(255) NOT NULL,
	`amountInPounds` real NOT NULL,
	`description` text(500),
	`createdAt` integer DEFAULT (unixepoch()),
	`updatedAt` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`sourceTransactionId`) REFERENCES `grandeo_transaction`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`currentAccountId`) REFERENCES `grandeo_current_account`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `transaction_split_source_transaction_idx` ON `grandeo_transaction_split` (`sourceTransactionId`);--> statement-breakpoint
CREATE INDEX `transaction_split_account_idx` ON `grandeo_transaction_split` (`currentAccountId`);--> statement-breakpoint
CREATE TABLE `grandeo_transaction` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`currentAccountId` text(255) NOT NULL,
	`sourceStatementId` text(255),
	`expenseCategoryId` text(255),
	`amountInPounds` real NOT NULL,
	`description` text(500),
	`date` integer NOT NULL,
	`handled` integer DEFAULT false NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()),
	`updatedAt` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`currentAccountId`) REFERENCES `grandeo_current_account`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sourceStatementId`) REFERENCES `grandeo_statement`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`expenseCategoryId`) REFERENCES `grandeo_expense_category`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `transaction_account_idx` ON `grandeo_transaction` (`currentAccountId`);--> statement-breakpoint
CREATE INDEX `transaction_date_idx` ON `grandeo_transaction` (`date`);--> statement-breakpoint
CREATE INDEX `transaction_account_date_idx` ON `grandeo_transaction` (`currentAccountId`,`date`);--> statement-breakpoint
CREATE INDEX `transaction_expense_category_idx` ON `grandeo_transaction` (`expenseCategoryId`);--> statement-breakpoint
CREATE INDEX `transaction_source_statement_idx` ON `grandeo_transaction` (`sourceStatementId`);--> statement-breakpoint
CREATE TABLE `grandeo_user` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`name` text(255),
	`email` text(255) NOT NULL,
	`emailVerified` integer DEFAULT (unixepoch()),
	`image` text(255)
);
--> statement-breakpoint
CREATE TABLE `grandeo_verification_token` (
	`identifier` text(255) NOT NULL,
	`token` text(255) NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
