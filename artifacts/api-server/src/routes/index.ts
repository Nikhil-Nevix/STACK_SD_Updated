import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import ticketsRouter from "./tickets";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import roiRouter from "./roi";
import logsRouter from "./logs";
import adminRouter from "./admin";
import sopsRouter from "./sops";
import chatRouter from "./chat";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(ticketsRouter);
router.use(dashboardRouter);
router.use(reportsRouter);
router.use(roiRouter);
router.use(logsRouter);
router.use(adminRouter);
router.use(sopsRouter);
router.use(chatRouter);

export default router;
