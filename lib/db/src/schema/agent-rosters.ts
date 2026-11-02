import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export type AgentRosterEntry = {
  id: string;
  name: string;
  role: string;
  status: "Ready" | "Working" | "Away";
  color: "lilac" | "mint" | "coral" | "sky" | "gold" | "rose" | "teal" | "lavender";
  launchUrl?: string | null;
};

export const agentRostersTable = pgTable("agent_rosters", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  agents: jsonb("agents").$type<AgentRosterEntry[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertAgentRosterSchema = createInsertSchema(agentRostersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertAgentRoster = z.infer<typeof insertAgentRosterSchema>;
export type AgentRoster = typeof agentRostersTable.$inferSelect;
