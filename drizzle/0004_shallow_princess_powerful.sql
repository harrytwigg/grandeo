CREATE TABLE `grandeo_time_entry` (
	`id` text(255) PRIMARY KEY NOT NULL,
	`workspaceId` text(255) NOT NULL,
	`userId` text(255) NOT NULL,
	`description` text(500) NOT NULL,
	`moneyValue` integer NOT NULL,
	`isEnergizing` integer NOT NULL,
	`startTime` integer NOT NULL,
	`endTime` integer,
	`createdAt` integer DEFAULT (unixepoch()),
	`updatedAt` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`workspaceId`) REFERENCES `grandeo_workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`userId`) REFERENCES `grandeo_user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `time_entry_workspace_idx` ON `grandeo_time_entry` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `time_entry_user_idx` ON `grandeo_time_entry` (`userId`);--> statement-breakpoint
CREATE INDEX `time_entry_start_time_idx` ON `grandeo_time_entry` (`startTime`);--> statement-breakpoint
CREATE INDEX `time_entry_workspace_user_idx` ON `grandeo_time_entry` (`workspaceId`,`userId`);--> statement-breakpoint
CREATE INDEX `time_entry_workspace_start_idx` ON `grandeo_time_entry` (`workspaceId`,`startTime`);