CREATE TABLE `sync_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_vaults` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_hash` text NOT NULL,
	`payload` text NOT NULL,
	`revision` integer NOT NULL,
	`previous` text,
	`updated_at` integer NOT NULL
);
