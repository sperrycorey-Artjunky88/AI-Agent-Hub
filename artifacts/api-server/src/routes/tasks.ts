import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { and, desc, eq } from "drizzle-orm";
import {
  CreateTaskBody,
  CreateTaskResponse,
  DeleteTaskParams,
  ListActivityResponse,
  ListTasksResponse,
  UpdateTaskBody,
  UpdateTaskParams,
  UpdateTaskResponse,
} from "@workspace/api-zod";
import type { ErrorResponse } from "@workspace/api-zod";
import {
  agentActivityTable,
  agentRostersTable,
  agentTasksTable,
  db,
} from "@workspace/db";

const router: IRouter = Router();

async function agentBelongsToUser(userId: string, agentId: string | null | undefined): Promise<boolean> {
  if (!agentId) return true;
  const [roster] = await db
    .select({ agents: agentRostersTable.agents })
    .from(agentRostersTable)
    .where(eq(agentRostersTable.userId, userId))
    .limit(1);
  return (roster?.agents ?? []).some((agent) => agent.id === agentId);
}

router.get("/tasks", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" } satisfies ErrorResponse);
    return;
  }

  const tasks = await db
    .select()
    .from(agentTasksTable)
    .where(eq(agentTasksTable.userId, userId))
    .orderBy(desc(agentTasksTable.createdAt), desc(agentTasksTable.id));

  res.json(ListTasksResponse.parse({ tasks }));
});

router.post("/tasks", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" } satisfies ErrorResponse);
    return;
  }

  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message } satisfies ErrorResponse);
    return;
  }
  if (!(await agentBelongsToUser(userId, parsed.data.assignedAgentId))) {
    res.status(400).json({ error: "Choose an agent from your own roster." } satisfies ErrorResponse);
    return;
  }

  const task = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(agentTasksTable)
      .values({ userId, ...parsed.data })
      .returning();

    await tx.insert(agentActivityTable).values({
      userId,
      kind: "TaskCreated",
      message: `Added task “${created.title}”`,
      taskId: created.id,
    });

    return created;
  });

  res.status(201).json(CreateTaskResponse.parse(task));
});

router.patch("/tasks/:taskId", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" } satisfies ErrorResponse);
    return;
  }

  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message } satisfies ErrorResponse);
    return;
  }
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    res.status(400).json({ error: parsed.success ? "Provide at least one field to update." : parsed.error.message } satisfies ErrorResponse);
    return;
  }

  const task = await db.transaction(async (tx) => {
    const [previous] = await tx
      .select()
      .from(agentTasksTable)
      .where(and(eq(agentTasksTable.id, params.data.taskId), eq(agentTasksTable.userId, userId)))
      .limit(1);
    if (!previous) return null;

    if (
      parsed.data.assignedAgentId !== undefined &&
      !(await agentBelongsToUser(userId, parsed.data.assignedAgentId))
    ) {
      return "invalid-agent" as const;
    }

    const [updated] = await tx
      .update(agentTasksTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(agentTasksTable.id, previous.id), eq(agentTasksTable.userId, userId)))
      .returning();

    const completed = parsed.data.status === "Done" && previous.status !== "Done";
    await tx.insert(agentActivityTable).values({
      userId,
      kind: completed ? "TaskCompleted" : "TaskUpdated",
      message: completed ? `Completed task “${updated.title}”` : `Updated task “${updated.title}”`,
      taskId: updated.id,
    });

    return updated;
  });

  if (task === null) {
    res.status(404).json({ error: "Task not found." } satisfies ErrorResponse);
    return;
  }
  if (task === "invalid-agent") {
    res.status(400).json({ error: "Choose an agent from your own roster." } satisfies ErrorResponse);
    return;
  }

  res.json(UpdateTaskResponse.parse(task));
});

router.delete("/tasks/:taskId", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" } satisfies ErrorResponse);
    return;
  }

  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message } satisfies ErrorResponse);
    return;
  }

  const deleted = await db.transaction(async (tx) => {
    const [task] = await tx
      .select()
      .from(agentTasksTable)
      .where(and(eq(agentTasksTable.id, params.data.taskId), eq(agentTasksTable.userId, userId)))
      .limit(1);
    if (!task) return false;

    await tx.insert(agentActivityTable).values({
      userId,
      kind: "TaskDeleted",
      message: `Removed task “${task.title}”`,
      taskId: task.id,
    });
    await tx
      .delete(agentTasksTable)
      .where(and(eq(agentTasksTable.id, task.id), eq(agentTasksTable.userId, userId)));
    return true;
  });

  if (!deleted) {
    res.status(404).json({ error: "Task not found." } satisfies ErrorResponse);
    return;
  }
  res.status(204).end();
});

router.get("/activity", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" } satisfies ErrorResponse);
    return;
  }

  const events = await db
    .select({
      id: agentActivityTable.id,
      kind: agentActivityTable.kind,
      message: agentActivityTable.message,
      taskId: agentActivityTable.taskId,
      createdAt: agentActivityTable.createdAt,
    })
    .from(agentActivityTable)
    .where(eq(agentActivityTable.userId, userId))
    .orderBy(desc(agentActivityTable.createdAt), desc(agentActivityTable.id))
    .limit(50);

  res.json(ListActivityResponse.parse({ events }));
});

export default router;
