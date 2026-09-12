import { Router, type IRouter } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import authRouter from "./auth";
import profileRouter from "./profile";
import messagesRouter from "./messages";
import chatStateRouter from "./chatState";
import adminRouter from "./admin";
import presenceRouter from "./presence";
import usersRouter from "./users";
import pushRouter from "./push";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(authRouter);
router.use(profileRouter);
router.use(messagesRouter);
router.use(chatStateRouter);
router.use(adminRouter);
router.use(presenceRouter);
router.use(usersRouter);
router.use(pushRouter);

export default router;
