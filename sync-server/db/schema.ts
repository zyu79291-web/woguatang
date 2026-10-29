import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const syncVaults = sqliteTable("sync_vaults", {
 id: text("id").primaryKey(), authHash: text("auth_hash").notNull(),
 payload: text("payload").notNull(), revision: integer("revision").notNull(),
 previous: text("previous"), updatedAt: integer("updated_at").notNull(),
});
export const syncRates = sqliteTable("sync_rates", {
 id: text("id").primaryKey(), count: integer("count").notNull(),
});
