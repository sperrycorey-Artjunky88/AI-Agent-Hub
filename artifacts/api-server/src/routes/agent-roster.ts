import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { and, eq, inArray } from "drizzle-orm";
import {
  GetAgentRosterResponse,
  SaveAgentRosterBody,
  SaveAgentRosterResponse,
} from "@workspace/api-zod";
import type { ErrorResponse } from "@workspace/api-zod";
import { agentActivityTable, agentRostersTable, agentTasksTable, db } from "@workspace/db";

const router: IRouter = Router();

router.get("/agent-roster", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    const error: ErrorResponse = { error: "Unauthorized" };
    res.status(401).json(error);
    return;
  }

  const [roster] = await db
    .select({
      agents: agentRostersTable.agents,
      updatedAt: agentRostersTable.updatedAt,
    })
    .from(agentRostersTable)
    .where(eq(agentRostersTable.userId, userId))
    .limit(1);

  res.json(
    GetAgentRosterResponse.parse({
      agents: roster?.agents ?? null,
      updatedAt: roster?.updatedAt ?? null,
    }),
  );
});

router.put("/agent-roster", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) {
    const error: ErrorResponse = { error: "Unauthorized" };
    res.status(401).json(error);
    return;
  }

  const parsed = SaveAgentRosterBody.safeParse(req.body);
  if (!parsed.success) {
    const error: ErrorResponse = { error: parsed.error.message };
    res.status(400).json(error);
    return;
  }

  for (const agent of parsed.data.agents) {
    if (!agent.launchUrl) continue;
    try {
      const url = new URL(agent.launchUrl);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("unsupported protocol");
    } catch {
      const error: ErrorResponse = {
        error: `The launch link for ${agent.name} must be a valid HTTP or HTTPS URL.`,
      };
      res.status(400).json(error);
      return;
    }
  }

  const saved = await db.transaction(async (tx) => {
    const [previous] = await tx
      .select({ agents: agentRostersTable.agents })
      .from(agentRostersTable)
      .where(eq(agentRostersTable.userId, userId))
      .limit(1);
    const retainedIds = new Set(parsed.data.agents.map((agent) => agent.id));
    const removedIds = (previous?.agents ?? [])
      .filter((agent) => !retainedIds.has(agent.id))
      .map((agent) => agent.id);

    const [roster] = await tx
      .insert(agentRostersTable)
      .values({
        userId,
        agents: parsed.data.agents,
      })
      .onConflictDoUpdate({
        target: agentRostersTable.userId,
        set: {
          agents: parsed.data.agents,
          updatedAt: new Date(),
        },
      })
      .returning({
        agents: agentRostersTable.agents,
        updatedAt: agentRostersTable.updatedAt,
      });

    if (removedIds.length > 0) {
      await tx
        .update(agentTasksTable)
        .set({ assignedAgentId: null, updatedAt: new Date() })
        .where(
          and(
            eq(agentTasksTable.userId, userId),
            inArray(agentTasksTable.assignedAgentId, removedIds),
          ),
        );
    }

    await tx.insert(agentActivityTable).values({
      userId,
      kind: "RosterUpdated",
      message: "Updated the AI collaborator roster",
      taskId: null,
    });

    return roster;
  });

  res.json(SaveAgentRosterResponse.parse(saved));
});

export default router;
