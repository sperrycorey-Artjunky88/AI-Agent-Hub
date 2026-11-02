import { Router, type IRouter } from "express";
import healthRouter from "./health";
import agentRosterRouter from "./agent-roster";
import tasksRouter from "./tasks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(agentRosterRouter);
router.use(tasksRouter);

export default router;
