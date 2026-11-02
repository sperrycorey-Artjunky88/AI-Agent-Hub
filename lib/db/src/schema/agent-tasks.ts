import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export type AgentTaskStatus = "Queued" | "In progress" | "Done";
export type AgentTaskPriority = "Low" | "Normal" | "High";
export type AgentActivityKind =
  | "TaskCreated"
  | "TaskUpdated"
  | "TaskCompleted"
  | "TaskDeleted"
  | "RosterUpdated";

export const agentTasksTable = pgTable(
  "agent_tasks",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    details: text("details").notNull().default(""),
    assignedAgentId: text("assigned_agent_id"),
    status: text("status").$type<AgentTaskStatus>().notNull().default("Queued"),
    priority: text("priority").$type<AgentTaskPriority>().notNull().default("Normal"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("agent_tasks_user_id_idx").on(table.userId)],
);

export const agentActivityTable = pgTable(
  "agent_activity",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    kind: text("kind").$type<AgentActivityKind>().notNull(),
    message: text("message").notNull(),
    taskId: integer("task_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("agent_activity_user_created_idx").on(table.userId, table.createdAt)],
);

export const insertAgentTaskSchema = createInsertSchema(agentTasksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgentActivitySchema = createInsertSchema(agentActivityTable).omit({
  id: true,
  createdAt: true,
});

export type InsertAgentTask = z.infer<typeof insertAgentTaskSchema>;
export type InsertAgentActivity = z.infer<typeof insertAgentActivitySchema>;
export type AgentTask = typeof agentTasksTable.$inferSelect;
export type AgentActivity = typeof agentActivityTable.$inferSelect;
